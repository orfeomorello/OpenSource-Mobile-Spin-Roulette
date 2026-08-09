/**
 * PAYOUT hunt board packer (v0.37) — sparse crossword-like grid.
 * Presentation only: places real seats among non-interactive void pads.
 * Layout is deterministic from seed so re-renders and session resume stay stable.
 */

export type HuntVoidKind = "floor" | "chair" | "chips" | "plant" | "rail";

export type HuntBoardCell =
  | { kind: "seat"; seatIndex: number }
  | { kind: "void"; voidKind: HuntVoidKind; variant: number };

export interface HuntBoard {
  cols: number;
  rows: number;
  cells: HuntBoardCell[];
  /** True when N is small: no (or almost no) voids, simple centered pack. */
  sparse: boolean;
}

const VOID_KINDS: HuntVoidKind[] = ["floor", "chair", "chips", "plant", "rail"];

/** FNV-1a 32-bit — stable across sessions for the same string. */
export function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(items: T[], rng: () => number): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i];
    items[i] = items[j]!;
    items[j] = tmp!;
  }
}

/**
 * Build a hunt board for `seatCount` active customers.
 * - N ≤ 2: compact board, no voids (tutorial / early rounds stay readable).
 * - N ≥ 3: ~35% void pads, shuffled placement, cols 3–6.
 */
export function buildHuntBoard(seatCount: number, seedKey: string): HuntBoard {
  const n = Math.max(0, Math.floor(seatCount));
  if (n === 0) {
    return { cols: 1, rows: 1, cells: [{ kind: "void", voidKind: "floor", variant: 0 }], sparse: false };
  }

  // Tutorial / tiny crowd: no crossword scatter.
  if (n <= 2) {
    return {
      cols: n,
      rows: 1,
      cells: Array.from({ length: n }, (_, seatIndex) => ({ kind: "seat" as const, seatIndex })),
      sparse: false,
    };
  }

  const rng = mulberry32(hashSeed(seedKey));
  // Target fill ~65% seats → voidRatio ~0.35
  const voidRatio = n <= 5 ? 0.28 : n <= 10 ? 0.34 : 0.38;
  const cellCount = Math.max(n + 1, Math.ceil(n / (1 - voidRatio)));
  // 3–5 columns: readable on desktop and still tappable on phones.
  const cols = Math.min(5, Math.max(3, Math.ceil(Math.sqrt(cellCount))));
  const rows = Math.ceil(cellCount / cols);
  const total = cols * rows;
  const voidCount = total - n;

  const cells: HuntBoardCell[] = [];
  for (let seatIndex = 0; seatIndex < n; seatIndex += 1) {
    cells.push({ kind: "seat", seatIndex });
  }
  for (let v = 0; v < voidCount; v += 1) {
    cells.push({
      kind: "void",
      voidKind: VOID_KINDS[Math.floor(rng() * VOID_KINDS.length)]!,
      variant: Math.floor(rng() * 4),
    });
  }
  // Pad if total > n + voidCount due to rectangle (should match).
  while (cells.length < total) {
    cells.push({
      kind: "void",
      voidKind: VOID_KINDS[Math.floor(rng() * VOID_KINDS.length)]!,
      variant: Math.floor(rng() * 4),
    });
  }
  if (cells.length > total) cells.length = total;

  shuffleInPlace(cells, rng);

  return { cols, rows, cells, sparse: true };
}

export function huntSeedKey(runId: string, round: number, seatCount: number): string {
  return `${runId}|r${round}|n${seatCount}`;
}

/** CSS class list for the board container. */
export function huntBoardClassList(board: HuntBoard, seatCount: number): string {
  // hunt-1 / hunt-few: solid centered cards. mid+: sparse crossword board.
  const size =
    seatCount <= 1 ? "hunt-1 hunt-few"
    : seatCount === 2 ? "hunt-2 hunt-few"
    : seatCount <= 4 ? "hunt-mid"
    : seatCount <= 7 ? "hunt-mid"
    : seatCount <= 13 ? "crowd-dense"
    : "crowd-swarm";
  const sparse = board.sparse ? "hunt-sparse" : "hunt-solid";
  return `seats crowd-arena hunt-grid hunt-board ${sparse} crowd-${seatCount} ${size} phase-payout`;
}

export function renderHuntVoidCell(cell: Extract<HuntBoardCell, { kind: "void" }>, index: number): string {
  return `<div class="hunt-void void-${cell.voidKind} void-v${cell.variant}" data-void="${cell.voidKind}" aria-hidden="true" style="--void-i:${index}">
    <span class="hunt-void-inner"></span>
  </div>`;
}
