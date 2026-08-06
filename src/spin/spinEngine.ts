import wheelConfig from "../../config/wheel-spin.json" with { type: "json" };
import type { SpinResult, TableVariant } from "../core/types.ts";

export interface DealerSpinProfile {
  spinPower: number;
  consistency: number;
  releaseStyle: keyof typeof wheelConfig.simulation.releaseStyleOffsetRadians.styles;
}

export function spin(profile: DealerSpinProfile, variant: TableVariant, rng: () => number = Math.random): SpinResult {
  const pockets = wheelConfig.variants[variant].pockets;
  const sim = wheelConfig.simulation;
  const power = Math.max(1, Math.min(10, profile.spinPower));
  const consistency = Math.max(1, Math.min(10, profile.consistency));
  const powerT = (power - 1) / 9;
  const baseTurns = sim.minRevolutions + powerT * (sim.maxRevolutions - sim.minRevolutions);
  const releaseOffset = sim.releaseStyleOffsetRadians.styles[profile.releaseStyle] ?? 0;
  const noiseMax = sim.releaseAngleNoiseRadians.atConsistency1 +
    ((sim.releaseAngleNoiseRadians.atConsistency10 - sim.releaseAngleNoiseRadians.atConsistency1) * (consistency - 1)) / 9;
  const angle = releaseOffset + (rng() * 2 - 1) * noiseMax + rng() * Math.PI * 2;
  const scatterMax = sim.scatterNoisePockets.atConsistency1 +
    ((sim.scatterNoisePockets.atConsistency10 - sim.scatterNoisePockets.atConsistency1) * (consistency - 1)) / 9;
  const baseIndex = Math.floor((((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * pockets.length);
  const scatter = Math.round((rng() * 2 - 1) * scatterMax);
  const index = (baseIndex + scatter + pockets.length) % pockets.length;
  const turns = Math.max(sim.minRevolutions, Math.min(sim.maxRevolutions, baseTurns + (rng() - 0.5)));
  return {
    winningNumber: pockets[index],
    durationMs: wheelConfig.animation.defaultDurationSeconds * 1000,
    turns,
    finalAngle: turns * 360 + (index / pockets.length) * 360,
  };
}
