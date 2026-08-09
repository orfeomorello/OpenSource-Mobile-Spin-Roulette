import balanceConfig from "../../config/game-balance.json" with { type: "json" };
import npcConfig from "../../config/npc-ai.json" with { type: "json" };
import europeanBets from "../../config/bets-european.json" with { type: "json" };
import americanBets from "../../config/bets-american.json" with { type: "json" };
import { createNpcBehavior, reduceNpcBehavior, type NpcBehaviorEvent, type NpcBehaviorSnapshot } from "../npc/behavior.ts";
import { isLocale } from "../i18n/localeMeta.ts";
import type { BetDefinition, GameMode, Locale, Payment, Phase, Seat, SessionSnapshot, TableVariant } from "./types.ts";

type PresetId = keyof typeof balanceConfig.presets;
type Preset = (typeof balanceConfig.presets)[PresetId];

export type ScoreReason = "seat-complete" | "wrong-player" | "perfect-service" | "speed-bonus" | "timeout";
export type SelectPaymentOutcome = "selected" | "wrong-player" | "invalid";

export interface ScoreEvent {
  delta: number;
  reason: ScoreReason;
  seatId?: string;
}

export interface GameState {
  runId: string;
  locale: Locale;
  mode: GameMode;
  variant: TableVariant;
  presetId: PresetId;
  phase: Phase;
  level: number;
  energy: number;
  energyMax: number;
  serviceScore: number;
  serviceComboStep: number;
  tableLedgerUnits: number;
  walletCreditCommitted: boolean;
  round: number;
  seats: Seat[];
  activeSeatCount: number;
  payments: Payment[];
  paymentIndex: number;
  expectedPayments: number;
  paidCustomers: number;
  history: string[];
  result: string | null;
  message: string;
  messageParams: Record<string, string | number>;
  bonus: string | null;
  animationEnabled: boolean;
  bettingSeconds: number;
  /** Runtime PAYOUT base seconds (starts from preset; level-ups may reduce it). */
  payTimeBaseSeconds: number;
  paySeconds: number;
  payoutHadError: boolean;
  payoutScoreFinalized: boolean;
  manualPaidSeatIds: string[];
  autoPaidSeatIds: string[];
  scoreEvents: ScoreEvent[];
  npcBehavior: Record<string, NpcBehaviorSnapshot>;
}

type NpcProfileId = Seat["profileId"];
interface NpcProfile {
  weight: number;
  stakeMultipleScale: number;
  familyBias: Record<string, number>;
  repeatFavoriteChance?: number;
}
const profiles = npcConfig.profiles as Record<NpcProfileId, NpcProfile>;
const profileIds = Object.keys(profiles) as NpcProfileId[];
const familyWeights = npcConfig.betFamilyBaseWeights as unknown as Record<string, { weight: number }>;
const stakeMultiples = npcConfig.stake.multiplesOfTableChip;
const stakeWeights = npcConfig.stake.multipleWeights;
const names = npcConfig.names.pool;

export function getPreset(id: string): Preset {
  return balanceConfig.presets[(id in balanceConfig.presets ? id : balanceConfig.defaultPresetId) as PresetId];
}

