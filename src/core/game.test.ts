import assert from "node:assert/strict";
import { closeBets, createGame, markSpinning, openBetting, pay, resolveSpin, selectPayment } from "./game.ts";

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
  assert.equal(pay(game), "invalid");
  assert.equal(selectPayment(game, game.seats[0].id), true);
  game.expectedTaps = 2;
  const before = game.seats[0].bankroll;
  assert.equal(pay(game), "paid");
  assert.equal(pay(game), "complete");
  assert.equal(game.seats[0].bankroll - before, 15);
  assert.equal(pay(game), "overpay");
  assert.equal(game.seats[0].bankroll - before, 15);
});

test("score equals losing stakes minus winning profits", () => {
  const game = createGame("dealer", "standard", "european", false, () => 0.5);
  game.seats = game.seats.slice(0, 2);
  game.seats[0].bankroll = 100;
  game.seats[1].bankroll = 100;
  game.seats[0].bets = [{ betId: "red", stake: 10 }];
  game.seats[1].bets = [{ betId: "black", stake: 10 }];

  resolveSpin(game, "1", () => 0.99);

  assert.equal(game.score, 10, "the house first books the losing black stake");
  assert.equal(game.seats[0].bankroll, 100, "the winning stake is returned automatically");
  assert.equal(game.seats[1].bankroll, 90);
  assert.equal(game.paymentIndex, -1, "the system must not choose a winner for the dealer");
  assert.equal(pay(game), "invalid");
  assert.equal(selectPayment(game, game.seats[0].id), true);
  assert.equal(pay(game), "complete");
  assert.equal(game.score, 0, "house score is losses collected minus profit paid");
  assert.equal(game.seats[0].bankroll, 110);
});
