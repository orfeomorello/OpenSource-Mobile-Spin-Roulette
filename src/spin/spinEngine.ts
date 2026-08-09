/**
 * BitCroupier SpinEngine v2 — serious **outcome** engine.
 *
 * Presentation (canvas wheel / reveal) is separate: this module only decides
 * the winning pocket and a compact plan the UI can animate toward.
 *
 * ## Algorithm (literature-inspired ball–wheel dynamics + CSPRNG)
 *
 * 1. **Entropy** — initial conditions sampled with a cryptographic unit RNG
 *    (`crypto.getRandomValues` via {@link ./rng.ts}), injectable for tests.
 *
 * 2. **Dynamics** — 1-D angular model in the spirit of published roulette
 *    analyses (decelerating ball on the rim, slowly moving wheel, drop when
 *    speed falls below a threshold; frets scatter as discrete pocket noise):
 *      dω_b / dt = −sign(ω_b) · (α + β · |ω_b|)
 *      dθ_b / dt = ω_b
 *      dθ_w / dt = ω_w   (wheel speed ≈ constant over one spin)
 *    Integrate with fixed step `integrationDt` until |ω_b| ≤ drop threshold
 *    (or `maxSimSeconds` safety cap).
 *
 * 3. **Pocket map** — at drop, relative phase (θ_b − θ_w) maps onto the
 *    physical pocket ring order for EU (37) / US (38) from `wheel-spin.json`.
 *    Optional frets scatter shifts by a small integer pocket offset.
 *
 * 4. **Independence** — difficulty, score, energy, and animation ON/OFF never
 *    enter this function. Same `winningNumber` is used whether the UI shows
 *    a long spin or instant reveal.
 *
 * Dealer “signature” profiles are intentionally **not** used: one table physics
 * for the whole product (BitCroupier runtime).
 */

import wheelConfig from "../../config/wheel-spin.json" with { type: "json" };
import type { SpinResult, TableVariant } from "../core/types.ts";
import { randomInRange, randomIntBelow, resolveRng, type UnitRng } from "./rng.ts";

const TAU = Math.PI * 2;

export interface SpinDebug {
  engine: string;
  variant: TableVariant;
  pocketCount: number;
  pocketIndex: number;
  simSeconds: number;
  ballRevolutions: number;
  wheelRevolutions: number;
  dropRelativeRadians: number;
  fretsScatter: number;
  initial: {
    ballSpeed: number;
    wheelSpeed: number;
    ballAngle: number;
    wheelAngle: number;
    alpha: number;
    beta: number;
  };
}

export interface SpinDetailed {
  result: SpinResult;
  debug: SpinDebug;
}

type SimConfig = typeof wheelConfig.simulation;
type AnimConfig = typeof wheelConfig.animation;

function pocketsFor(variant: TableVariant): readonly string[] {
  return wheelConfig.variants[variant].pockets;
}

function positiveMod(value: number, mod: number): number {
  return ((value % mod) + mod) % mod;
}

/**
 * Integrate ball + wheel until the ball drops into the rotor.
 * Returns angles (radians) and revolution counts for debug / animation plan.
 */
function integrateDrop(
  sim: SimConfig,
  initial: {
    ballSpeed: number;
    wheelSpeed: number;
    ballAngle: number;
    wheelAngle: number;
    alpha: number;
    beta: number;
  },
): {
  ballAngle: number;
  wheelAngle: number;
  simSeconds: number;
  ballRevolutions: number;
  wheelRevolutions: number;
} {
  const dt = Math.max(0.001, sim.integrationDt);
  const maxT = Math.max(dt, sim.maxSimSeconds);
  const drop = Math.max(0.01, sim.dropSpeedThreshold);
  const ballDir = sim.ballDirection < 0 ? -1 : 1;
  const wheelDir = sim.wheelDirection < 0 ? -1 : 1;

  let ωb = Math.abs(initial.ballSpeed) * ballDir;
  const ωw = Math.abs(initial.wheelSpeed) * wheelDir;
  let θb = initial.ballAngle;
  let θw = initial.wheelAngle;
  let t = 0;
  let ballArc = 0;
  let wheelArc = 0;

  while (t < maxT && Math.abs(ωb) > drop) {
    const speed = Math.abs(ωb);
    // Linear + constant drag (decelerates toward rest; classic rim model form).
    const drag = initial.alpha + initial.beta * speed;
    const accel = -Math.sign(ωb || ballDir) * drag;
    const ωbNext = ωb + accel * dt;
    // Do not reverse through zero in one step — clamp to rest then drop.
    if (Math.sign(ωbNext) !== Math.sign(ωb) && Math.sign(ωb) !== 0) {
      ωb = 0;
    } else {
      ωb = ωbNext;
    }

    const dθb = ωb * dt;
    const dθw = ωw * dt;
    θb += dθb;
    θw += dθw;
    ballArc += Math.abs(dθb);
    wheelArc += Math.abs(dθw);
    t += dt;
  }

  return {
    ballAngle: θb,
    wheelAngle: θw,
    simSeconds: t,
    ballRevolutions: ballArc / TAU,
    wheelRevolutions: wheelArc / TAU,
  };
}