export function createGame(
  mode: GameMode,
  presetId: string,
  variant: TableVariant,
  animationEnabled: boolean,
  rng: () => number = Math.random,
  locale: Locale = "en",
): GameState {
  const preset = getPreset(presetId);
  const seats: Seat[] = Array.from({ length: preset.playerCount }, (_, index) => {
    const range = npcConfig.bankrollByPreset[preset.id as PresetId];
    const bankroll = Math.round((range.min + rng() * (range.max - range.min)) / preset.chipValue) * preset.chipValue;
    const profileId = pickProfile(rng);
    const favoritePool = variant === "american"
      ? ["0", "00", ...Array.from({ length: 36 }, (_, pocket) => String(pocket + 1))]
      : ["0", ...Array.from({ length: 36 }, (_, pocket) => String(pocket + 1))];
    return {
      id: `seat-${index + 1}`,
      name: names[index % names.length],
      bankroll,
      bets: [],
      profileId,
      favoritePocket: favoritePool[Math.floor(rng() * favoritePool.length)],
      avatarSeed: index % 16,
    };
  });
  const runId = `${mode}-${Date.now().toString(36)}-${Math.floor(rng() * 0xfffffff).toString(36).padStart(6, "0")}`;
  return {
    runId,
    locale,
    mode,
    variant,
    presetId: preset.id as PresetId,
    phase: "PREPARE",
    level: preset.startLevel,
    energy: preset.energyStart,
    energyMax: preset.energyMax,
    serviceScore: 0,
    serviceComboStep: 0,
    tableLedgerUnits: 0,
    walletCreditCommitted: false,
    round: 0,
    seats,
    activeSeatCount: balanceConfig.automaticFlow.firstRoundSeatCount,
    payments: [],
    paymentIndex: -1,
    expectedPayments: 0,
    paidCustomers: 0,
    history: [],
    result: null,
    message: "message.welcome",
    messageParams: {},
    bonus: null,
    animationEnabled,
    bettingSeconds: balanceConfig.automaticFlow.bettingSeconds,
    payTimeBaseSeconds: preset.payTimeBaseSeconds,
    paySeconds: preset.payTimeBaseSeconds,
    payoutHadError: false,
    payoutScoreFinalized: false,
    manualPaidSeatIds: [],
    autoPaidSeatIds: [],
    scoreEvents: [],
    npcBehavior: Object.fromEntries(seats.map((seat) => [seat.id, createNpcBehavior()])),
  };
}

export function getActiveSeats(state: GameState): Seat[] {
  return state.seats.slice(0, state.activeSeatCount);
}

export function getForcedWinningNumber(state: GameState): string | null {
  if (!balanceConfig.automaticFlow.firstRoundGuaranteedWinner || state.round !== 1) return null;
  return getActiveSeats(state)[0]?.favoritePocket ?? null;
}

export function openBetting(state: GameState, rng: () => number = Math.random): void {
  state.phase = "BETTING_OPEN";
  state.round += 1;
  const flow = balanceConfig.automaticFlow;
  const growthSteps = Math.floor((state.round - 1) / Math.max(1, flow.roundsPerAdditionalSeat));
  const seatsPerStep = Math.max(1, (flow as { seatsAddedPerStep?: number }).seatsAddedPerStep ?? 1);
  state.activeSeatCount = Math.min(
    state.seats.length,
    flow.firstRoundSeatCount + growthSteps * seatsPerStep,
  );
  state.result = null;
  state.bonus = null;
  state.message = state.round === 1 ? "message.tutorialBetting" : "message.betsAutomatic";
  state.messageParams = {};
  state.bettingSeconds = balanceConfig.automaticFlow.bettingSeconds;
  state.seats.forEach((seat, index) => {
    if (index >= state.activeSeatCount) {
      seat.bets = [];
      return;
    }
    transitionSeat(state, seat.id, seat.bankroll > 0 ? "BETTING_OPENED" : "LEAVE_TABLE");
  });
  placeNpcBets(state, rng);
}

export function closeBets(state: GameState): boolean {
  if (state.phase !== "BETTING_OPEN") return false;
  state.phase = "BETTING_CLOSED";
  state.message = "message.noMoreBetsAutomatic";
  state.messageParams = {};
  getActiveSeats(state).forEach((seat) => transitionSeat(state, seat.id, "BETTING_CLOSED"));
  return true;
}

export function markSpinning(state: GameState): boolean {
  if (state.phase !== "BETTING_CLOSED") return false;
  state.phase = "SPINNING";
  state.message = "message.spinningAutomatic";
  state.messageParams = {};
  getActiveSeats(state).forEach((seat) => transitionSeat(state, seat.id, "SPIN_STARTED"));
  return true;
}

export function resolveSpin(state: GameState, winningNumber: string, rng: () => number = Math.random): void {
  state.phase = "RESULT";
  state.result = winningNumber;
  state.history.unshift(winningNumber);
  state.history = state.history.slice(0, 60);
  state.message = "message.settle";
  state.messageParams = { number: winningNumber };
  settleBets(state);
  startPayout(state, rng);
}

function catalogFor(variant: TableVariant): BetDefinition[] {
  return (variant === "european" ? europeanBets.bets : americanBets.bets) as BetDefinition[];
}

