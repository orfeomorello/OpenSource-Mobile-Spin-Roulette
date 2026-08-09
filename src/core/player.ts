/**
 * Player mode pure domain (REQUISITI §6bis).
 * No DOM. Multipliers only from bets-*.json (B1/B2).
 */
import balanceConfig from "../../config/game-balance.json" with { type: "json" };
import europeanBets from "../../config/bets-european.json" with { type: "json" };
import americanBets from "../../config/bets-american.json" with { type: "json" };
import { isLocale } from "../i18n/localeMeta.ts";
import type {
  BetDefinition,
  Locale,
  Phase,
  PlacedBet,
  PlayerChipAction,
  PlayerSessionStats,
  PlayerSettleLine,
  PlayerSettleResult,
  SessionSnapshot,
  TableVariant,
} from "./types.ts";
import type { UserProfile } from "../persist/profile.ts";

/** Max bankroll samples kept in session (start + hands). */
const MAX_BANKROLL_HISTORY = 120;

export interface PlayerModeConfig {
  minBuyIn: number;
  chipDenominations: number[];
  defaultChip: number;
  scenicNpcCount: number;
  reBuyMidSession: boolean;
  /** @deprecated Manual spin — timer no longer used. Kept for older config files. */
  bettingSeconds?: number;
  /** @deprecated Full bankroll is brought automatically. */
  bringToTableSteps?: number[];
}

export interface PlayerGameState {
  runId: string;
  locale: Locale;
  mode: "player";
  variant: TableVariant;
  phase: Phase;
  /** Free points at the table (not currently stacked on felt). */
  tableScore: number;
  selectedChip: number;
  /** Merged stakes by betId (for settle). */
  bets: PlacedBet[];
  /** Placement stack for undo (last chip first pop). */
  chipHistory: PlayerChipAction[];
  /** Last hand layout after settle — used by Rebet. */
  lastBets: PlacedBet[];
  round: number;
  history: string[];
  result: string | null;
  lastSettle: PlayerSettleResult | null;
  animationEnabled: boolean;
  message: string;
  messageParams: Record<string, string | number>;
  /** Decorative names only — never hold bets. */
  scenicNpcNames: string[];
  /** Session stats: profit base, W/L, bankroll curve. */
  stats: PlayerSessionStats;
}

const SCENIC_NAMES = ["Mira", "Jules", "Ren", "Ava", "Kai", "Noa", "Lio", "Suki"];

export function getPlayerModeConfig(): PlayerModeConfig {
  const raw = (balanceConfig as { playerMode?: Partial<PlayerModeConfig> }).playerMode ?? {};
  return {
    minBuyIn: Math.max(1, Math.floor(raw.minBuyIn ?? 5)),
    chipDenominations: Array.isArray(raw.chipDenominations) && raw.chipDenominations.length
      ? raw.chipDenominations.map((n) => Math.floor(n)).filter((n) => n > 0)
      : [1, 2, 5, 10, 100, 500],
    defaultChip: Math.floor(raw.defaultChip ?? 10),
    scenicNpcCount: Math.max(0, Math.floor(raw.scenicNpcCount ?? 3)),
    reBuyMidSession: raw.reBuyMidSession === true,
  };
}

export function catalogForVariant(variant: TableVariant): BetDefinition[] {
  return (variant === "european" ? europeanBets.bets : americanBets.bets) as BetDefinition[];
}

export function canEnterPlayer(accumulated: number, minBuyIn = getPlayerModeConfig().minBuyIn): boolean {
  return Math.floor(accumulated) >= minBuyIn;
}

export interface BringToTableResult {
  profile: UserProfile;
  tableScore: number;
  amount: number;
}

/**
 * Open Player with the full score as live bankroll.
 * Score stays one pool: no “park half in Accumulated” split during the session.
 * Pure — profile is unchanged until exit/sync (caller may keep a working tableScore).
 */
export function openPlayerBankroll(
  profile: UserProfile,
  minBuyIn = getPlayerModeConfig().minBuyIn,
): BringToTableResult | null {
  const value = Math.floor(profile.walletUnits);
  if (value < minBuyIn) return null;
  return { profile, tableScore: value, amount: value };
}

/** @deprecated Use openPlayerBankroll — score is no longer moved out of Accumulated on enter. */
export function bringAllToTable(
  profile: UserProfile,
  minBuyIn = getPlayerModeConfig().minBuyIn,
): BringToTableResult | null {
  return openPlayerBankroll(profile, minBuyIn);
}

