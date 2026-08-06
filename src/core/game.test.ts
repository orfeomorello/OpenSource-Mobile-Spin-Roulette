import assert from "node:assert/strict";
import { closeBets, createGame, markSpinning, openBetting, pay, resolveSpin } from "./game.ts";

function test(name: string, body: () => void): void {
  try {
    body();
    console.log(`? ${name}`);
  } catch (error) {
    console.error(`? ${name}`);
    throw error;
  }
}

test("dealer phase flow reaches payout", () => {
  const game = createGame("dealer", "standard", "european", false, () => 0.5);
  openBetting(game, () => 0.5);
  assert.equal(game.phase, "BETTING_OPEN");
  assert.equal(closeBets(game), true);
  assert.equal(markSpinning(game), true);
  resolveSpin(game, "0", () => 0.99);
  assert.equal(game.phase, "PAYOUT");
  assert.equal(game.history[0], "0");
});

test("pay never credits beyond the amount due", () => {
  const game = createGame("dealer", "standard", "european", false, () => 0.5);
  game.phase = "PAYOUT";
  game.payments = [{ seatId: game.seats[0].id, seatName: game.seats[0].name, due: 15, paid: 0 }];
  game.expectedTaps = 2;
  const before = game.seats[0].bankroll;
  assert.equal(pay(game), "paid");
  assert.equal(pay(game), "complete");
  assert.equal(game.seats[0].bankroll - before, 15);
  assert.equal(pay(game), "overpay");
  assert.equal(game.seats[0].bankroll - before, 15);
});