function placeNpcBets(state: GameState, rng: () => number): void {
  const preset = getPreset(state.presetId);
  const catalog = catalogFor(state.variant);
  for (const seat of getActiveSeats(state)) {
    seat.bets = [];
    if (seat.bankroll <= 0) continue;
    if (state.round === 1 && seat === getActiveSeats(state)[0]) {
      const tutorialBet = catalog.find((item) => item.id === `straight_${seat.favoritePocket}`);
      const stake = Math.min(preset.chipValue, seat.bankroll);
      if (tutorialBet && stake > 0) seat.bets = [{ betId: tutorialBet.id, stake }];
      continue;
    }
    const profile = profiles[seat.profileId];
    const roll = rng();
    let count = roll < 0.1 ? 0 : roll < 0.55 ? 1 : roll < 0.85 ? 2 : 3;
    if (seat.profileId === "cautious") count = Math.min(1, count);
    if (seat.profileId === "aggressive" && count > 0) count = Math.max(2, count);
    for (let i = 0; i < count; i += 1) {
      const favorite = catalog.find((item) => item.id === `straight_${seat.favoritePocket}`);
      const bet = seat.profileId === "superstitious" && favorite && rng() < (profile.repeatFavoriteChance ?? 0)
        ? favorite
        : chooseBet(catalog, profile, rng);
      const maxStake = Math.max(0, Math.floor(seat.bankroll * npcConfig.stake.maxStakeFractionOfBankroll / preset.chipValue) * preset.chipValue);
      const multiple = weightedChoice(stakeMultiples, stakeWeights, rng);
      const scaledMultiple = Math.max(1, Math.round(multiple * profile.stakeMultipleScale));
      const stake = Math.min(preset.chipValue * scaledMultiple, maxStake, seat.bankroll - seat.bets.reduce((sum, item) => sum + item.stake, 0));
      if (stake > 0) seat.bets.push({ betId: bet.id, stake });
    }
  }
}

function pickProfile(rng: () => number): NpcProfileId {
  return weightedChoice(profileIds, profileIds.map((id) => profiles[id].weight), rng);
}

function chooseBet(catalog: BetDefinition[], profile: NpcProfile, rng: () => number): BetDefinition {
  const availableFamilies = Object.keys(familyWeights).filter((family) => catalog.some((bet) => bet.family === family));
  const family = weightedChoice(
    availableFamilies,
    availableFamilies.map((id) => familyWeights[id].weight * (profile.familyBias[id] ?? 1)),
    rng,
  );
  const familyBets = catalog.filter((bet) => bet.family === family);
  return familyBets[Math.floor(rng() * familyBets.length)] ?? catalog[Math.floor(rng() * catalog.length)];
}

function weightedChoice<T>(items: readonly T[], weights: readonly number[], rng: () => number): T {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (total <= 0) return items[0];
  let target = rng() * total;
  for (let index = 0; index < items.length; index += 1) {
    target -= Math.max(0, weights[index] ?? 0);
    if (target <= 0) return items[index];
  }
  return items[items.length - 1];
}

export function selectPayment(state: GameState, seatId: string): SelectPaymentOutcome {
  if (state.phase !== "PAYOUT") return "invalid";
  const seat = state.seats.find((item) => item.id === seatId);
  if (!seat) return "invalid";
  const index = state.payments.findIndex((payment) => payment.seatId === seatId && payment.paid < payment.due);
  if (index >= 0) {
    const previous = state.payments[state.paymentIndex];
    if (previous && previous.seatId !== seatId && previous.paid < previous.due) transitionSeat(state, previous.seatId, "RESULT_WIN");
    state.paymentIndex = index;
    state.message = "message.selectedWinner";
    state.messageParams = { name: state.payments[index].seatName };
    transitionSeat(state, seatId, "WINNER_SELECTED");
    return "selected";
  }
  if (!state.payments.some((payment) => payment.seatId === seatId)) {
    const previous = state.payments[state.paymentIndex];
    if (previous && previous.paid < previous.due) transitionSeat(state, previous.seatId, "RESULT_WIN");
    state.paymentIndex = -1;
    state.payoutHadError = true;
    state.serviceComboStep = 0;
    changeScore(state, -balanceConfig.serviceScore.wrongPlayerPenalty, "wrong-player", seatId);
    state.message = "message.wrongPlayer";
    state.messageParams = { name: seat.name };
    transitionSeat(state, seatId, "WRONG_SELECTED");
    return "wrong-player";
  }
  return "invalid";
}

