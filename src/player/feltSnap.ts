/**
 * Magnetic snap: pointer position on a felt cell → best betId (straight / split / corner / street / sixline / zero-edge).
 * Pure — no DOM. Used by Player + Bet Creator presenters.
 */
import type { TableVariant } from "../core/types.ts";

export type FeltSnapKind =
  | "straight"
  | "split"
  | "corner"
  | "street"
  | "sixLine"
  | "trio"
  | "firstFour"
  | "fiveNumber"
  | "outside";

export interface FeltSnapResult {
  betId: string;
  kind: FeltSnapKind;
  /** Anchor in cell local 0–1 space (for guide placement). */
  anchorX: number;
  anchorY: number;
}

interface Anchor {
  betId: string;
  kind: FeltSnapKind;
  x: number;
  y: number;
  /** Lower = preferred when distances similar. */
  weight?: number;
}

function pocketAt(col: number, row: number): number {
  return (col + 1) * 3 - row;
}

function splitId(a: number, b: number): string {
  return `split_${Math.min(a, b)}_${Math.max(a, b)}`;
}

function cornerId(col: number, row: number): string {
  const r = col + 1;
  const c = 2 - row;
  const cell = (rr: number, cc: number) => (rr - 1) * 3 + cc;
  const p = [cell(r, c), cell(r, c + 1), cell(r + 1, c), cell(r + 1, c + 1)];
  return `corner_${p.join("_")}`;
}

function streetId(col: number): string {
  const a = col * 3 + 1;
  return `street_${a}_${a + 1}_${a + 2}`;
}

function sixlineId(col: number): string {
  return `sixline_${col * 3 + 1}_${(col + 1) * 3 + 3}`;
}

function pickNearest(lx: number, ly: number, anchors: Anchor[]): FeltSnapResult {
  let best = anchors[0]!;
  let bestScore = Infinity;
  for (const a of anchors) {
    const dx = lx - a.x;
    const dy = ly - a.y;
    const dist = Math.hypot(dx, dy) * (a.weight ?? 1);
    if (dist < bestScore) {
      bestScore = dist;
      best = a;
    }
  }
  return { betId: best.betId, kind: best.kind, anchorX: best.x, anchorY: best.y };
}

/**
 * Corners need a real touch target, not only a nearest-point calculation.
 * Roughly one third of each cell edge is magnetic: on a portrait phone this
 * gives an intersection a finger-sized target while leaving the centre and
 * single-edge bands available for straight and split bets.
 */
function pickMagneticCorner(col: number, row: number, lx: number, ly: number): FeltSnapResult | null {
  const band = 0.32;
  const nearLeft = lx <= band;
  const nearRight = lx >= 1 - band;
  const nearTop = ly <= band;
  const nearBottom = ly >= 1 - band;

  if (nearLeft && nearTop && col > 0 && row > 0) {
    return { betId: cornerId(col - 1, row - 1), kind: "corner", anchorX: 0, anchorY: 0 };
  }
  if (nearRight && nearTop && col < 11 && row > 0) {
    return { betId: cornerId(col, row - 1), kind: "corner", anchorX: 1, anchorY: 0 };
  }
  if (nearLeft && nearBottom && col > 0 && row < 2) {
    return { betId: cornerId(col - 1, row), kind: "corner", anchorX: 0, anchorY: 1 };
  }
  if (nearRight && nearBottom && col < 11 && row < 2) {
    return { betId: cornerId(col, row), kind: "corner", anchorX: 1, anchorY: 1 };
  }
  return null;
}

