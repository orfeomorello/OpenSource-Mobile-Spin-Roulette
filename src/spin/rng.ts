/**
 * Unit-interval RNG for the SpinEngine.
 *
 * Production default: Web Crypto CSPRNG (`crypto.getRandomValues`).
 * Tests / replay: inject any `() => number` in [0, 1).
 *
 * Casino-style practice: outcome entropy comes from a cryptographic source,
 * not from `Math.random` (which is fine for FX but not for advertised fairness).
 */

export type UnitRng = () => number;

/** Cryptographic U[0,1). Falls back to Math.random only if crypto is unavailable. */
export function cryptoUnitRandom(): number {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    // 53 bits of mantissa precision (IEEE double), uniform in [0, 1).
    const buf = new Uint32Array(2);
    cryptoApi.getRandomValues(buf);
    const hi = buf[0] >>> 5; // 27 bits
    const lo = buf[1] >>> 6; // 26 bits
    return (hi * 0x4000000 + lo) / 0x20000000000000;
  }
  return Math.random();
}

export function resolveRng(rng?: UnitRng): UnitRng {
  return rng ?? cryptoUnitRandom;
}

/** Uniform float in [min, max). */
export function randomInRange(rng: UnitRng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/**
 * Uniform integer in {0,1,…,n-1} via rejection sampling on 32-bit draws.
 * Avoids the tiny modulo bias of `floor(u * n)` when advertising fairness.
 */
export function randomIntBelow(n: number, rng: UnitRng): number {
  if (n <= 0 || !Number.isFinite(n)) throw new RangeError(`randomIntBelow: invalid n=${n}`);
  const N = Math.floor(n);
  if (N === 1) return 0;

  // Map unit float → u32; rejection keeps uniformity for non-power-of-two N (37, 38).
  const limit = 0x100000000 - (0x100000000 % N);
  for (;;) {
    const x = Math.floor(rng() * 0x100000000);
    if (x < limit) return x % N;
  }
}