function settleBets(state: GameState): void {
  const result = state.result;
  if (!result) return;
  const byId = new Map(catalogFor(state.variant).map((bet) => [bet.id, bet]));
  state.payments = [];
  for (const seat of getActiveSeats(state)) {
    let due = 0;
    for (const placed of seat.bets) {
      const definition = byId.get(placed.betId);
      if (!definition) continue;
      seat.bankroll -= placed.stake;
      if (definition.pockets.includes(result)) {
        seat.bankroll += placed.stake;
        due += placed.stake * definition.multiplier;
      } else {
        state.tableLedgerUnits += placed.stake;
      }
    }
    if (due > 0) state.payments.push({ seatId: seat.id, seatName: seat.name, due, paid: 0 });
  }
}

function startPayout(state: GameState, rng: () => number): void {
  state.phase = "PAYOUT";
  state.paymentIndex = -1;
  state.paidCustomers = 0;
  state.payoutHadError = false;
  state.payoutScoreFinalized = false;
  state.manualPaidSeatIds = [];
  state.autoPaidSeatIds = [];
  state.expectedPayments = state.payments.length;
  // Base may have been tightened by level-ups; winner bonus is intentionally modest so multi-WIN still pressure.
  state.paySeconds = Math.max(
    balanceConfig.payTime.minSeconds,
    state.payTimeBaseSeconds + balanceConfig.payTime.winnerBonusSecondsPerWinner * state.expectedPayments,
    state.round === 1 ? balanceConfig.automaticFlow.firstRoundPaySeconds : 0,
  );
  const winningIds = new Set(state.payments.map((payment) => payment.seatId));
  getActiveSeats(state).forEach((seat) => transitionSeat(state, seat.id, winningIds.has(seat.id) ? "RESULT_WIN" : "RESULT_LOSS"));
  rollBonus(state, rng);
  state.message = state.payments.length
    ? state.round === 1 ? "message.tutorialPay" : "message.clickWinners"
    : "message.noWinners";
  state.messageParams = {};
}

function rollBonus(state: GameState, rng: () => number): void {
  const preset = getPreset(state.presetId);
  if (rng() >= preset.bonusChance) return;
  if (state.round === 1) return;
  const roll = rng();
  if (roll < 0.4 && state.payments.length) {
    const payment = state.payments[0];
    applyPayment(state, payment, payment.due, "auto");
    state.paymentIndex = -1;
    state.bonus = "bonus.quickPay";
  } else if (roll < 0.75) {
    state.paySeconds += 5;
    state.bonus = "bonus.time";
  } else if (state.energy < state.energyMax) {
    state.energy += 1;
    state.bonus = "bonus.energy";
  } else {
    state.paySeconds += 5;
    state.bonus = "bonus.time";
  }
}

function applyPayment(state: GameState, payment: Payment, amount: number, source: "manual" | "auto" | "timeout"): void {
  payment.paid += amount;
  const seat = state.seats.find((item) => item.id === payment.seatId);
  if (seat) seat.bankroll += amount;
  state.tableLedgerUnits -= amount;
  if (payment.paid < payment.due) return;
  if (source === "manual") transitionSeat(state, payment.seatId, "PAID_MANUALLY");
  if (source === "auto") {
    if (!state.autoPaidSeatIds.includes(payment.seatId)) state.autoPaidSeatIds.push(payment.seatId);
    transitionSeat(state, payment.seatId, "PAID_AUTOMATICALLY");
  }
  if (source === "timeout") {
    if (!state.autoPaidSeatIds.includes(payment.seatId)) state.autoPaidSeatIds.push(payment.seatId);
    transitionSeat(state, payment.seatId, "PAID_AFTER_TIMEOUT");
  }
}

export type DirectPayOutcome = "seat-complete" | "complete" | "wrong-player" | "overpay" | "invalid";

export function paySeat(state: GameState, seatId: string): DirectPayOutcome {
  const selected = selectPayment(state, seatId);
  if (selected === "wrong-player" || selected === "invalid") return selected;
  return pay(state);
}

