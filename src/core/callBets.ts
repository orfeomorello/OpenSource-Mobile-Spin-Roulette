/**
 * French / racetrack call bets — pure domain.
 * Expand into catalog betId + stake pieces (B1/B2). No new multipliers.
 * Standard single-zero (European) decompositions; neighbors use wheel order.
 */
import wheelSpinConfig from "../../config/wheel-spin.json" with { type: "json" };
import type { PlacedBet, TableVariant } from "./types.ts";

export type CallSectorId = "voisins" | "tiers" | "orphelins" | "jeuZero";
export type CallFinaleId =
  | "finale_0" | "finale_1" | "finale_2" | "finale_3" | "finale_4"
  | "finale_5" | "finale_6" | "finale_7" | "finale_8" | "finale_9";

export type CallPackageId = CallSectorId | CallFinaleId | `neighbors_${string}_${number}`;

/** One chip-unit recipe line: stake = unit * units. */
export interface CallRecipeLine {
  betId: string;
  units: number;
}

export interface CallPackage {
  id: string;
  /** i18n key for short label */
  labelKey: string;
  /** Total chip units required (sum of line.units). */
  chipCount: number;
  lines: CallRecipeLine[];
  /** Pockets covered (for UI highlight). */
  pockets: string[];
  /** Only meaningful on European for classic French sectors. */
  europeanOnly: boolean;
}

const RED = new Set([
  "1", "3", "5", "7", "9", "12", "14", "16", "18", "19", "21", "23", "25", "27", "30", "32", "34", "36",
]);

export function wheelPockets(variant: TableVariant): string[] {
  const v = wheelSpinConfig.variants[variant];
  return [...v.pockets];
}

export function pocketColor(pocket: string): "red" | "black" | "green" {
  if (pocket === "0" || pocket === "00") return "green";
  return RED.has(pocket) ? "red" : "black";
}

/** Classic French sector pocket sets (EU wheel). */
export const SECTOR_POCKETS: Record<CallSectorId, string[]> = {
  // 22…25 arc including 0 — 17 numbers
  voisins: ["22", "18", "29", "7", "28", "12", "35", "3", "26", "0", "32", "15", "19", "4", "21", "2", "25"],
  // Opposite third — 12 numbers
  tiers: ["27", "13", "36", "11", "30", "8", "23", "10", "5", "24", "16", "33"],
  // Two orphan slices — 8 numbers
  orphelins: ["17", "34", "6", "1", "20", "14", "31", "9"],
  // Jeu zéro — 7 numbers near zero
  jeuZero: ["12", "35", "3", "26", "0", "32", "15"],
};

/**
 * Standard casino decompositions (unit chips).
 * Voisins corner is 25-26-28-29 (covers 25,26,28,29 within the sector).
 */
const SECTOR_RECIPES: Record<CallSectorId, CallRecipeLine[]> = {
  voisins: [
    { betId: "trio_0_2_3", units: 2 },
    { betId: "split_4_7", units: 1 },
    { betId: "split_12_15", units: 1 },
    { betId: "split_18_21", units: 1 },
    { betId: "split_19_22", units: 1 },
    { betId: "corner_25_26_28_29", units: 2 },
    { betId: "split_32_35", units: 1 },
  ],
  tiers: [
    { betId: "split_5_8", units: 1 },
    { betId: "split_10_11", units: 1 },
    { betId: "split_13_16", units: 1 },
    { betId: "split_23_24", units: 1 },
    { betId: "split_27_30", units: 1 },
    { betId: "split_33_36", units: 1 },
  ],
  orphelins: [
    { betId: "straight_1", units: 1 },
    { betId: "split_6_9", units: 1 },
    { betId: "split_14_17", units: 1 },
    { betId: "split_17_20", units: 1 },
    { betId: "split_31_34", units: 1 },
  ],
  jeuZero: [
    { betId: "split_0_3", units: 1 },
    { betId: "split_12_15", units: 1 },
    { betId: "split_32_35", units: 1 },
    { betId: "straight_26", units: 1 },
  ],
};

const SECTOR_LABEL: Record<CallSectorId, string> = {
  voisins: "racetrack.voisins",
  tiers: "racetrack.tiers",
  orphelins: "racetrack.orphelins",
  jeuZero: "racetrack.jeuZero",
};

export function chipCountOf(lines: CallRecipeLine[]): number {
  return lines.reduce((sum, line) => sum + line.units, 0);
}