/** @deprecated Partial bring no longer used in UI. */
export function bringToTable(
  profile: UserProfile,
  amount: number,
  minBuyIn = getPlayerModeConfig().minBuyIn,
): BringToTableResult | null {
  const value = Math.floor(amount);
  if (value < minBuyIn) return null;
  if (profile.walletUnits < value) return null;
  return { profile, tableScore: value, amount: value };
}

/**
 * Write live Player wealth (free + on felt) into the persistent score.
 * Overwrites walletUnits — Player uses a single score pool.
 */
export function syncPlayerScore(profile: UserProfile, state: PlayerGameState): UserProfile {
  const total = Math.max(0, Math.floor(state.tableScore + totalStaked(state)));
  if (profile.walletUnits === total) return profile;
  return { ...profile, walletUnits: total };
}

/** Exit: clear open bets into free score, then write total to profile. */
export function leaveTable(profile: UserProfile, tableScore: number): UserProfile {
  return { ...profile, walletUnits: Math.max(0, Math.floor(tableScore)) };
}

export function createPlayerGame(
  variant: TableVariant,
  tableScore: number,
  animationEnabled: boolean,
  locale: Locale = "en",
  rng: () => number = Math.random,
): PlayerGameState {
  const cfg = getPlayerModeConfig();
  const score = Math.max(0, Math.floor(tableScore));
  const defaultChip = cfg.chipDenominations.includes(cfg.defaultChip)
    ? cfg.defaultChip
    : cfg.chipDenominations[0] ?? 1;
  const selectedChip = score >= defaultChip
    ? defaultChip
    : [...cfg.chipDenominations].reverse().find((d) => d <= score) ?? cfg.chipDenominations[0] ?? 1;
  const names = SCENIC_NAMES.slice();
  // Fisher-Yates pick for scenic labels
  for (let i = names.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  return {
    runId: `player-${Date.now().toString(36)}-${Math.floor(rng() * 0xfffffff).toString(36).padStart(6, "0")}`,
    locale,
    mode: "player",
    variant,
    phase: "PREPARE",
    tableScore: score,
    selectedChip,
    bets: [],
    chipHistory: [],
    lastBets: [],
    round: 0,
    history: [],
    result: null,
    lastSettle: null,
    animationEnabled,
    message: "message.playerWelcome",
    messageParams: {},
    scenicNpcNames: names.slice(0, cfg.scenicNpcCount),
    stats: createEmptyStats(score),
  };
}

export function createEmptyStats(startingScore: number): PlayerSessionStats {
  const start = Math.max(0, Math.floor(startingScore));
  return {
    startingScore: start,
    wins: 0,
    losses: 0,
    bankrollHistory: [start],
  };
}

/** Profit vs session start (free + on felt − starting score). */
export function playerProfit(state: PlayerGameState): number {
  return playerTotalScore(state) - state.stats.startingScore;
}

/** Record one settled hand into session stats (wins/losses + bankroll point). */
export function recordPlayerSettleStats(state: PlayerGameState, settle: PlayerSettleResult): void {
  if (settle.totalStaked <= 0) return;
  if (settle.netDelta > 0) state.stats.wins += 1;
  else if (settle.netDelta < 0) state.stats.losses += 1;
  // After settle, bets are cleared — tableScore is the full bankroll.
  const bankroll = Math.max(0, Math.floor(state.tableScore));
  state.stats.bankrollHistory.push(bankroll);
  if (state.stats.bankrollHistory.length > MAX_BANKROLL_HISTORY) {
    // Keep start + newest samples
    const start = state.stats.bankrollHistory[0]!;
    const tail = state.stats.bankrollHistory.slice(-(MAX_BANKROLL_HISTORY - 1));
    state.stats.bankrollHistory = [start, ...tail];
  }
}

export function totalStaked(state: PlayerGameState): number {
  return state.bets.reduce((sum, bet) => sum + bet.stake, 0);
}

/** How many wheel pockets are hit by open bets (unique), vs table size (37 EU / 38 US). */
export interface TableCoverage {
  covered: number;
  total: number;
  /** 0–100, rounded */
  percent: number;
}

export function pocketTotalForVariant(variant: TableVariant): number {
  return variant === "american" ? 38 : 37;
}

/**
 * Table coverage: unique pockets among open bets / pockets on this variant.
 * Same idea as online roulette “coverage %” bars.
 */
export function tableCoverage(state: PlayerGameState): TableCoverage {
  const total = pocketTotalForVariant(state.variant);
  if (!state.bets.length) return { covered: 0, total, percent: 0 };
  const byId = new Map(catalogForVariant(state.variant).map((bet) => [bet.id, bet]));
  const pockets = new Set<string>();
  for (const placed of state.bets) {
    const def = byId.get(placed.betId);
    if (!def) continue;
    for (const pocket of def.pockets) pockets.add(pocket);
  }
  const covered = Math.min(total, pockets.size);
  const percent = total > 0 ? Math.min(100, Math.round((covered / total) * 100)) : 0;
  return { covered, total, percent };
}

export function setSelectedChip(state: PlayerGameState, denomination: number): boolean {
  const cfg = getPlayerModeConfig();
  if (!cfg.chipDenominations.includes(denomination)) return false;
  state.selectedChip = denomination;
  return true;
}

/**
 * Place one chip of the selected (or given) denomination on betId.
 * Deducts from tableScore immediately. Only in BETTING_OPEN.
 */
export function placeChip(state: PlayerGameState, betId: string, denomination?: number): boolean {
  if (state.phase !== "BETTING_OPEN") return false;
  const denom = Math.floor(denomination ?? state.selectedChip);
  if (denom <= 0 || state.tableScore < denom) return false;
  const catalog = catalogForVariant(state.variant);
  if (!catalog.some((bet) => bet.id === betId)) return false;

  state.tableScore -= denom;
  state.chipHistory.push({ betId, denomination: denom });
  const existing = state.bets.find((bet) => bet.betId === betId);
  if (existing) existing.stake += denom;
  else state.bets.push({ betId, stake: denom });
  // UI shows live total staked — no per-bet tech id spam (corner_7_8_…)
  state.message = "message.playerBetting";
  state.messageParams = {};
  return true;
}

/**
 * Move stake already on the felt from one bet to another (no free-score change).
 * Default amount = entire stack on `fromBetId`. Only BETTING_OPEN.
 */
export function movePlayerStake(
  state: PlayerGameState,
  fromBetId: string,
  toBetId: string,
  amount?: number,
): boolean {
  if (state.phase !== "BETTING_OPEN") return false;
  if (fromBetId === toBetId) return false;
  const catalog = catalogForVariant(state.variant);
  if (!catalog.some((bet) => bet.id === toBetId)) return false;
  if (!catalog.some((bet) => bet.id === fromBetId)) return false;

  const from = state.bets.find((bet) => bet.betId === fromBetId);
  if (!from || from.stake <= 0) return false;
  const moveAmt = Math.floor(amount ?? from.stake);
  if (moveAmt <= 0 || moveAmt > from.stake) return false;

  from.stake -= moveAmt;
  if (from.stake <= 0) {
    state.bets = state.bets.filter((bet) => bet.betId !== fromBetId);
  }
  const existing = state.bets.find((bet) => bet.betId === toBetId);
  if (existing) existing.stake += moveAmt;
  else state.bets.push({ betId: toBetId, stake: moveAmt });

  state.chipHistory.push({
    betId: toBetId,
    denomination: moveAmt,
    movedFrom: fromBetId,
  });
  state.message = "message.playerBetting";
  state.messageParams = {};
  return true;
}

/** Undo last chip placement / move (or whole rebet batch if last action was a package). */
export function undoChip(state: PlayerGameState): boolean {
  if (state.phase !== "BETTING_OPEN") return false;
  if (!state.chipHistory.length) return false;
  const top = state.chipHistory[state.chipHistory.length - 1]!;
  const batchId = top.batchId;
  let removed = 0;

  const undoOne = (action: PlayerChipAction): void => {
    removed += 1;

    if (action.movedFrom) {
      // Reverse a felt-to-felt move: take stake off target, restore source. No free score.
      const toIdx = state.bets.findIndex((bet) => bet.betId === action.betId);
      if (toIdx >= 0) {
        state.bets[toIdx].stake -= action.denomination;
        if (state.bets[toIdx].stake <= 0) state.bets.splice(toIdx, 1);
      }
      const fromExisting = state.bets.find((bet) => bet.betId === action.movedFrom);
      if (fromExisting) fromExisting.stake += action.denomination;
      else state.bets.push({ betId: action.movedFrom, stake: action.denomination });
      return;
    }

    state.tableScore += action.denomination;
    const idx = state.bets.findIndex((bet) => bet.betId === action.betId);
    if (idx >= 0) {
      state.bets[idx].stake -= action.denomination;
      if (state.bets[idx].stake <= 0) state.bets.splice(idx, 1);
    }
  };

  if (batchId) {
    while (state.chipHistory.length) {
      const next = state.chipHistory[state.chipHistory.length - 1]!;
      if (next.batchId !== batchId) break;
      undoOne(state.chipHistory.pop()!);
    }
  } else {
    undoOne(state.chipHistory.pop()!);
  }

  if (removed <= 0) return false;
  state.message = "message.playerBetting";
  state.messageParams = {};
  return true;
}

/** Clear all open bets; return stakes to tableScore. */
export function clearPlayerBets(state: PlayerGameState): boolean {
  if (state.phase !== "BETTING_OPEN" && state.phase !== "PREPARE") return false;
  const staked = totalStaked(state);
  if (staked <= 0 && state.chipHistory.length === 0) return false;
  state.tableScore += staked;
  state.bets = [];
  state.chipHistory = [];
  state.message = "message.playerBetting";
  state.messageParams = {};
  return true;
}

export function openPlayerBetting(state: PlayerGameState): void {
  if (state.phase === "GAME_OVER") return;
  state.phase = "BETTING_OPEN";
  state.round += 1;
  state.result = null;
  state.lastSettle = null;
  state.bets = [];
  state.chipHistory = [];
  state.message = "message.playerBetting";
  state.messageParams = {};
}

/**
 * Place a full stake block on a bet (used by rebet / double).
 * Deducts from tableScore. Only BETTING_OPEN.
 */
export function placeStake(
  state: PlayerGameState,
  betId: string,
  stake: number,
  opts?: { batchId?: string },
): boolean {
  if (state.phase !== "BETTING_OPEN") return false;
  const amount = Math.floor(stake);
  if (amount <= 0 || state.tableScore < amount) return false;
  const catalog = catalogForVariant(state.variant);
  if (!catalog.some((bet) => bet.id === betId)) return false;
  state.tableScore -= amount;
  const action: PlayerChipAction = { betId, denomination: amount };
  if (opts?.batchId) action.batchId = opts.batchId;
  state.chipHistory.push(action);
  const existing = state.bets.find((bet) => bet.betId === betId);
  if (existing) existing.stake += amount;
  else state.bets.push({ betId, stake: amount });
  return true;
}

/**
 * Repeat last settled hand: replace open bets with one copy of lastBets
 * (classic rebet — not stacking). Use strategy apply to stack a saved layout.
 */
export function rebetLast(state: PlayerGameState): boolean {
  return applySavedBets(state, state.lastBets, "rebet");
}

/**
 * Apply a saved layout.
 * - **rebet**: clears open chips, places last hand once (replace).
 * - **strategy**: **adds** one copy of the template on top of open bets (stack).
 *   Click strategy name 3× → three copies. Undo removes the last package (`batchId`).
 */
export function applySavedBets(
  state: PlayerGameState,
  bets: PlacedBet[],
  kind: "rebet" | "strategy" = "strategy",
): boolean {
  if (state.phase !== "BETTING_OPEN") return false;
  if (!bets.length) return false;
  const catalog = new Set(catalogForVariant(state.variant).map((bet) => bet.id));
  const clean = bets
    .map((bet) => ({ betId: bet.betId, stake: Math.floor(bet.stake) }))
    .filter((bet) => bet.stake > 0 && catalog.has(bet.betId));
  if (!clean.length) {
    state.message = kind === "rebet" ? "message.playerRebetFail" : "message.playerStrategyFail";
    state.messageParams = { need: 0, free: state.tableScore };
    return false;
  }
  const cost = clean.reduce((sum, bet) => sum + bet.stake, 0);
  if (cost <= 0) return false;

  const replace = kind === "rebet";
  const available = replace ? state.tableScore + totalStaked(state) : state.tableScore;
  if (available < cost) {
    state.message = kind === "rebet" ? "message.playerRebetFail" : "message.playerStrategyFail";
    state.messageParams = { need: cost, free: available };
    return false;
  }

  if (replace && state.bets.length) clearPlayerBets(state);

  const batchId = `${kind}-${state.round}-${state.chipHistory.length}-${cost}`;
  const freeBefore = state.tableScore;
  const historyBefore = state.chipHistory.length;
  const betsSnapshot = structuredClone(state.bets);
  for (const bet of clean) {
    if (!placeStake(state, bet.betId, bet.stake, { batchId })) {
      state.tableScore = freeBefore;
      state.bets = betsSnapshot;
      state.chipHistory.length = historyBefore;
      state.message = kind === "rebet" ? "message.playerRebetFail" : "message.playerStrategyFail";
      state.messageParams = { need: cost, free: freeBefore };
      return false;
    }
  }
  // Live stake total is shown in the HUD — no “Strategy placed · N” spam
  state.message = "message.playerBetting";
  state.messageParams = {};
  return true;
}

// ---------------------------------------------------------------------------
// Bet Creator draft (sandbox — no tableScore deduction)
// ---------------------------------------------------------------------------

export interface BetCreatorDraft {
  editingId: string | null;
  name: string;
  variant: TableVariant;
  selectedChip: number;
  bets: PlacedBet[];
  chipHistory: PlayerChipAction[];
}

export function createBetCreatorDraft(
  variant: TableVariant,
  opts?: { editingId?: string | null; name?: string; bets?: PlacedBet[]; selectedChip?: number },
): BetCreatorDraft {
  const cfg = getPlayerModeConfig();
  const chip = opts?.selectedChip && cfg.chipDenominations.includes(opts.selectedChip)
    ? opts.selectedChip
    : cfg.defaultChip;
  const bets = structuredClone(opts?.bets ?? []);
  return {
    editingId: opts?.editingId ?? null,
    name: (opts?.name ?? "").slice(0, 40),
    variant,
    selectedChip: chip,
    bets,
    chipHistory: [],
  };
}

export function draftTotal(draft: BetCreatorDraft): number {
  return draft.bets.reduce((sum, bet) => sum + bet.stake, 0);
}

export function placeDraftChip(draft: BetCreatorDraft, betId: string, denomination?: number): boolean {
  const denom = Math.floor(denomination ?? draft.selectedChip);
  if (denom <= 0) return false;
  const catalog = catalogForVariant(draft.variant);
  if (!catalog.some((bet) => bet.id === betId)) return false;
  draft.chipHistory.push({ betId, denomination: denom });
  const existing = draft.bets.find((bet) => bet.betId === betId);
  if (existing) existing.stake += denom;
  else draft.bets.push({ betId, stake: denom });
  return true;
}

export function undoDraftChip(draft: BetCreatorDraft): boolean {
  const last = draft.chipHistory.pop();
  if (!last) return false;
  const idx = draft.bets.findIndex((bet) => bet.betId === last.betId);
  if (idx >= 0) {
    draft.bets[idx].stake -= last.denomination;
    if (draft.bets[idx].stake <= 0) draft.bets.splice(idx, 1);
  }
  return true;
}

export function clearDraftBets(draft: BetCreatorDraft): boolean {
  if (!draft.bets.length && !draft.chipHistory.length) return false;
  draft.bets = [];
  draft.chipHistory = [];
  return true;
}

export function setDraftChip(draft: BetCreatorDraft, denomination: number): boolean {
  const cfg = getPlayerModeConfig();
  if (!cfg.chipDenominations.includes(denomination)) return false;
  draft.selectedChip = denomination;
  return true;
}

/** Double every open stake if free table score covers the extra total. */
export function doubleBets(state: PlayerGameState): boolean {
  if (state.phase !== "BETTING_OPEN") return false;
  const extra = totalStaked(state);
  if (extra <= 0) return false;
  if (state.tableScore < extra) {
    state.message = "message.playerDoubleFail";
    state.messageParams = { need: extra, free: state.tableScore };
    return false;
  }
  for (const bet of state.bets) {
    const add = bet.stake;
    state.tableScore -= add;
    bet.stake += add;
    state.chipHistory.push({ betId: bet.betId, denomination: add });
  }
  state.message = "message.playerBetting";
  state.messageParams = {};
  return true;
}

/**
 * Add a package of bets (call/racetrack macro) without clearing open chips.
 * Rolls back the whole package if any line fails. Only BETTING_OPEN.
 */
export function placeBetsPackage(
  state: PlayerGameState,
  bets: PlacedBet[],
  opts?: { messageKey?: string; messageParams?: Record<string, string | number> },
): boolean {
  if (state.phase !== "BETTING_OPEN") return false;
  const catalog = new Set(catalogForVariant(state.variant).map((bet) => bet.id));
  const clean = bets
    .map((bet) => ({ betId: bet.betId, stake: Math.floor(bet.stake) }))
    .filter((bet) => bet.stake > 0 && catalog.has(bet.betId));
  if (!clean.length) {
    state.message = "message.playerCallFail";
    state.messageParams = { need: 0, free: state.tableScore };
    return false;
  }
  const cost = clean.reduce((sum, bet) => sum + bet.stake, 0);
  if (state.tableScore < cost) {
    state.message = "message.playerCallFail";
    state.messageParams = { need: cost, free: state.tableScore };
    return false;
  }
  const freeBefore = state.tableScore;
  const historyBefore = state.chipHistory.length;
  const betsSnapshot = structuredClone(state.bets);
  for (const bet of clean) {
    if (!placeStake(state, bet.betId, bet.stake)) {
      // full rollback
      state.tableScore = freeBefore;
      state.bets = betsSnapshot;
      state.chipHistory.length = historyBefore;
      state.message = "message.playerCallFail";
      state.messageParams = { need: cost, free: freeBefore };
      return false;
    }
  }
  // Prefer optional custom message only if caller needs it; default = silent (HUD stake total)
  if (opts?.messageKey) {
    state.message = opts.messageKey;
    state.messageParams = opts.messageParams ?? { amount: cost };
  } else {
    state.message = "message.playerBetting";
    state.messageParams = {};
  }
  return true;
}

export function closePlayerBets(state: PlayerGameState): boolean {
  if (state.phase !== "BETTING_OPEN") return false;
  // Free spin allowed: may close with zero bets
  state.phase = "BETTING_CLOSED";
  state.message = state.bets.length ? "message.playerBetsLocked" : "message.playerFreeSpin";
  state.messageParams = {};
  return true;
}

export function markPlayerSpinning(state: PlayerGameState): boolean {
  if (state.phase !== "BETTING_CLOSED" && state.phase !== "BETTING_OPEN") return false;
  // Allow direct spin from open (including free spin with no chips)
  if (state.phase === "BETTING_OPEN") {
    state.phase = "BETTING_CLOSED";
  }
  state.phase = "SPINNING";
  state.message = "message.playerSpinning";
  state.messageParams = {};
  return true;
}

/** Lock bets and mark spinning in one step (manual Spin button). Free spin = no chips required. */
export function requestPlayerSpin(state: PlayerGameState): boolean {
  if (state.phase !== "BETTING_OPEN") return false;
  state.phase = "SPINNING";
  state.message = "message.playerSpinning";
  state.messageParams = {};
  return true;
}

/**
 * Settle human bets with real catalog multipliers (B2).
 * Stakes were already deducted on place. Win → stake + amountDue to tableScore.
 * Lose → stake stays lost. Auto PAYOUT — no manual pay.
 */
export function settlePlayerRound(state: PlayerGameState, winningNumber: string): PlayerSettleResult {
  state.phase = "PAYOUT";
  state.result = winningNumber;
  state.history.unshift(winningNumber);
  state.history = state.history.slice(0, 60);

  const byId = new Map(catalogForVariant(state.variant).map((bet) => [bet.id, bet]));
  const lines: PlayerSettleLine[] = [];
  let totalStakedAmount = 0;
  let totalReturned = 0;

  for (const placed of state.bets) {
    const definition = byId.get(placed.betId);
    if (!definition) continue;
    const stake = placed.stake;
    totalStakedAmount += stake;
    const won = definition.pockets.includes(winningNumber);
    const amountDue = won ? stake * definition.multiplier : 0;
    const returned = won ? stake + amountDue : 0;
    totalReturned += returned;
    lines.push({
      betId: placed.betId,
      stake,
      won,
      multiplier: definition.multiplier,
      amountDue,
      returned,
    });
  }

  // Remember layout for Rebet before clearing the felt.
  if (state.bets.length) {
    state.lastBets = structuredClone(state.bets);
  }
  state.tableScore += totalReturned;
  state.bets = [];
  state.chipHistory = [];

  const netDelta = totalReturned - totalStakedAmount;
  const settle: PlayerSettleResult = {
    winningNumber,
    lines,
    totalStaked: totalStakedAmount,
    totalReturned,
    netDelta,
  };
  state.lastSettle = settle;
  recordPlayerSettleStats(state, settle);
  state.message = totalStakedAmount === 0
    ? "message.playerNoBetsSpin"
    : netDelta > 0
      ? "message.playerWin"
      : netDelta < 0
        ? "message.playerLose"
        : "message.playerPush";
  state.messageParams = {
    number: winningNumber,
    net: netDelta,
    returned: totalReturned,
    staked: totalStakedAmount,
  };
  return settle;
}

/**
 * Pure settle helper for tests — does not mutate a full game (optional convenience).
 * amountDue = stake × M; returned on win = stake + amountDue.
 */
export function computePlayerPayout(
  variant: TableVariant,
  bets: PlacedBet[],
  winningNumber: string,
): PlayerSettleResult {
  const byId = new Map(catalogForVariant(variant).map((bet) => [bet.id, bet]));
  const lines: PlayerSettleLine[] = [];
  let totalStakedAmount = 0;
  let totalReturned = 0;
  for (const placed of bets) {
    const definition = byId.get(placed.betId);
    if (!definition) continue;
    const stake = placed.stake;
    totalStakedAmount += stake;
    const won = definition.pockets.includes(winningNumber);
    const amountDue = won ? stake * definition.multiplier : 0;
    const returned = won ? stake + amountDue : 0;
    totalReturned += returned;
    lines.push({
      betId: placed.betId,
      stake,
      won,
      multiplier: definition.multiplier,
      amountDue,
      returned,
    });
  }
  return {
    winningNumber,
    lines,
    totalStaked: totalStakedAmount,
    totalReturned,
    netDelta: totalReturned - totalStakedAmount,
  };
}

export function finishPlayerRound(state: PlayerGameState): void {
  if (state.phase === "GAME_OVER") return;
  if (state.tableScore <= 0) {
    state.phase = "GAME_OVER";
    state.message = "message.playerOut";
    state.messageParams = {};
    return;
  }
  state.phase = "PREPARE";
  state.message = "message.playerPreparing";
  state.messageParams = {};
}

/** Exit mid-session: clear open bets into free score, persist total, end session. */
export function cashOutPlayer(state: PlayerGameState, profile: UserProfile): { profile: UserProfile; returned: number } {
  if (state.phase === "BETTING_OPEN" || state.phase === "PREPARE") {
    clearPlayerBets(state);
  }
  // Mid-spin locked bets: stakes already deducted — only free residual is kept.
  const returned = Math.max(0, state.tableScore);
  const next = leaveTable(profile, returned);
  state.tableScore = 0;
  state.bets = [];
  state.chipHistory = [];
  state.phase = "GAME_OVER";
  state.message = "message.playerCashedOut";
  state.messageParams = { amount: returned };
  return { profile: next, returned };
}

/** Total score visible to the player (free + chips on felt). */
export function playerTotalScore(state: PlayerGameState): number {
  return state.tableScore + totalStaked(state);
}

export function snapshotPlayer(state: PlayerGameState): SessionSnapshot {
  return {
    schemaVersion: 5,
    runId: state.runId,
    locale: state.locale,
    mode: "player",
    variant: state.variant,
    presetId: "player",
    phase: state.phase,
    level: 1,
    energy: 0,
    serviceScore: { points: 0, comboStep: 0, walletCreditCommitted: true },
    tableLedgerUnits: 0,
    round: state.round,
    seats: [],
    activeSeatCount: 0,
    history: [...state.history],
    animationEnabled: state.animationEnabled,
    savedAt: new Date().toISOString(),
    result: state.result,
    message: state.message,
    messageParams: { ...state.messageParams },
    tableScore: state.tableScore,
    selectedChip: state.selectedChip,
    playerBets: structuredClone(state.bets),
    chipHistory: structuredClone(state.chipHistory),
    lastSettle: state.lastSettle ? structuredClone(state.lastSettle) : null,
    lastBets: structuredClone(state.lastBets),
    scenicNpcNames: [...state.scenicNpcNames],
    playerStats: {
      startingScore: state.stats.startingScore,
      wins: state.stats.wins,
      losses: state.stats.losses,
      bankrollHistory: [...state.stats.bankrollHistory],
    },
  };
}

export function restorePlayerFromSnapshot(raw: unknown): PlayerGameState | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<SessionSnapshot>;
  if (data.schemaVersion !== 5 || data.mode !== "player") return null;
  if (data.variant !== "european" && data.variant !== "american") return null;
  if (typeof data.runId !== "string") return null;
  if (typeof data.tableScore !== "number") return null;

  const cfg = getPlayerModeConfig();
  let phase: Phase = typeof data.phase === "string" ? data.phase as Phase : "PREPARE";
  // Mid-animation → PREPARE handoff
  if (phase === "SPINNING" || phase === "RESULT" || phase === "BETTING_CLOSED") {
    phase = "PREPARE";
  }
  if (phase === "PAYOUT") phase = "PREPARE";

  const bets = Array.isArray(data.playerBets)
    ? data.playerBets.filter((b): b is PlacedBet => Boolean(b && typeof b.betId === "string" && typeof b.stake === "number"))
    : [];
  const chipHistory = Array.isArray(data.chipHistory)
    ? data.chipHistory.filter((c): c is PlayerChipAction => Boolean(c && typeof c.betId === "string" && typeof c.denomination === "number"))
    : [];

  // If resuming into BETTING_OPEN keep bets; else fold staked back if we forced PREPARE from spin
  let tableScore = Math.max(0, Math.floor(data.tableScore));
  let resumeBets = bets;
  let resumeHistory = chipHistory;
  if (phase === "PREPARE" || phase === "GAME_OVER") {
    const staked = bets.reduce((s, b) => s + b.stake, 0);
    if (staked > 0 && data.phase !== "BETTING_OPEN") {
      tableScore += staked;
      resumeBets = [];
      resumeHistory = [];
    }
  }

  const lastBets = Array.isArray(data.lastBets)
    ? data.lastBets.filter((b): b is PlacedBet => Boolean(b && typeof b.betId === "string" && typeof b.stake === "number"))
    : [];

  const stats = restorePlayerStats(data.playerStats, tableScore + (phase === "BETTING_OPEN"
    ? resumeBets.reduce((s, b) => s + b.stake, 0)
    : 0));

  return {
    runId: data.runId,
    locale: isLocale(data.locale) ? data.locale : "en",
    mode: "player",
    variant: data.variant,
    phase: phase === "BETTING_OPEN" ? "BETTING_OPEN" : phase === "GAME_OVER" ? "GAME_OVER" : "PREPARE",
    tableScore,
    selectedChip: typeof data.selectedChip === "number" && cfg.chipDenominations.includes(data.selectedChip)
      ? data.selectedChip
      : cfg.defaultChip,
    bets: phase === "BETTING_OPEN" ? structuredClone(resumeBets) : [],
    chipHistory: phase === "BETTING_OPEN" ? structuredClone(resumeHistory) : [],
    lastBets: structuredClone(lastBets),
    round: Math.max(0, Math.floor(data.round ?? 0)),
    history: Array.isArray(data.history) ? data.history.filter((h): h is string => typeof h === "string") : [],
    result: null,
    lastSettle: null,
    animationEnabled: data.animationEnabled !== false,
    message: typeof data.message === "string" ? data.message : "message.playerPreparing",
    messageParams: data.messageParams && typeof data.messageParams === "object" ? { ...data.messageParams } : {},
    scenicNpcNames: Array.isArray(data.scenicNpcNames)
      ? data.scenicNpcNames.filter((n): n is string => typeof n === "string").slice(0, cfg.scenicNpcCount)
      : SCENIC_NAMES.slice(0, cfg.scenicNpcCount),
    stats,
  };
}