export function pay(state: GameState): Exclude<DirectPayOutcome, "wrong-player"> {
  if (state.phase !== "PAYOUT") return "invalid";
  const payment = state.payments[state.paymentIndex];
  if (!payment) {
    if (state.payments.every((item) => item.paid >= item.due)) {
      finalizePayoutScore(state);
      return "complete";
    }
    state.message = "message.clickWinner";
    state.messageParams = {};
    return "invalid";
  }
  if (payment.paid >= payment.due) {
    state.payoutHadError = true;
    state.serviceComboStep = 0;
    penalizeEnergy(state, "message.overpay", balanceConfig.accounting.overpayEnergyPenalty);
    return "overpay";
  }

  applyPayment(state, payment, payment.due - payment.paid, "manual");
  state.paidCustomers += 1;
  if (!state.manualPaidSeatIds.includes(payment.seatId)) {
    state.manualPaidSeatIds.push(payment.seatId);
    const comboPoints = balanceConfig.serviceScore.seatCompleteComboPoints[
      Math.min(state.serviceComboStep, balanceConfig.serviceScore.seatCompleteComboPoints.length - 1)
    ];
    state.serviceComboStep = Math.min(state.serviceComboStep + 1, balanceConfig.serviceScore.seatCompleteComboPoints.length - 1);
    changeScore(state, comboPoints, "seat-complete", payment.seatId);
  }
  if (state.payments.every((item) => item.paid >= item.due)) {
    finalizePayoutScore(state);
    state.message = "message.perfectPay";
    state.messageParams = {};
    return "complete";
  }
  state.paymentIndex = -1;
  state.message = "message.customerPaid";
  state.messageParams = { name: payment.seatName };
  return "seat-complete";
}

function finalizePayoutScore(state: GameState): void {
  if (state.payoutScoreFinalized) return;
  state.payoutScoreFinalized = true;
  const everyWinnerWasManual = state.payments.length > 0
    && state.payments.every((payment) => state.manualPaidSeatIds.includes(payment.seatId));
  if (!everyWinnerWasManual || state.payoutHadError) return;
  changeScore(state, balanceConfig.serviceScore.perfectServiceBonus, "perfect-service");
  const speed = Math.max(0, Math.floor(state.paySeconds)) * balanceConfig.serviceScore.speedPointsPerWholeSecond;
  if (speed > 0) changeScore(state, speed, "speed-bonus");
}

export function payoutTimeout(state: GameState): void {
  if (state.phase !== "PAYOUT" || state.payments.every((payment) => payment.paid >= payment.due)) return;
  state.payoutHadError = true;
  state.payoutScoreFinalized = true;
  state.serviceComboStep = 0;
  const scorePenalty = balanceConfig.serviceScore.timeoutScorePenalty;
  if (scorePenalty > 0) changeScore(state, -scorePenalty, "timeout");
  for (const payment of state.payments) {
    if (payment.paid >= payment.due) continue;
    applyPayment(state, payment, payment.due - payment.paid, "timeout");
  }
  state.paymentIndex = -1;
  penalizeEnergy(state, "message.tooSlow", balanceConfig.accounting.timeoutEnergyPenalty);
}

function changeScore(state: GameState, delta: number, reason: ScoreReason, seatId?: string): void {
  const next = Math.max(balanceConfig.serviceScore.minPoints, state.serviceScore + delta);
  const appliedDelta = next - state.serviceScore;
  state.serviceScore = next;
  if (delta !== 0) state.scoreEvents.push({ delta: appliedDelta || delta, reason, seatId });
}

function penalizeEnergy(state: GameState, message: string, amount: number): void {
  state.message = message;
  state.messageParams = {};
  if (state.mode === "dealer") {
    state.energy = Math.max(0, state.energy - amount);
    if (state.energy === 0) state.phase = "GAME_OVER";
  }
}

function transitionSeat(state: GameState, seatId: string, event: NpcBehaviorEvent): void {
  const current = state.npcBehavior[seatId] ?? createNpcBehavior();
  state.npcBehavior[seatId] = reduceNpcBehavior(current, event);
}

