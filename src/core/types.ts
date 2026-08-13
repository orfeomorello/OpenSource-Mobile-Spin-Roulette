export type TableVariant = "european" | "american";
/** UI languages — BCP-47-ish codes; pt-BR and zh (Simplified) included. */
export type Locale = "en" | "it" | "es" | "pt-BR" | "fr" | "de" | "ko" | "ja" | "zh";
export type Phase =
  | "PREPARE"
  | "BETTING_OPEN"
  | "BETTING_CLOSED"
  | "SPINNING"
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

/** Player-only local session snapshot (schema v5). */
export interface SessionSnapshot {
  schemaVersion: 5;
  runId: string;
  locale: Locale;
  mode: "player";
  variant: TableVariant;
  phase: Phase;
  round: number;
  history: string[];
  animationEnabled: boolean;
  savedAt: string;
  result?: string | null;
  message?: string;
  messageParams?: Record<string, string | number>;
  tableScore: number;
  selectedChip?: number;
  playerBets?: PlacedBet[];
  chipHistory?: PlayerChipAction[];
  lastSettle?: PlayerSettleResult | null;
  lastBets?: PlacedBet[];
  playerStats?: PlayerSessionStats;
}
