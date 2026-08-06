import balanceConfig from "../../config/game-balance.json" with { type: "json" };
import npcConfig from "../../config/npc-ai.json" with { type: "json" };
import europeanBets from "../../config/bets-european.json" with { type: "json" };
import americanBets from "../../config/bets-american.json" with { type: "json" };
import type { BetDefinition, GameMode, Payment, Phase, Seat, SessionSnapshot, TableVariant } from "./types.ts";

type PresetId = keyof typeof balanceConfig.presets;
type Preset = (typeof balanceConfig.presets)[PresetId];

export interface GameState {
  mode: GameMode;
  variant: TableVariant;
  presetId: PresetId;
  phase: Phase;
  level: number;
  energy: number;
  energyMax: number;
  score: number;
  round: number;
  seats: Seat[];
  payments: Payment[];
  paymentIndex: number;
  expectedTaps: number;
  paidTaps: number;
  history: string[];
  result: string | null;
  message: string;
  bonus: string | null;
  animationEnabled: boolean;
  bettingSeconds: number;
  paySeconds: number;
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

export function createGame(mode: GameMode, presetId: string, variant: TableVariant, animationEnabled: boolean, rng: () => number = Math.random): GameState {
  const preset = getPreset(presetId);
  const seats: Seat[] = Array.from({ length: preset.playerCount }, (_, index) => {
    const range = npcConfig.bankrollByPreset[preset.id as PresetId];
    const bankroll = Math.round((range.min + rng() * (range.max - range.min)) / preset.chipValue) * preset.chipValue;
    const profileId = pickProfile(rng);
    const favoritePool = variant === "american"
      ? ["0", "00", ...Array.from({ length: 36 }, (_, pocket) => String(pocket + 1))]
      : ["0", ...Array.from({ length: 36 }, (_, pocket) => String(pocket + 1))];
    return {
      id: `seat-${index + 1}`, name: names[index % names.length], bankroll, bets: [],
      profileId, favoritePocket: favoritePool[Math.floor(rng() * favoritePool.length)], avatarSeed: index % 8,
    };
  });
  return {
    mode, variant, presetId: preset.id as PresetId, phase: "PREPARE", level: preset.startLevel,
    energy: preset.energyStart, energyMax: preset.energyMax, score: 0, round: 0,
    seats, payments: [], paymentIndex: -1, expectedTaps: 0, paidTaps: 0,
    history: [], result: null, message: "Welcome to the table", bonus: null,
    animationEnabled, bettingSeconds: preset.interSpinSeconds, paySeconds: preset.payTimeBaseSeconds,
  };
}

export function openBetting(state: GameState, rng: () => number = Math.random): void {
  state.phase = "BETTING_OPEN";
  state.round += 1;
  state.result = null;
  state.bonus = null;
  state.message = "Bets are open";
  state.bettingSeconds = getPreset(state.presetId).interSpinSeconds;
  placeNpcBets(state, rng);
}

export function closeBets(state: GameState): boolean {
  if (state.phase !== "BETTING_OPEN") return false;
  state.phase = "BETTING_CLOSED";
  state.message = "No more bets";
  return true;
}

export function markSpinning(state: GameState): boolean {
  if (state.phase !== "BETTING_CLOSED") return false;
  state.phase = "SPINNING";
  state.message = "Spinning…";
  return true;
}

export function resolveSpin(state: GameState, winningNumber: string, rng: () => number = Math.random): void {
  state.phase = "RESULT";
  state.result = winningNumber;
  state.history.unshift(winningNumber);
  state.history = state.history.slice(0, 60);
  state.message = `${winningNumber} — settle the table`;
  settleBets(state);
  startPayout(state, rng);
}

function catalogFor(variant: TableVariant): BetDefinition[] {
  return (variant === "european" ? europeanBets.bets : americanBets.bets) as BetDefinition[];
}

function placeNpcBets(state: GameState, rng: () => number): void {
  const preset = getPreset(state.presetId);
  const catalog = catalogFor(state.variant);
  for (const seat of state.seats) {
    seat.bets = [];
    if (seat.bankroll <= 0) continue;
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

export function selectPayment(state: GameState, seatId: string): boolean {
  if (state.phase !== "PAYOUT") return false;
  const index = state.payments.findIndex((payment) => payment.seatId === seatId && payment.paid < payment.due);
  if (index < 0) return false;
  state.paymentIndex = index;
  state.message = `${state.payments[index].seatName} selected for payout`;
  return true;
}

function settleBets(state: GameState): void {
  const result = state.result;
  if (!result) return;
  const byId = new Map(catalogFor(state.variant).map((bet) => [bet.id, bet]));
  state.payments = [];
  for (const seat of state.seats) {
    let due = 0;
    for (const placed of seat.bets) {
      const definition = byId.get(placed.betId);
      if (!definition) continue;
      seat.bankroll -= placed.stake;
      if (definition.pockets.includes(result)) {
        seat.bankroll += placed.stake;
        due += placed.stake * definition.multiplier;
      } else {
        state.score += placed.stake;
      }
    }
    if (due > 0) state.payments.push({ seatId: seat.id, seatName: seat.name, due, paid: 0 });
  }
}

function startPayout(state: GameState, rng: () => number): void {
  const preset = getPreset(state.presetId);
  const chip = preset.chipValue;
  state.phase = "PAYOUT";
  state.paymentIndex = -1;
  state.paidTaps = 0;
  state.expectedTaps = state.payments.reduce((sum, payment) => sum + Math.ceil(payment.due / chip), 0);
  state.paySeconds = Math.max(balanceConfig.payTime.minSeconds, preset.payTimeBaseSeconds + balanceConfig.payTime.tapBonusSecondsPerTap * state.expectedTaps);
  rollBonus(state, rng);
  state.message = state.payments.length ? "Pay the winners" : "No winners — clean sweep";
}

function rollBonus(state: GameState, rng: () => number): void {
  const preset = getPreset(state.presetId);
  if (rng() >= preset.bonusChance) return;
  const roll = rng();
  if (roll < 0.4 && state.payments.length) {
    const payment = state.payments[0];
    applyPayment(state, payment, payment.due);
    state.paymentIndex = -1;
    state.bonus = "QUICK PAY";
  } else if (roll < 0.75) {
    state.paySeconds += 5;
    state.bonus = "+5 TIME";
  } else if (state.energy < state.energyMax) {
    state.energy += 1;
    state.bonus = "+1 ENERGY";
  } else {
    state.paySeconds += 5;
    state.bonus = "+5 TIME";
  }
}

function applyPayment(state: GameState, payment: Payment, amount: number): void {
  payment.paid += amount;
  const seat = state.seats.find((item) => item.id === payment.seatId);
  if (seat) seat.bankroll += amount;
  state.score -= amount;
}

export function pay(state: GameState): "paid" | "seat-complete" | "complete" | "overpay" | "invalid" {
  if (state.phase !== "PAYOUT") return "invalid";
  const payment = state.payments[state.paymentIndex];
  if (!payment) {
    if (state.payments.every((item) => item.paid >= item.due)) return "complete";
    state.message = "Select a glowing winning customer first";
    return "invalid";
  }
  if (payment.paid >= payment.due) {
    penalize(state, "OVERPAY! Select another winner");
    return "overpay";
  }
  const chip = getPreset(state.presetId).chipValue;
  const piece = Math.min(chip, payment.due - payment.paid);
  applyPayment(state, payment, piece);
  state.paidTaps += 1;
  if (state.payments.every((item) => item.paid >= item.due)) {
    state.message = "PERFECT PAY!";
    return "complete";
  }
  if (payment.paid >= payment.due) {
    state.message = `${payment.seatName} paid - select the next winner`;
    return "seat-complete";
  }
  state.message = `Paid ${payment.seatName} +${piece} units`;
  return "paid";
}

export function payoutTimeout(state: GameState): void {
  if (state.phase !== "PAYOUT" || state.payments.every((payment) => payment.paid >= payment.due)) return;
  penalize(state, "TOO SLOW");
  for (const payment of state.payments) {
    if (payment.paid >= payment.due) continue;
    applyPayment(state, payment, payment.due - payment.paid);
  }
  state.paymentIndex = -1;
}

function penalize(state: GameState, message: string): void {
  state.message = message;
  if (state.mode === "dealer") {
    state.energy = Math.max(0, state.energy - 1);
    if (state.energy === 0) state.phase = "GAME_OVER";
  }
}

export function finishRound(state: GameState): void {
  if (state.phase === "GAME_OVER") return;
  const preset = getPreset(state.presetId);
  if (state.round % preset.roundsPerLevelUp === 0 && state.level < preset.maxLevel) state.level += 1;
  state.phase = "PREPARE";
  state.message = "Preparing next round";
}

export function snapshot(state: GameState): SessionSnapshot {
  return {
    schemaVersion: 1, mode: state.mode, variant: state.variant, presetId: state.presetId,
    phase: state.phase, level: state.level, energy: state.energy, score: state.score,
    round: state.round, seats: state.seats, history: state.history,
    animationEnabled: state.animationEnabled, savedAt: new Date().toISOString(),
  };
}