function buildAnimationPlan(
  anim: AnimConfig,
  pocketIndex: number,
  pocketCount: number,
  ballRevolutions: number,
  simSeconds: number,
): Pick<SpinResult, "durationMs" | "turns" | "finalAngle"> {
  const turns = Math.max(
    2,
    Math.min(12, ballRevolutions > 0.5 ? ballRevolutions : (anim.defaultDurationSeconds / 2)),
  );

  let durationSec = anim.defaultDurationSeconds;
  if (anim.durationFromSim) {
    durationSec = simSeconds * (anim.durationScale > 0 ? anim.durationScale : 1);
    durationSec = Math.max(anim.minDurationSeconds, Math.min(anim.maxDurationSeconds, durationSec));
  }

  return {
    durationMs: Math.round(durationSec * 1000),
    turns,
    // Degrees API kept for older callers / debug; canvas uses turns + pocket.
    finalAngle: turns * 360 + (pocketIndex / pocketCount) * 360,
  };
}

/**
 * Full spin: physics outcome + animation plan.
 * @param rng optional unit RNG in [0,1); default = CSPRNG
 */
export function spinDetailed(variant: TableVariant, rng?: UnitRng): SpinDetailed {
  const unit = resolveRng(rng);
  const pockets = pocketsFor(variant);
  const N = pockets.length;
  const sim = wheelConfig.simulation;
  const anim = wheelConfig.animation;

  const ballSpeed = randomInRange(unit, sim.ballAngularSpeed.min, sim.ballAngularSpeed.max);
  const wheelSpeed = randomInRange(unit, sim.wheelAngularSpeed.min, sim.wheelAngularSpeed.max);
  const alpha = randomInRange(unit, sim.ballDrag.alpha.min, sim.ballDrag.alpha.max);
  const beta = randomInRange(unit, sim.ballDrag.beta.min, sim.ballDrag.beta.max);
  // Absolute phase of release is free; only relative geometry at drop matters.
  const ballAngle = unit() * TAU;
  const wheelAngle = unit() * TAU;

  const initial = { ballSpeed, wheelSpeed, ballAngle, wheelAngle, alpha, beta };
  const dropped = integrateDrop(sim, initial);

  const relative = positiveMod(dropped.ballAngle - dropped.wheelAngle, TAU);
  let pocketIndex = Math.floor((relative / TAU) * N) % N;

  const scatterMax = Math.max(0, Math.floor(sim.fretsScatterPockets.maxAbs));
  let fretsScatter = 0;
  if (scatterMax > 0) {
    // Symmetric integer scatter in [-max, +max], including 0.
    fretsScatter = randomIntBelow(scatterMax * 2 + 1, unit) - scatterMax;
    pocketIndex = positiveMod(pocketIndex + fretsScatter, N);
  }

  const winningNumber = pockets[pocketIndex]!;
  const plan = buildAnimationPlan(anim, pocketIndex, N, dropped.ballRevolutions, dropped.simSeconds);

  return {
    result: {
      winningNumber,
      durationMs: plan.durationMs,
      turns: plan.turns,
      finalAngle: plan.finalAngle,
    },
    debug: {
      engine: String(wheelConfig.engine),
      variant,
      pocketCount: N,
      pocketIndex,
      simSeconds: dropped.simSeconds,
      ballRevolutions: dropped.ballRevolutions,
      wheelRevolutions: dropped.wheelRevolutions,
      dropRelativeRadians: relative,
      fretsScatter,
      initial,
    },
  };
}

/** Product API: winning number + plan for the existing canvas presenter. */
export function spin(variant: TableVariant, rng?: UnitRng): SpinResult {
  return spinDetailed(variant, rng).result;
}