export function finishRound(state: GameState): void {
  if (state.phase === "GAME_OVER") return;
  const preset = getPreset(state.presetId);
  if (state.round % preset.roundsPerLevelUp === 0 && state.level < preset.maxLevel) {
    state.level += 1;
    applyLevelUpPressure(state);
  }
  getActiveSeats(state).forEach((seat) => transitionSeat(state, seat.id, seat.bankroll > 0 ? "ROUND_FINISHED" : "LEAVE_TABLE"));
  state.phase = "PREPARE";
  state.message = "message.preparing";
  state.messageParams = {};
}

/** Soft hunt pressure on level-up — never touches pocket/SpinEngine. */
function applyLevelUpPressure(state: GameState): void {
  const effects = balanceConfig.levelUpEffects as {
    payTimeSoftDownSeconds?: number;
    payTimeBaseFloorSeconds?: number;
  };
  const down = Math.max(0, effects.payTimeSoftDownSeconds ?? 0.5);
  const floor = Math.max(
    balanceConfig.payTime.minSeconds,
    effects.payTimeBaseFloorSeconds ?? balanceConfig.payTime.minSeconds,
  );
  if (down > 0) state.payTimeBaseSeconds = Math.max(floor, state.payTimeBaseSeconds - down);
}

export function snapshot(state: GameState): SessionSnapshot {
  return {
    schemaVersion: 4,
    runId: state.runId,
    locale: state.locale,
    mode: state.mode,
    variant: state.variant,
    presetId: state.presetId,
    phase: state.phase,
    level: state.level,
    energy: state.energy,
    energyMax: state.energyMax,
    serviceScore: {
      points: state.serviceScore,
      comboStep: state.serviceComboStep,
      walletCreditCommitted: state.walletCreditCommitted,
    },
    tableLedgerUnits: state.tableLedgerUnits,
    round: state.round,
    seats: structuredClone(state.seats),
    activeSeatCount: state.activeSeatCount,
    history: [...state.history],
    animationEnabled: state.animationEnabled,
    savedAt: new Date().toISOString(),
    result: state.result,
    payments: structuredClone(state.payments),
    paymentIndex: state.paymentIndex,
    expectedPayments: state.expectedPayments,
    paidCustomers: state.paidCustomers,
    bettingSeconds: state.bettingSeconds,
    payTimeBaseSeconds: state.payTimeBaseSeconds,
    paySeconds: state.paySeconds,
    bonus: state.bonus,
    message: state.message,
    messageParams: { ...state.messageParams },
    payoutHadError: state.payoutHadError,
    payoutScoreFinalized: state.payoutScoreFinalized,
    manualPaidSeatIds: [...state.manualPaidSeatIds],
    autoPaidSeatIds: [...state.autoPaidSeatIds],
    npcBehavior: structuredClone(state.npcBehavior),
  };
}

function isSeat(value: unknown): value is Seat {
  if (!value || typeof value !== "object") return false;
  const seat = value as Seat;
  return typeof seat.id === "string"
    && typeof seat.name === "string"
    && typeof seat.bankroll === "number"
    && Array.isArray(seat.bets);
}

