export type TableVariant = "european" | "american";
export type GameMode = "dealer" | "autoplay";
export type Phase = "PREPARE" | "BETTING_OPEN" | "BETTING_CLOSED" | "SPINNING" | "RESULT" | "PAYOUT" | "GAME_OVER";

export interface BetDefinition {
  id: string;
  type: string;
  pockets: string[];
  multiplier: number;
  family: string;
}

export interface PlacedBet {
  betId: string;
  stake: number;
}

export interface Seat {
  id: string;
  name: string;
  bankroll: number;
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

export interface SessionSnapshot {
  schemaVersion: 1;
  mode: GameMode;
  variant: TableVariant;
  presetId: string;
  phase: Phase;
  level: number;
  energy: number;
  score: number;
  round: number;
  seats: Seat[];
  history: string[];
  animationEnabled: boolean;
  savedAt: string;
}