function restorePlayerStats(raw: unknown, fallbackScore: number): PlayerSessionStats {
  const fallback = createEmptyStats(fallbackScore);
  if (!raw || typeof raw !== "object") return fallback;
  const data = raw as Partial<PlayerSessionStats>;
  const startingScore = typeof data.startingScore === "number" && Number.isFinite(data.startingScore)
    ? Math.max(0, Math.floor(data.startingScore))
    : fallback.startingScore;
  const wins = typeof data.wins === "number" && Number.isFinite(data.wins)
    ? Math.max(0, Math.floor(data.wins))
    : 0;
  const losses = typeof data.losses === "number" && Number.isFinite(data.losses)
    ? Math.max(0, Math.floor(data.losses))
    : 0;
  let bankrollHistory = Array.isArray(data.bankrollHistory)
    ? data.bankrollHistory
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
      .map((n) => Math.max(0, Math.floor(n)))
      .slice(0, MAX_BANKROLL_HISTORY)
    : [];
  if (!bankrollHistory.length) bankrollHistory = [startingScore];
  else if (bankrollHistory[0] !== startingScore) {
    bankrollHistory = [startingScore, ...bankrollHistory].slice(0, MAX_BANKROLL_HISTORY);
  }
  return { startingScore, wins, losses, bankrollHistory };
}
