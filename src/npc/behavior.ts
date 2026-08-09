export type NpcBehaviorState =
  | "ARRIVING"
  | "BETTING"
  | "WAITING"
  | "CHEERING"
  | "WINNER_WAITING"
  | "LOSER_REACT"
  | "SELECTED"
  | "PAID"
  | "LEAVING";

export type NpcIntentKey =
  | "greet_table"
  | "place_bet"
  | "wait_result"
  | "cheer_spin"
  | "celebrate_win"
  | "react_loss"
  | "ask_payment"
  | "react_wrong"
  | "thank_dealer"
  | "react_timeout"
  | "leave_table";

export type NpcBehaviorEvent =
  | "BETTING_OPENED"
  | "BETTING_CLOSED"
  | "SPIN_STARTED"
  | "RESULT_WIN"
  | "RESULT_LOSS"
  | "WINNER_SELECTED"
  | "WRONG_SELECTED"
  | "PAID_MANUALLY"
  | "PAID_AUTOMATICALLY"
  | "PAID_AFTER_TIMEOUT"
  | "ROUND_FINISHED"
  | "LEAVE_TABLE";

export interface NpcBehaviorSnapshot {
  state: NpcBehaviorState;
  intentKey: NpcIntentKey | null;
  revision: number;
}

export function createNpcBehavior(): NpcBehaviorSnapshot {
  return { state: "ARRIVING", intentKey: "greet_table", revision: 0 };
}

export function reduceNpcBehavior(current: NpcBehaviorSnapshot, event: NpcBehaviorEvent): NpcBehaviorSnapshot {
  const next = transition[event];
  return { state: next.state, intentKey: next.intentKey, revision: current.revision + 1 };
}

const transition: Record<NpcBehaviorEvent, Pick<NpcBehaviorSnapshot, "state" | "intentKey">> = {
  BETTING_OPENED: { state: "BETTING", intentKey: "place_bet" },
  BETTING_CLOSED: { state: "WAITING", intentKey: "wait_result" },
  SPIN_STARTED: { state: "CHEERING", intentKey: "cheer_spin" },
  RESULT_WIN: { state: "WINNER_WAITING", intentKey: "celebrate_win" },
  RESULT_LOSS: { state: "LOSER_REACT", intentKey: "react_loss" },
  WINNER_SELECTED: { state: "SELECTED", intentKey: "ask_payment" },
  WRONG_SELECTED: { state: "LOSER_REACT", intentKey: "react_wrong" },
  PAID_MANUALLY: { state: "PAID", intentKey: "thank_dealer" },
  PAID_AUTOMATICALLY: { state: "PAID", intentKey: "thank_dealer" },
  PAID_AFTER_TIMEOUT: { state: "PAID", intentKey: "react_timeout" },
  ROUND_FINISHED: { state: "WAITING", intentKey: null },
  LEAVE_TABLE: { state: "LEAVING", intentKey: "leave_table" },
};
