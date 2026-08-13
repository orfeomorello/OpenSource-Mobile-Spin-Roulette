import assert from "node:assert/strict";
import { createEmptyProfile, normalizeUserProfile, refillEmptyProfile, restoreStarterBankroll, STARTER_SCORE } from "../persist/profile.ts";
import {
  canEnterPlayer, cashOutPlayer, clearPlayerBets, computePlayerPayout, createPlayerGame, doubleBets,
  finishPlayerRound, getPlayerModeConfig, leaveTable, openPlayerBankroll, openPlayerBetting, placeBetsPackage, placeChip,
  applySavedBets, clearDraftBets, createBetCreatorDraft, draftTotal, placeDraftChip, movePlayerStake, tableLayoutForStrategy,
  playerProfit, rebetLast, requestPlayerSpin, restorePlayerFromSnapshot, setSelectedChip, settlePlayerRound,
  snapshotPlayer, syncPlayerScore, tableCoverage, totalStaked, undoChip, undoDraftChip,
} from "./player.ts";
import {
  expandRecipe, getNeighborsPackage, getSectorPackage, neighborPockets, packageCost, SECTOR_POCKETS,
  wheelPockets,
} from "./callBets.ts";

function test(name: string, body: () => void): void {
  try {
    body();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test("new and legacy-zero profiles receive 2000000 starter score exactly once", () => {
  const fresh = createEmptyProfile();
  assert.equal(STARTER_SCORE, 2_000_000);
  assert.equal(fresh.walletUnits, 2_000_000);
  assert.equal(fresh.starterScoreGranted, true);

  const migrated = normalizeUserProfile({
    schemaVersion: 1,
    walletUnits: 0,
  });
  assert.equal(migrated.walletUnits, 2_000_000, "legacy zero profile gets the onboarding grant");

  const spent = normalizeUserProfile({ ...fresh, walletUnits: 0 });
  assert.equal(spent.walletUnits, 0, "the grant is not repeated after losing the starter score");
});

test("starting again after reaching zero refills the configured starter score", () => {
  const depleted = { ...createEmptyProfile(), walletUnits: 0 };
  assert.equal(refillEmptyProfile(depleted).walletUnits, STARTER_SCORE);
  const active = { ...depleted, walletUnits: 25 };
  assert.equal(refillEmptyProfile(active), active, "positive balances are never replaced");
});

// --- Player mode (§6bis) ---
test("Player gate: minBuyIn 5 and single score pool (no debit on enter)", () => {
  const cfg = getPlayerModeConfig();
  assert.equal(cfg.minBuyIn, 5);
  assert.deepEqual(cfg.chipDenominations, [1, 2, 5, 10, 100, 500]);
  assert.equal(canEnterPlayer(4), false);
  assert.equal(canEnterPlayer(5), true);
  const profile = createEmptyProfile();
  profile.walletUnits = 80;
  const opened = openPlayerBankroll(profile);
  assert.ok(opened);
  assert.equal(opened!.tableScore, 80);
  assert.equal(opened!.profile.walletUnits, 80, "score is not zeroed on enter");
  assert.equal(openPlayerBankroll(createEmptyProfile())?.tableScore, 2_000_000);
  // red + even on 14 both win (1:1 each)
  const win = computePlayerPayout("european", [
    { betId: "red", stake: 10 },
    { betId: "even", stake: 10 },
  ], "14");
  assert.equal(win.lines.every((l) => l.won), true);
  assert.equal(win.totalReturned, 40);
  assert.equal(win.netDelta, 20);
  // live sync writes total wealth back into profile
  const state = createPlayerGame("european", 80, false, "en", () => 0.5);
  openPlayerBetting(state);
  placeChip(state, "red", 10);
  const synced = syncPlayerScore(profile, state);
  assert.equal(synced.walletUnits, 80, "free+staked still full score until settle");
  assert.equal(leaveTable(synced, 100).walletUnits, 100);
});

test("Player real payouts EU: straight split street corner sixline dozen even-money multi-stack", () => {
  // straight 17 @ 10 → win on 17: amountDue 350, returned 360
  let r = computePlayerPayout("european", [{ betId: "straight_17", stake: 10 }], "17");
  assert.equal(r.lines[0].amountDue, 350);
  assert.equal(r.lines[0].returned, 360);
  assert.equal(r.netDelta, 350);
  r = computePlayerPayout("european", [{ betId: "straight_17", stake: 10 }], "18");
  assert.equal(r.lines[0].won, false);
  assert.equal(r.lines[0].returned, 0);
  assert.equal(r.netDelta, -10);

  // split 17
  r = computePlayerPayout("european", [{ betId: "split_14_15", stake: 10 }], "14");
  assert.equal(r.lines[0].amountDue, 170);
  assert.equal(r.lines[0].returned, 180);

  // street 11
  r = computePlayerPayout("european", [{ betId: "street_1_2_3", stake: 5 }], "2");
  assert.equal(r.lines[0].amountDue, 55);
  assert.equal(r.lines[0].returned, 60);

  // corner 8
  r = computePlayerPayout("european", [{ betId: "corner_1_2_4_5", stake: 10 }], "4");
  assert.equal(r.lines[0].amountDue, 80);
  assert.equal(r.lines[0].returned, 90);

  // sixline 5
  r = computePlayerPayout("european", [{ betId: "sixline_1_6", stake: 10 }], "6");
  assert.equal(r.lines[0].amountDue, 50);
  assert.equal(r.lines[0].returned, 60);

  // dozen 2:1
  r = computePlayerPayout("european", [{ betId: "dozen1", stake: 20 }], "12");
  assert.equal(r.lines[0].amountDue, 40);
  assert.equal(r.lines[0].returned, 60);

  // even-money 1:1
  r = computePlayerPayout("european", [{ betId: "red", stake: 25 }], "1");
  assert.equal(r.lines[0].amountDue, 25);
  assert.equal(r.lines[0].returned, 50);
  r = computePlayerPayout("european", [{ betId: "even", stake: 10 }], "2");
  assert.equal(r.lines[0].returned, 20);
  r = computePlayerPayout("european", [{ betId: "low", stake: 10 }], "18");
  assert.equal(r.lines[0].returned, 20);

  // multi-stack same + different zones (17 is black on real EU wheel)
  r = computePlayerPayout("european", [
    { betId: "straight_17", stake: 15 }, // 10+5 stacked
    { betId: "black", stake: 10 },
  ], "17");
  assert.equal(r.totalStaked, 25);
  assert.equal(r.lines.find((l) => l.betId === "straight_17")!.returned, 15 + 15 * 35);
  assert.equal(r.lines.find((l) => l.betId === "black")!.returned, 20);
});

test("Player 0/00: outside lose; US 00 distinct; five-number", () => {
  let r = computePlayerPayout("european", [{ betId: "red", stake: 10 }], "0");
  assert.equal(r.lines[0].won, false);
  assert.equal(r.netDelta, -10);
  r = computePlayerPayout("european", [{ betId: "even", stake: 10 }], "0");
  assert.equal(r.lines[0].won, false);
  r = computePlayerPayout("european", [{ betId: "straight_0", stake: 1 }], "0");
  assert.equal(r.lines[0].amountDue, 35);
  assert.equal(r.lines[0].returned, 36);

  r = computePlayerPayout("american", [{ betId: "red", stake: 10 }], "00");
  assert.equal(r.lines[0].won, false);
  r = computePlayerPayout("american", [{ betId: "straight_00", stake: 2 }], "00");
  assert.equal(r.lines[0].amountDue, 70);
  assert.equal(r.lines[0].returned, 72);
  r = computePlayerPayout("american", [{ betId: "straight_00", stake: 2 }], "0");
  assert.equal(r.lines[0].won, false, "00 is distinct from 0");
  r = computePlayerPayout("american", [{ betId: "five_number_0_00_1_2_3", stake: 5 }], "00");
  assert.equal(r.lines[0].amountDue, 30);
  assert.equal(r.lines[0].returned, 35);
  r = computePlayerPayout("american", [{ betId: "split_0_00", stake: 10 }], "0");
  assert.equal(r.lines[0].amountDue, 170);
});

test("Player chip stack place/undo/clear and settle updates tableScore only", () => {
  const state = createPlayerGame("european", 100, false, "en", () => 0.5);
  openPlayerBetting(state);
  assert.equal(setSelectedChip(state, 10), true);
  assert.equal(placeChip(state, "straight_17"), true);
  assert.equal(placeChip(state, "straight_17", 5), true);
  assert.equal(placeChip(state, "red", 10), true);
  assert.equal(state.tableScore, 100 - 25);
  assert.equal(totalStaked(state), 25);
  assert.equal(state.bets.find((b) => b.betId === "straight_17")!.stake, 15);
  assert.equal(undoChip(state), true);
  assert.equal(totalStaked(state), 15);
  assert.equal(state.tableScore, 85);
  clearPlayerBets(state);
  assert.equal(totalStaked(state), 0);
  assert.equal(state.tableScore, 100);

  // Drag-move whole stack between bets (free score unchanged)
  placeChip(state, "straight_17", 10);
  placeChip(state, "red", 5);
  assert.equal(state.tableScore, 85);
  assert.equal(movePlayerStake(state, "straight_17", "black"), true);
  assert.equal(state.tableScore, 85);
  assert.equal(state.bets.find((b) => b.betId === "straight_17"), undefined);
  assert.equal(state.bets.find((b) => b.betId === "black")!.stake, 10);
  assert.equal(state.bets.find((b) => b.betId === "red")!.stake, 5);
  assert.equal(movePlayerStake(state, "black", "black"), false); // same target
  assert.equal(undoChip(state), true); // undo move → back on 17
  assert.equal(state.bets.find((b) => b.betId === "straight_17")!.stake, 10);
  assert.equal(state.bets.find((b) => b.betId === "black"), undefined);
  assert.equal(state.tableScore, 85);
  clearPlayerBets(state);
  assert.equal(state.tableScore, 100);

  placeChip(state, "straight_17", 10);
  placeChip(state, "red", 10); // 17 is black → red loses
  assert.equal(requestPlayerSpin(state), true);
  assert.equal(state.phase, "SPINNING");
  const freeBefore = state.tableScore; // 80
  const settle = settlePlayerRound(state, "17");
  assert.equal(settle.lines.find((l) => l.betId === "straight_17")!.returned, 360);
  assert.equal(settle.lines.find((l) => l.betId === "red")!.returned, 0);
  assert.equal(state.tableScore, freeBefore + 360);
  assert.equal(state.bets.length, 0);
  assert.equal(state.lastBets.find((b) => b.betId === "straight_17")!.stake, 10);
  finishPlayerRound(state);
  assert.equal(state.phase, "PREPARE");
});

test("Player rebet replaces last hand once; strategy apply stacks; undo removes last strategy package", () => {
  const state = createPlayerGame("european", 200, false, "en", () => 0.5);
  openPlayerBetting(state);
  placeChip(state, "red", 10);
  placeChip(state, "straight_1", 5);
  assert.equal(requestPlayerSpin(state), true);
  settlePlayerRound(state, "2"); // both lose → free 185
  finishPlayerRound(state);
  openPlayerBetting(state);
  assert.deepEqual(state.lastBets.map((b) => b.betId).sort(), ["red", "straight_1"].sort());

  // Classic rebet: replace, not stack
  placeChip(state, "black", 20);
  assert.equal(rebetLast(state), true);
  assert.equal(totalStaked(state), 15, "rebet replaces open black with last hand");
  assert.equal(state.bets.find((b) => b.betId === "black"), undefined);
  assert.equal(rebetLast(state), true);
  assert.equal(totalStaked(state), 15, "second rebet still one copy only");

  // Strategy stacks additively
  const layout = structuredClone(state.lastBets);
  clearPlayerBets(state);
  assert.equal(applySavedBets(state, layout, "strategy"), true);
  assert.equal(totalStaked(state), 15);
  assert.equal(applySavedBets(state, layout, "strategy"), true);
  assert.equal(totalStaked(state), 30, "second strategy apply stacks");
  assert.equal(applySavedBets(state, layout, "strategy"), true);
  assert.equal(totalStaked(state), 45, "third strategy apply stacks");
  assert.equal(state.bets.find((b) => b.betId === "red")!.stake, 30);
  assert.equal(undoChip(state), true);
  assert.equal(totalStaked(state), 30, "undo removes last strategy package only");

  // Double still works
  const state2 = createPlayerGame("european", 200, false, "en", () => 0.5);
  openPlayerBetting(state2);
  placeChip(state2, "red", 10);
  placeChip(state2, "straight_1", 5);
  assert.equal(requestPlayerSpin(state2), true);
  settlePlayerRound(state2, "2");
  finishPlayerRound(state2);
  openPlayerBetting(state2);
  assert.equal(rebetLast(state2), true);
  assert.equal(doubleBets(state2), true);
  assert.equal(totalStaked(state2), 30);
  assert.equal(doubleBets(state2), true);
  assert.equal(totalStaked(state2), 60);

  const poor = createPlayerGame("european", 20, false, "en", () => 0.5);
  openPlayerBetting(poor);
  placeChip(poor, "red", 10);
  assert.equal(doubleBets(poor), true);
  assert.equal(totalStaked(poor), 20);
  assert.equal(doubleBets(poor), false, "no free points left to double again");
  assert.equal(requestPlayerSpin(poor), true);
});

test("Player table coverage: unique pockets / 37 EU or 38 US", () => {
  const eu = createPlayerGame("european", 500, false, "en", () => 0.5);
  openPlayerBetting(eu);
  assert.deepEqual(tableCoverage(eu), { covered: 0, total: 37, percent: 0 });
  setSelectedChip(eu, 10);
  placeChip(eu, "straight_17");
  assert.equal(tableCoverage(eu).covered, 1);
  assert.equal(tableCoverage(eu).percent, Math.round((1 / 37) * 100));
  placeChip(eu, "red"); // red covers 18 pockets; 17 is black so still +18 unique? 17 black, red is 18
  // 1 straight + 18 red = 19 unique (17 not in red)
  assert.equal(tableCoverage(eu).covered, 19);
  const us = createPlayerGame("american", 100, false, "en", () => 0.5);
  openPlayerBetting(us);
  assert.equal(tableCoverage(us).total, 38);
  setSelectedChip(us, 10);
  placeChip(us, "straight_00");
  assert.equal(tableCoverage(us).covered, 1);
});

test("Player free spin: SPIN with no chips allowed; score unchanged", () => {
  const state = createPlayerGame("european", 50, false, "en", () => 0.5);
  openPlayerBetting(state);
  assert.equal(state.bets.length, 0);
  assert.equal(requestPlayerSpin(state), true);
  assert.equal(state.phase, "SPINNING");
  const settle = settlePlayerRound(state, "17");
  assert.equal(settle.totalStaked, 0);
  assert.equal(settle.netDelta, 0);
  assert.equal(state.tableScore, 50);
  assert.equal(state.stats.wins, 0);
  assert.equal(state.stats.losses, 0);
  finishPlayerRound(state);
  assert.equal(state.phase, "PREPARE");
});

test("Player out at zero and cashOut returns residual to Accumulated", () => {
  const state = createPlayerGame("european", 10, false, "en", () => 0.5);
  openPlayerBetting(state);
  placeChip(state, "straight_1", 10);
  assert.equal(requestPlayerSpin(state), true);
  settlePlayerRound(state, "2");
  assert.equal(state.tableScore, 0);
  finishPlayerRound(state);
  assert.equal(state.phase, "GAME_OVER");

  const state2 = createPlayerGame("european", 40, false, "en", () => 0.5);
  openPlayerBetting(state2);
  placeChip(state2, "red", 10);
  let profile = createEmptyProfile();
  profile.walletUnits = 999; // stale profile — exit overwrites with live residual
  const out = cashOutPlayer(state2, profile);
  assert.equal(out.returned, 40, "open bet cleared back into free score before exit");
  assert.equal(out.profile.walletUnits, 40, "single score pool written on exit");
  assert.equal(state2.phase, "GAME_OVER");
});

test("Player session stats track profit, wins, losses and bankroll curve", () => {
  const state = createPlayerGame("european", 100, false, "en", () => 0.5);
  assert.equal(state.stats.startingScore, 100);
  assert.deepEqual(state.stats.bankrollHistory, [100]);
  assert.equal(playerProfit(state), 0);

  openPlayerBetting(state);
  placeChip(state, "straight_17", 10); // 17 wins 35:1
  assert.equal(requestPlayerSpin(state), true);
  settlePlayerRound(state, "17");
  assert.equal(state.stats.wins, 1);
  assert.equal(state.stats.losses, 0);
  assert.equal(state.tableScore, 450); // 90 free + 360 return
  assert.deepEqual(state.stats.bankrollHistory, [100, 450]);
  assert.equal(playerProfit(state), 350);
  finishPlayerRound(state);

  openPlayerBetting(state);
  placeChip(state, "red", 50);
  assert.equal(requestPlayerSpin(state), true);
  settlePlayerRound(state, "2"); // 2 is black → lose
  assert.equal(state.stats.wins, 1);
  assert.equal(state.stats.losses, 1);
  assert.equal(state.tableScore, 400);
  assert.deepEqual(state.stats.bankrollHistory, [100, 450, 400]);
  assert.equal(playerProfit(state), 300);

  const snap = snapshotPlayer(state);
  assert.ok(snap.playerStats);
  assert.equal(snap.playerStats!.wins, 1);
  assert.equal(snap.playerStats!.losses, 1);
  const restored = restorePlayerFromSnapshot(snap);
  assert.ok(restored);
  assert.equal(restored!.stats.wins, 1);
  assert.equal(restored!.stats.losses, 1);
  assert.deepEqual(restored!.stats.bankrollHistory, [100, 450, 400]);
  assert.equal(restored!.stats.startingScore, 100);
});

test("Player snapshot v5 round-trips an open betting hand", () => {
  const state = createPlayerGame("american", 50, true, "it", () => 0.2);
  openPlayerBetting(state);
  placeChip(state, "straight_00", 5);
  const snap = snapshotPlayer(state);
  assert.equal(snap.schemaVersion, 5);
  assert.equal(snap.mode, "player");
  const restored = restorePlayerFromSnapshot(snap);
  assert.ok(restored);
  assert.equal(restored!.locale, "it");
  assert.equal(restored!.variant, "american");
  assert.equal(restored!.phase, "BETTING_OPEN");
  assert.equal(restored!.tableScore, 45);
  assert.equal(restored!.bets[0]?.betId, "straight_00");
  assert.ok(restored!.bets.every((b) => typeof b.betId === "string"));
});

test("Felt magnetic snap: cell edges resolve to split/corner/street/first-four", async () => {
  const { resolveNumberCellSnap, resolveEuropeanZeroSnap, resolveAmericanZeroSnap } = await import("../player/feltSnap.ts");
  // Center of 17 (col 5, row 1: pocket = 6*3-1 = 17)
  const mid = resolveNumberCellSnap(5, 1, 0.5, 0.5);
  assert.equal(mid.betId, "straight_17");
  assert.equal(mid.kind, "straight");
  // Right edge → split toward 20
  const east = resolveNumberCellSnap(5, 1, 0.98, 0.5);
  assert.equal(east.kind, "split");
  assert.ok(east.betId.includes("17") && east.betId.includes("20"), east.betId);
  // SE corner of top-left of block → corner
  const se = resolveNumberCellSnap(0, 1, 0.98, 0.98);
  assert.equal(se.kind, "corner");
  assert.equal(se.betId, "corner_1_2_4_5");

  // Finger-friendly magnetic area: users need not hit the exact intersection.
  assert.equal(resolveNumberCellSnap(5, 1, 0.69, 0.69).kind, "corner");
  assert.equal(resolveNumberCellSnap(5, 1, 0.31, 0.31).kind, "corner");
  assert.equal(resolveNumberCellSnap(5, 1, 0.69, 0.31).kind, "corner");
  assert.equal(resolveNumberCellSnap(5, 1, 0.31, 0.69).kind, "corner");
  // Bottom of street 1 (col 0 row 2 = number 1)
  const street = resolveNumberCellSnap(0, 2, 0.5, 0.98);
  assert.equal(street.kind, "street");
  assert.equal(street.betId, "street_1_2_3");
  // Mid 0|2 edge = split 0-2 (NOT first four — that was the false "circle between 0 and 2")
  const mid02 = resolveEuropeanZeroSnap(0.95, 0.5);
  assert.equal(mid02.betId, "split_0_2", mid02.betId);
  // Outer bottom corner of zero (classic 0-1 / first-dozen rail) → first four
  const fourBot = resolveEuropeanZeroSnap(0.98, 0.98);
  assert.equal(fourBot.betId, "first_four_0_1_2_3", fourBot.betId);
  const fourTop = resolveEuropeanZeroSnap(0.98, 0.02);
  assert.equal(fourTop.betId, "first_four_0_1_2_3", fourTop.betId);
  // Portrait owns one explicit DOM target; generic zero/number magnets must not
  // produce a second first-four preview on the opposite felt edge.
  const portraitZeroFallback = resolveEuropeanZeroSnap(0.98, 0.98, false);
  assert.notEqual(portraitZeroFallback.betId, "first_four_0_1_2_3");
  const portraitOneFallback = resolveNumberCellSnap(0, 2, 0.02, 0.98, "european", false);
  assert.notEqual(portraitOneFallback.betId, "first_four_0_1_2_3");
  // From number 1 left-bottom toward zero → first four (EU)
  const from1 = resolveNumberCellSnap(0, 2, 0.02, 0.98, "european");
  assert.equal(from1.betId, "first_four_0_1_2_3", from1.betId);
  // US five-number on outer corner of zero
  const five = resolveAmericanZeroSnap(0.98, 0.98);
  assert.equal(five.betId, "five_number_0_00_1_2_3", five.betId);
  // US from number 1 must not invent EU first-four
  const usFrom1 = resolveNumberCellSnap(0, 2, 0.02, 0.98, "american");
  assert.notEqual(usFrom1.betId, "first_four_0_1_2_3");
});

test("Player Bet Creator draft does not spend score; apply strategy places on table", () => {
  const draft = createBetCreatorDraft("european", { selectedChip: 10 });
  assert.equal(placeDraftChip(draft, "red", 10), true);
  assert.equal(placeDraftChip(draft, "straight_17", 5), true);
  assert.equal(draftTotal(draft), 15);
  assert.equal(draft.bets.length, 2);

  const state = createPlayerGame("european", 100, false, "en", () => 0.5);
  openPlayerBetting(state);
  placeChip(state, "black", 10); // strategy stacks on top — black stays
  assert.equal(applySavedBets(state, draft.bets, "strategy"), true);
  assert.equal(totalStaked(state), 25, "10 black + 15 strategy");
  assert.equal(state.tableScore, 75);
  assert.equal(state.bets.find((b) => b.betId === "black")!.stake, 10);
  assert.equal(state.bets.find((b) => b.betId === "red")!.stake, 10);
  assert.equal(state.bets.find((b) => b.betId === "straight_17")!.stake, 5);

  const poor = createPlayerGame("european", 10, false, "en", () => 0.5);
  openPlayerBetting(poor);
  assert.equal(applySavedBets(poor, draft.bets, "strategy"), false);
  assert.equal(totalStaked(poor), 0);

  clearDraftBets(draft);
  assert.equal(draftTotal(draft), 0);
});

test("Bet Creator can copy the live table layout without spending more score", () => {
  const state = createPlayerGame("european", 100, false, "en", () => 0.5);
  openPlayerBetting(state);
  assert.equal(placeChip(state, "red", 10), true);
  assert.equal(placeChip(state, "straight_17", 5), true);
  const layout = tableLayoutForStrategy(state);
  assert.equal(layout.length, 2);
  assert.equal(layout.reduce((sum, bet) => sum + bet.stake, 0), 15);

  const draft = createBetCreatorDraft(state.variant, { bets: layout, selectedChip: 10 });
  assert.equal(draftTotal(draft), 15);
  assert.equal(state.tableScore, 85, "opening the creator must not spend table score again");
  assert.equal(totalStaked(state), 15);
});

test("strategy prefill falls back to the last settled hand after chips leave the felt", () => {
  const state = createPlayerGame("european", 100, false, "en", () => 0.5);
  openPlayerBetting(state);
  placeChip(state, "black", 10);
  state.lastBets = structuredClone(state.bets);
  state.tableScore += totalStaked(state);
  state.bets = [];
  state.chipHistory = [];
  const layout = tableLayoutForStrategy(state);
  assert.deepEqual(layout, [{ betId: "black", stake: 10 }]);
});

test("restoreStarterBankroll resets score without mutating the profile", () => {
  const profile = { ...createEmptyProfile(), walletUnits: 12 };
  const restored = restoreStarterBankroll(profile);
  assert.equal(restored.walletUnits, STARTER_SCORE);
  assert.equal(restored.starterScoreGranted, true);
  assert.equal(profile.walletUnits, 12, "original profile is not mutated");
});

test("editing a saved Bet Creator strategy reconstructs undoable chip history", () => {
  const draft = createBetCreatorDraft("european", {
    editingId: "saved-layout",
    bets: [
      { betId: "red", stake: 15 },
      { betId: "straight_17", stake: 2 },
    ],
    selectedChip: 10,
  });

  assert.deepEqual(draft.chipHistory, [
    { betId: "red", denomination: 5 },
    { betId: "red", denomination: 10 },
    { betId: "straight_17", denomination: 2 },
  ]);
  assert.equal(undoDraftChip(draft), true);
  assert.equal(draft.bets.some((bet) => bet.betId === "straight_17"), false);
  assert.equal(undoDraftChip(draft), true);
  assert.equal(draft.bets.find((bet) => bet.betId === "red")?.stake, 5);
});

test("Racetrack call packages expand to catalog bets with classic chip counts", () => {
  const voisins = getSectorPackage("voisins");
  assert.equal(voisins.chipCount, 9);
  assert.equal(voisins.pockets.length, 17);
  assert.deepEqual(new Set(voisins.pockets), new Set(SECTOR_POCKETS.voisins));
  const tiers = getSectorPackage("tiers");
  assert.equal(tiers.chipCount, 6);
  assert.equal(tiers.pockets.length, 12);
  const orph = getSectorPackage("orphelins");
  assert.equal(orph.chipCount, 5);
  assert.equal(orph.pockets.length, 8);
  const jeu = getSectorPackage("jeuZero");
  assert.equal(jeu.chipCount, 4);

  const unit = 10;
  assert.equal(packageCost(voisins.lines, unit), 90);
  const expanded = expandRecipe(voisins.lines, unit);
  assert.equal(expanded.reduce((s, b) => s + b.stake, 0), 90);
  assert.ok(expanded.some((b) => b.betId === "trio_0_2_3" && b.stake === 20));
  assert.ok(expanded.some((b) => b.betId === "corner_25_26_28_29" && b.stake === 20));
});

test("Neighbors package uses wheel order (center ± radius)", () => {
  const pockets = wheelPockets("european");
  assert.equal(pockets[0], "0");
  // center 23, radius 2 → 5 numbers on EU wheel
  const pack = getNeighborsPackage("european", "23", 2);
  assert.ok(pack);
  assert.equal(pack!.chipCount, 5);
  assert.deepEqual(pack!.pockets, neighborPockets("european", "23", 2));
  // wrap around zero
  const around0 = neighborPockets("european", "0", 1)!;
  assert.equal(around0.length, 3);
  assert.equal(around0[1], "0");
  assert.ok(around0.includes(pockets[pockets.length - 1]!));
  assert.ok(around0.includes(pockets[1]!));
});

test("placeBetsPackage places call macro additively and rejects when free score too low", () => {
  const state = createPlayerGame("european", 100, false, "en", () => 0.5);
  openPlayerBetting(state);
  placeChip(state, "red", 10);
  const voisins = expandRecipe(getSectorPackage("voisins").lines, 10); // 90
  assert.equal(placeBetsPackage(state, voisins), true);
  assert.equal(totalStaked(state), 100); // 10 + 90
  assert.equal(state.tableScore, 0);
  assert.ok(state.bets.find((b) => b.betId === "red")!.stake === 10);
  assert.ok(state.bets.find((b) => b.betId === "trio_0_2_3")!.stake === 20);

  const poor = createPlayerGame("european", 50, false, "en", () => 0.5);
  openPlayerBetting(poor);
  assert.equal(placeBetsPackage(poor, voisins), false);
  assert.equal(totalStaked(poor), 0);
  assert.equal(poor.tableScore, 50);
});