/** Rebuild runtime state from a saved session (v3 or v4). Returns null if invalid. */
export function restoreFromSnapshot(raw: unknown): GameState | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<SessionSnapshot>;
  if (data.schemaVersion !== 3 && data.schemaVersion !== 4) return null;
  if (data.mode !== "dealer" && data.mode !== "autoplay") return null;
  if (data.variant !== "european" && data.variant !== "american") return null;
  if (typeof data.runId !== "string" || !Array.isArray(data.seats) || data.seats.length === 0) return null;
  if (!data.seats.every(isSeat)) return null;
  if (!data.serviceScore || typeof data.serviceScore.points !== "number") return null;

  const preset = getPreset(String(data.presetId ?? balanceConfig.defaultPresetId));
  const seats = structuredClone(data.seats);
  const locale: Locale = isLocale(data.locale) ? data.locale : "en";
  const phase: Phase = typeof data.phase === "string" ? data.phase as Phase : "PREPARE";
  const safePhase: Phase = ["PREPARE", "BETTING_OPEN", "BETTING_CLOSED", "SPINNING", "RESULT", "PAYOUT", "GAME_OVER"].includes(phase)
    ? phase
    : "PREPARE";

  const npcBehavior: GameState["npcBehavior"] = {};
  for (const seat of seats) {
    const saved = data.npcBehavior?.[seat.id];
    if (saved && typeof saved.state === "string") {
      npcBehavior[seat.id] = {
        state: saved.state as NpcBehaviorSnapshot["state"],
        intentKey: (saved.intentKey ?? null) as NpcBehaviorSnapshot["intentKey"],
        revision: typeof saved.revision === "number" ? saved.revision : 0,
      };
    } else {
      npcBehavior[seat.id] = createNpcBehavior();
    }
  }

  const isV4 = data.schemaVersion === 4;
  let resumePhase = safePhase;
  // Mid-animation phases without a live spin plan → land on PREPARE for a clean handoff.
  if (!isV4 || resumePhase === "SPINNING" || resumePhase === "RESULT" || resumePhase === "BETTING_CLOSED") {
    if (resumePhase !== "GAME_OVER" && resumePhase !== "BETTING_OPEN" && resumePhase !== "PAYOUT" && resumePhase !== "PREPARE") {
      resumePhase = "PREPARE";
    }
    if (!isV4 && resumePhase !== "GAME_OVER") resumePhase = "PREPARE";
  }

  return {
    runId: data.runId,
    locale,
    mode: data.mode,
    variant: data.variant,
    presetId: preset.id as PresetId,
    phase: resumePhase,
    level: Math.max(1, Math.floor(data.level ?? preset.startLevel)),
    energy: Math.max(0, Math.floor(data.energy ?? preset.energyStart)),
    energyMax: Math.max(1, Math.floor(data.energyMax ?? preset.energyMax)),
    serviceScore: Math.max(0, Math.floor(data.serviceScore.points)),
    serviceComboStep: Math.max(0, Math.floor(data.serviceScore.comboStep ?? 0)),
    tableLedgerUnits: Math.floor(data.tableLedgerUnits ?? 0),
    walletCreditCommitted: Boolean(data.serviceScore.walletCreditCommitted),
    round: Math.max(0, Math.floor(data.round ?? 0)),
    seats,
    activeSeatCount: Math.min(seats.length, Math.max(1, Math.floor(data.activeSeatCount ?? 1))),
    payments: isV4 && Array.isArray(data.payments) ? structuredClone(data.payments) : [],
    paymentIndex: isV4 && typeof data.paymentIndex === "number" ? data.paymentIndex : -1,
    expectedPayments: isV4 && typeof data.expectedPayments === "number" ? data.expectedPayments : 0,
    paidCustomers: isV4 && typeof data.paidCustomers === "number" ? data.paidCustomers : 0,
    history: Array.isArray(data.history) ? data.history.filter((item): item is string => typeof item === "string") : [],
    result: isV4 && (typeof data.result === "string" || data.result === null) ? data.result ?? null : null,
    message: typeof data.message === "string" ? data.message : "message.preparing",
    messageParams: data.messageParams && typeof data.messageParams === "object" ? { ...data.messageParams } : {},
    bonus: isV4 && typeof data.bonus === "string" ? data.bonus : null,
    animationEnabled: data.animationEnabled !== false,
    bettingSeconds: typeof data.bettingSeconds === "number" ? Math.max(0, data.bettingSeconds) : balanceConfig.automaticFlow.bettingSeconds,
    payTimeBaseSeconds: typeof (data as { payTimeBaseSeconds?: number }).payTimeBaseSeconds === "number"
      ? Math.max(balanceConfig.payTime.minSeconds, (data as { payTimeBaseSeconds: number }).payTimeBaseSeconds)
      : preset.payTimeBaseSeconds,
    paySeconds: typeof data.paySeconds === "number" ? Math.max(0, data.paySeconds) : preset.payTimeBaseSeconds,
    payoutHadError: Boolean(data.payoutHadError),
    payoutScoreFinalized: Boolean(data.payoutScoreFinalized),
    manualPaidSeatIds: Array.isArray(data.manualPaidSeatIds) ? data.manualPaidSeatIds.filter((id): id is string => typeof id === "string") : [],
    autoPaidSeatIds: Array.isArray(data.autoPaidSeatIds) ? data.autoPaidSeatIds.filter((id): id is string => typeof id === "string") : [],
    scoreEvents: [],
    npcBehavior,
  };
}
