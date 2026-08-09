/**
 * Crowd presenter (v0.35) — maps NpcBehavior FSM → arcade clip + seat markup.
 * Pure presentation: no rules or score authority. Hit target stays on the seat
 * element; limbs move only inside .seat-stage (pointer-events: none).
 */
import type { NpcBehaviorSnapshot, NpcBehaviorState } from "./behavior.ts";

/** Arcade motion clip driven by CSS (`data-clip` / `.clip-*`). */
export type CrowdClip =
  | "arrive"
  | "bet"
  | "idle"
  | "cheer"
  | "win"
  | "lose"
  | "selected"
  | "paid"
  | "leave";

export type SeatJuiceKind = "pay" | "wrong" | null;

export interface SeatPresentModel {
  seatId: string;
  name: string;
  profileId: string;
  avatarSeed: number;
  bankrollLabel: string;
  statusLabel: string;
  speech: string;
  /** Unpaid winner in PAYOUT (shows WIN! and is a pay target when interactive). */
  isWinner: boolean;
  isPaid: boolean;
  selected: boolean;
  interactive: boolean;
  behavior: NpcBehaviorSnapshot | null;
  juice: SeatJuiceKind;
  /** Local score pops already formatted as HTML fragments. */
  scorePopsHtml: string;
  winnerMarkerText: string;
  clickAria: string;
  /** Seat index among active seats (0-based) for stagger delay. */
  index: number;
  /**
   * PAYOUT hunt grid: denser tile, less chrome (bankroll/status secondary).
   * Hit target remains the whole seat button (F-NPC-03).
   */
  compact?: boolean;
}

const STATE_TO_CLIP: Record<NpcBehaviorState, CrowdClip> = {
  ARRIVING: "arrive",
  BETTING: "bet",
  WAITING: "idle",
  CHEERING: "cheer",
  WINNER_WAITING: "win",
  LOSER_REACT: "lose",
  SELECTED: "selected",
  PAID: "paid",
  LEAVING: "leave",
};

export function clipForBehavior(behavior: NpcBehaviorSnapshot | null | undefined): CrowdClip {
  if (!behavior) return "idle";
  return STATE_TO_CLIP[behavior.state] ?? "idle";
}

export function behaviorStateClass(behavior: NpcBehaviorSnapshot | null | undefined): string {
  if (!behavior) return "";
  return `npc-state-${behavior.state.toLowerCase().replaceAll("_", "-")}`;
}

/** Stagger delay so the crowd does not move in lockstep (ms). */
export function staggerDelayMs(index: number): number {
  const pattern = [0, 70, 130, 40, 100, 20, 90, 150, 50, 110];
  return pattern[index % pattern.length] ?? 0;
}

function puppetMarkup(seed: number): string {
  const palette = seed % 8;
  const body = seed % 4;
  const acc = seed % 5;
  return `<div class="npc-avatar avatar-${palette} body-${body} acc-${acc}" aria-hidden="true">
    <span class="npc-shadow"></span>
    <div class="npc-puppet">
      <i class="npc-hat"></i>
      <i class="npc-hair"></i>
      <i class="npc-head"><b></b><b></b><em class="npc-mouth"></em></i>
      <i class="npc-arm npc-arm-l"></i>
      <i class="npc-arm npc-arm-r"></i>
      <i class="npc-body"></i>
      <i class="npc-leg npc-leg-l"></i>
      <i class="npc-leg npc-leg-r"></i>
    </div>
  </div>`;
}

/**
 * Build a seat card for the crowd arena.
 * Winner hop / lose slump animate the puppet inside the stage — the seat
 * button geometry stays put (F-NPC-03).
 */
export function renderSeatCard(model: SeatPresentModel): string {
  const clip = clipForBehavior(model.behavior);
  const behaviorClass = behaviorStateClass(model.behavior);
  const revision = model.behavior?.revision ?? 0;
  const juiceClass = model.juice ? `juice-${model.juice}` : "";
  const tag = model.interactive ? "button" : "article";
  const action = model.interactive
    ? ` type="button" data-pay-seat="${model.seatId}" aria-label="${model.clickAria}: ${model.name}"`
    : "";
  const delay = staggerDelayMs(model.index);

  const compactClass = model.compact ? "seat-compact" : "";
  // In dense hunt, keep speech only on winners / paid so tiles stay scannable.
  const showSpeech = model.speech && (!model.compact || model.isWinner || model.isPaid);
  return `<${tag}${action} class="seat seat-arena seat-${model.index + 1} profile-${model.profileId} ${behaviorClass} clip-${clip} ${compactClass} ${model.isWinner ? "winner" : ""} ${model.isPaid ? "paid" : ""} ${model.selected ? "current" : ""} ${juiceClass}" data-clip="${clip}" data-seat-id="${model.seatId}" style="--stagger:${delay}ms">
    ${model.isWinner ? `<span class="winner-marker">${model.winnerMarkerText}</span>` : ""}
    ${showSpeech ? `<span class="npc-balloon" data-revision="${revision}">${model.speech}</span>` : ""}
    ${model.scorePopsHtml ? `<div class="seat-score-pops">${model.scorePopsHtml}</div>` : ""}
    <div class="seat-stage">
      ${puppetMarkup(model.avatarSeed)}
    </div>
    <div class="seat-meta">
      <span class="npc-name">${model.name}</span>
      ${model.compact ? "" : `<strong class="seat-bankroll">${model.bankrollLabel}</strong>`}
      <small class="seat-status">${model.compact && model.isWinner ? model.winnerMarkerText : model.statusLabel}</small>
    </div>
  </${tag}>`;
}