export function expandRecipe(lines: CallRecipeLine[], unit: number): PlacedBet[] {
  const u = Math.floor(unit);
  if (u <= 0) return [];
  return lines
    .map((line) => ({ betId: line.betId, stake: line.units * u }))
    .filter((bet) => bet.stake > 0);
}

export function packageCost(lines: CallRecipeLine[], unit: number): number {
  return chipCountOf(lines) * Math.floor(unit);
}

export function getSectorPackage(id: CallSectorId): CallPackage {
  const lines = SECTOR_RECIPES[id];
  return {
    id,
    labelKey: SECTOR_LABEL[id],
    chipCount: chipCountOf(lines),
    lines,
    pockets: [...SECTOR_POCKETS[id]],
    europeanOnly: true,
  };
}

export function listSectorPackages(): CallPackage[] {
  return (Object.keys(SECTOR_RECIPES) as CallSectorId[]).map(getSectorPackage);
}

/** Finales en plein: all numbers ending with digit d (0–9). */
export function getFinalePackage(digit: number, variant: TableVariant): CallPackage | null {
  const d = Math.floor(digit);
  if (d < 0 || d > 9) return null;
  // Standard finales en plein: 0 → 0,10,20,30; 1 → 1,11,21,31; … (no 00)
  const wheel = wheelPockets(variant);
  const available = classicFinalePockets(d).filter((p) => wheel.includes(p));
  if (!available.length) return null;
  const lines: CallRecipeLine[] = available.map((p) => ({ betId: `straight_${p}`, units: 1 }));
  return {
    id: `finale_${d}`,
    labelKey: "racetrack.finale",
    chipCount: lines.length,
    lines,
    pockets: available,
    europeanOnly: false,
  };
}

function classicFinalePockets(digit: number): string[] {
  if (digit === 0) return ["0", "10", "20", "30"];
  const out: string[] = [String(digit)];
  for (const tens of [10, 20, 30]) {
    const n = tens + digit;
    if (n <= 36) out.push(String(n));
  }
  return out;
}

export function listFinalePackages(variant: TableVariant): CallPackage[] {
  const list: CallPackage[] = [];
  for (let d = 0; d <= 9; d += 1) {
    const pack = getFinalePackage(d, variant);
    if (pack) list.push(pack);
  }
  return list;
}

/**
 * Neighbors on the wheel: center ± radius consecutive pockets.
 * radius 0 → 1 number; 1 → 3; 2 → 5 (classic); max typically 4 → 9.
 */
export function neighborPockets(
  variant: TableVariant,
  center: string,
  radius: number,
): string[] | null {
  const pockets = wheelPockets(variant);
  const idx = pockets.indexOf(center);
  if (idx < 0) return null;
  const r = Math.max(0, Math.min(9, Math.floor(radius)));
  const n = pockets.length;
  const out: string[] = [];
  for (let d = -r; d <= r; d += 1) {
    out.push(pockets[(idx + d + n * 4) % n]!);
  }
  return out;
}

export function getNeighborsPackage(
  variant: TableVariant,
  center: string,
  radius: number,
): CallPackage | null {
  const pockets = neighborPockets(variant, center, radius);
  if (!pockets?.length) return null;
  const lines: CallRecipeLine[] = pockets.map((p) => ({ betId: `straight_${p}`, units: 1 }));
  return {
    id: `neighbors_${center}_${Math.floor(radius)}`,
    labelKey: "racetrack.neighbors",
    chipCount: lines.length,
    lines,
    pockets,
    europeanOnly: false,
  };
}

/** Span options: total numbers covered = 2*radius+1 */
export const NEIGHBOR_RADIUS_OPTIONS = [0, 1, 2, 3, 4] as const;
export type NeighborRadius = (typeof NEIGHBOR_RADIUS_OPTIONS)[number];

export function neighborSpan(radius: number): number {
  return 2 * Math.max(0, Math.floor(radius)) + 1;
}

/** Primary French sector for wheel arc painting (jeu zéro sits inside voisins). */
export function sectorForPocket(pocket: string): CallSectorId | null {
  if (SECTOR_POCKETS.voisins.includes(pocket)) return "voisins";
  if (SECTOR_POCKETS.tiers.includes(pocket)) return "tiers";
  if (SECTOR_POCKETS.orphelins.includes(pocket)) return "orphelins";
  return null;
}

export function isFrenchSectorAvailable(variant: TableVariant): boolean {
  return variant === "european";
}