/** Number grid cell (col 0–11, row 0–2). lx/ly in 0–1 relative to cell. */
export function resolveNumberCellSnap(
  col: number,
  row: number,
  lx: number,
  ly: number,
  variant: TableVariant = "european",
): FeltSnapResult {
  const clampedX = Math.min(1, Math.max(0, lx));
  const clampedY = Math.min(1, Math.max(0, ly));
  const magneticCorner = pickMagneticCorner(col, row, clampedX, clampedY);
  if (magneticCorner) return magneticCorner;

  const n = pocketAt(col, row);
  const anchors: Anchor[] = [
    { betId: `straight_${n}`, kind: "straight", x: 0.5, y: 0.5, weight: 1.05 },
  ];
  if (col < 11) {
    const right = pocketAt(col + 1, row);
    anchors.push({ betId: splitId(n, right), kind: "split", x: 1, y: 0.5, weight: 0.92 });
  }
  if (row < 2) {
    const down = pocketAt(col, row + 1);
    anchors.push({ betId: splitId(n, down), kind: "split", x: 0.5, y: 1, weight: 0.92 });
  }
  if (col < 11 && row < 2) {
    anchors.push({ betId: cornerId(col, row), kind: "corner", x: 1, y: 1, weight: 0.88 });
  }
  if (row === 2) {
    anchors.push({ betId: streetId(col), kind: "street", x: 0.5, y: 1, weight: 0.9 });
    if (col < 11) {
      anchors.push({ betId: sixlineId(col), kind: "sixLine", x: 1, y: 1, weight: 0.86 });
    }
  }
  if (col > 0 && row < 2) {
    anchors.push({ betId: cornerId(col - 1, row), kind: "corner", x: 0, y: 1, weight: 0.9 });
  }
  if (col < 11 && row > 0) {
    anchors.push({ betId: cornerId(col, row - 1), kind: "corner", x: 1, y: 0, weight: 0.9 });
  }
  if (col > 0 && row > 0) {
    anchors.push({ betId: cornerId(col - 1, row - 1), kind: "corner", x: 0, y: 0, weight: 0.9 });
  }
  if (col > 0) {
    const left = pocketAt(col - 1, row);
    anchors.push({ betId: splitId(n, left), kind: "split", x: 0, y: 0.5, weight: 0.94 });
  }
  if (row > 0) {
    const up = pocketAt(col, row - 1);
    anchors.push({ betId: splitId(n, up), kind: "split", x: 0.5, y: 0, weight: 0.94 });
  }
  if (row === 2 && col > 0) {
    anchors.push({ betId: sixlineId(col - 1), kind: "sixLine", x: 0, y: 1, weight: 0.88 });
  }

  // Col 0 abuts zero — left edge toward zero-family bets.
  if (col === 0) {
    if (n === 1 || n === 2 || n === 3) {
      anchors.push({ betId: splitId(0, n), kind: "split", x: 0, y: 0.5, weight: 0.9 });
    }
    if (variant === "european" && (n === 1 || n === 3)) {
      // Outer corners 0–1 / 0–3 → first four (not mid 0–2)
      anchors.push({
        betId: "first_four_0_1_2_3",
        kind: "firstFour",
        x: 0,
        y: n === 1 ? 1 : 0,
        weight: 0.78,
      });
    }
    if (variant === "american" && (n === 1 || n === 2 || n === 3)) {
      anchors.push({
        betId: "five_number_0_00_1_2_3",
        kind: "fiveNumber",
        x: 0,
        y: n === 1 ? 1 : n === 3 ? 0 : 0.5,
        weight: 0.8,
      });
    }
  }

  return pickNearest(clampedX, clampedY, anchors);
}

/**
 * European zero cell.
 * First four (0-1-2-3) sits on the *outer* corners shared by 0–1 or 0–3
 * (classic table: corner of zero next to the 1-2-3 street / first dozen rail) —
 * NOT in the middle of the 0|2 edge (that is split 0-2).
 */
