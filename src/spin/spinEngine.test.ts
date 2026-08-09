/**
 * SpinEngine v2 unit checks — run: node --experimental-strip-types src/spin/spinEngine.test.ts
 */
import european from "../../config/wheel-spin.json" with { type: "json" };
import { randomIntBelow } from "./rng.ts";
import { spin, spinDetailed } from "./spinEngine.ts";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function test(name: string, body: () => void): void {
  try {
    body();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

/** Deterministic LCG in [0,1) for replayable tests. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const euPockets = new Set(european.variants.european.pockets);
const usPockets = new Set(european.variants.american.pockets);

test("spin is deterministic for a fixed unit RNG", () => {
  const a = spin("european", lcg(42));
  const b = spin("european", lcg(42));
  assert(a.winningNumber === b.winningNumber, "same seed → same pocket");
  assert(a.turns === b.turns && a.durationMs === b.durationMs, "same seed → same plan");
});

test("EU pocket is on the physical wheel ring", () => {
  for (let i = 0; i < 40; i += 1) {
    const r = spin("european", lcg(1000 + i));
    assert(euPockets.has(r.winningNumber), `invalid EU pocket ${r.winningNumber}`);
  }
});

test("US pocket can include 00 and stays on ring", () => {
  let saw00 = false;
  for (let i = 0; i < 200; i += 1) {
    const r = spin("american", lcg(2000 + i));
    assert(usPockets.has(r.winningNumber), `invalid US pocket ${r.winningNumber}`);
    if (r.winningNumber === "00") saw00 = true;
  }
  assert(saw00, "expected at least one 00 in 200 US spins");
});

test("different seeds produce varying outcomes (not a stuck constant)", () => {
  const set = new Set<string>();
  for (let i = 0; i < 30; i += 1) set.add(spin("european", lcg(i * 97 + 3)).winningNumber);
  assert(set.size >= 8, `expected diversity, got ${set.size} unique pockets`);
});

test("spinDetailed exposes engine id and positive sim time", () => {
  const { result, debug } = spinDetailed("european", lcg(7));
  assert(result.winningNumber === european.variants.european.pockets[debug.pocketIndex], "index maps to pocket");
  assert(debug.engine === "ball_wheel_ode_v1", `engine=${debug.engine}`);
  assert(debug.simSeconds > 0, "sim must run");
  assert(debug.ballRevolutions > 0, "ball should travel");
  assert(result.durationMs >= 1000, "presenter duration sane");
});

test("randomIntBelow is in range and not stuck", () => {
  const rng = lcg(99);
  const seen = new Set<number>();
  for (let i = 0; i < 100; i += 1) {
    const v = randomIntBelow(37, rng);
    assert(v >= 0 && v < 37, `out of range ${v}`);
    seen.add(v);
  }
  assert(seen.size >= 15, "integer sampler should cover many residues");
});

test("rough uniformity over many spins (soft χ² gate)", () => {
  const N = 37;
  const trials = N * 80; // 2960
  const counts = new Array<number>(N).fill(0);
  const rng = lcg(123456);
  for (let i = 0; i < trials; i += 1) {
    const { debug } = spinDetailed("european", rng);
    counts[debug.pocketIndex]! += 1;
  }
  const expected = trials / N;
  let chi = 0;
  for (const c of counts) chi += ((c - expected) ** 2) / expected;
  // df=36; critical ~58 at p≈0.01 for fair die — allow generous margin for frets scatter + dynamics
  assert(chi < 90, `χ² too high (${chi.toFixed(1)}); distribution may be broken`);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  assert(min > 0, "no pocket should be impossible");
  assert(max / Math.max(1, min) < 4, `pocket frequencies too skewed min=${min} max=${max}`);
});

console.log("\nSpinEngine tests passed.");
