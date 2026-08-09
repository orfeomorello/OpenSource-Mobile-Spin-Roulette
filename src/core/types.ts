import type { NpcBehaviorSnapshot } from "../npc/behavior.ts";

export type TableVariant = "european" | "american";
export type GameMode = "dealer" | "autoplay" | "player";
/** UI languages — BCP-47-ish codes; pt-BR and zh (Simplified) included. */
export type Locale = "en" | "it" | "es" | "pt-BR" | "fr" | "de" | "ko" | "ja" | "zh";
export type Phase =
  | "PREPARE"
  | "BETTING_OPEN"
  | "BETTING_CLOSED"
  | "SPINNING"
  | "RESULT"
  | "PAYOUT"
  | "GAME_OVER";

export interface BetDefinition {
  id: string;
  type: string;
  pockets: string[];
  multiplier: number;
  family?: string;
  placement?: string;
}

export interface PlacedBet {
  betId: string;
  stake: number;
}

export interface Seat {
  id: string;
  name: string;
  bankroll: number;
  profileId: "cautious" | "normal" | "aggressive" | "superstitious";
  favoritePocket: string;
  avatarSeed: number;
  bets: PlacedBet[];
}

export interface Payment {
  seatId: string;
  seatName: string;
  due: number;
  paid: number;
}

export interface SpinResult {
  winningNumber: string;
  durationMs: number;
  turns: number;
  finalAngle: number;
}

/** Player undo stack: place chip, or move stack between bets. */
export interface PlayerChipAction {
  betId: string;
  denomination: number;
  /** When set, undo reverses a move from this bet. */
  movedFrom?: string;
  /** Groups multi-chip package applies (rebet / strategy / racetrack). */
  batchId?: string;
}

export interface PlayerSettleLine {
  betId: string;
  stake: number;
  won: boolean;
  multiplier: number;
  amountDue: number;
  returned: number;
}

export interface PlayerSettleResult {
  winningNumber: string;
  lines: PlayerSettleLine[];
  totalStaked: number;
  totalReturned: number;
  netDelta: number;
}

/** Session-only Player stats (Profit / W / L / score curve). */
export interface PlayerSessionStats {
  startingScore: number;
  wins: number;
  losses: number;
  bankrollHistory: number[];
}

/**
 * Unified local session snapshot (Dealer v3/v4 · Player v5).
 * Extra fields are optional for mode-specific resume.
 */
export interface SessionSnapshot {
  schemaVersion: number;
  runId: string;
  locale: Locale;
  mode: GameMode;
  variant: TableVariant;
  presetId: string;
  phase: Phase;
  level: number;
  energy: number;
  energyMax?: number;
  serviceScore: {
    points: number;
    comboStep: number;
    walletCreditCommitted: boolean;
  };
  tableLedgerUnits: number;
  round: number;
  seats: Seat[];
  activeSeatCount: number;
  history: string[];
  animationEnabled: boolean;
  savedAt: string;
  result?: string | null;
  message?: string;
  messageParams?: Record<string, string | number>;
  // Dealer mid-round
  payments?: Payment[];
  paymentIndex?: number;
  expectedPayments?: number;
  paidCustomers?: number;
  bettingSeconds?: number;
  payTimeBaseSeconds?: number;
  paySeconds?: number;
  bonus?: string | null;
  payoutHadError?: boolean;
  payoutScoreFinalized?: boolean;
  manualPaidSeatIds?: string[];
  autoPaidSeatIds?: string[];
  npcBehavior?: Record<string, NpcBehaviorSnapshot>;
  // Player
  tableScore?: number;
  selectedChip?: number;
  playerBets?: PlacedBet[];
  chipHistory?: PlayerChipAction[];
  lastSettle?: PlayerSettleResult | null;
  lastBets?: PlacedBet[];
  scenicNpcNames?: string[];
  playerStats?: PlayerSessionStats;
}