export function resolveEuropeanZeroSnap(lx: number, ly: number): FeltSnapResult {
  const anchors: Anchor[] = [
    { betId: "straight_0", kind: "straight", x: 0.38, y: 0.5, weight: 1.1 },
    // Splits along the 0|street edge (right side)
    { betId: "split_0_3", kind: "split", x: 0.92, y: 0.1, weight: 0.92 },
    { betId: "split_0_2", kind: "split", x: 0.92, y: 0.5, weight: 0.92 },
    { betId: "split_0_1", kind: "split", x: 0.92, y: 0.9, weight: 0.92 },
    // Trios at junctions between those splits
    { betId: "trio_0_2_3", kind: "trio", x: 0.96, y: 0.28, weight: 0.86 },
    { betId: "trio_0_1_2", kind: "trio", x: 0.96, y: 0.72, weight: 0.86 },
    // First four = outer corners (0-1 and 0-3), also toward first-dozen rail (bottom outer)
    { betId: "first_four_0_1_2_3", kind: "firstFour", x: 1, y: 1, weight: 0.78 },
    { betId: "first_four_0_1_2_3", kind: "firstFour", x: 1, y: 0, weight: 0.78 },
    { betId: "first_four_0_1_2_3", kind: "firstFour", x: 0.85, y: 1, weight: 0.8 },
  ];
  return pickNearest(Math.min(1, Math.max(0, lx)), Math.min(1, Math.max(0, ly)), anchors);
}

/** American 0 cell (top stack). Five-number top line at outer junction with 1-2-3. */
export function resolveAmericanZeroSnap(lx: number, ly: number): FeltSnapResult {
  const anchors: Anchor[] = [
    { betId: "straight_0", kind: "straight", x: 0.38, y: 0.5, weight: 1.1 },
    { betId: "split_0_2", kind: "split", x: 0.92, y: 0.22, weight: 0.92 },
    { betId: "split_0_1", kind: "split", x: 0.92, y: 0.82, weight: 0.92 },
    { betId: "split_0_00", kind: "split", x: 0.5, y: 1, weight: 0.88 },
    { betId: "trio_0_1_2", kind: "trio", x: 0.96, y: 0.55, weight: 0.86 },
    // Top line 0-00-1-2-3 on outer corner toward the street (not mid-circle)
    { betId: "five_number_0_00_1_2_3", kind: "fiveNumber", x: 1, y: 1, weight: 0.78 },
    { betId: "five_number_0_00_1_2_3", kind: "fiveNumber", x: 1, y: 0, weight: 0.82 },
  ];
  return pickNearest(Math.min(1, Math.max(0, lx)), Math.min(1, Math.max(0, ly)), anchors);
}

/** American 00 cell (bottom stack). */
export function resolveAmericanDoubleZeroSnap(lx: number, ly: number): FeltSnapResult {
  const anchors: Anchor[] = [
    { betId: "straight_00", kind: "straight", x: 0.38, y: 0.5, weight: 1.1 },
    { betId: "split_00_3", kind: "split", x: 0.92, y: 0.22, weight: 0.92 },
    { betId: "split_00_2", kind: "split", x: 0.92, y: 0.82, weight: 0.92 },
    { betId: "split_0_00", kind: "split", x: 0.5, y: 0, weight: 0.88 },
    { betId: "trio_00_2_3", kind: "trio", x: 0.96, y: 0.4, weight: 0.86 },
    { betId: "five_number_0_00_1_2_3", kind: "fiveNumber", x: 1, y: 0, weight: 0.78 },
    { betId: "five_number_0_00_1_2_3", kind: "fiveNumber", x: 1, y: 1, weight: 0.82 },
  ];
  return pickNearest(Math.min(1, Math.max(0, lx)), Math.min(1, Math.max(0, ly)), anchors);
}

export function resolveZeroSnap(variant: TableVariant, pocket: "0" | "00", lx: number, ly: number): FeltSnapResult {
  if (variant === "american" && pocket === "00") return resolveAmericanDoubleZeroSnap(lx, ly);
  if (variant === "american") return resolveAmericanZeroSnap(lx, ly);
  return resolveEuropeanZeroSnap(lx, ly);
}

/** Human-readable kind key for i18n (`player.snap.*`). */
export function snapKindLabelKey(kind: FeltSnapKind): string {
  return `player.snap.${kind}`;
}
