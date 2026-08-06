import "./styles.css";
import controlsConfig from "../config/controls.json" with { type: "json" };
import { closeBets, createGame, finishRound, getPreset, markSpinning, openBetting, pay, payoutTimeout, resolveSpin, snapshot, type GameState } from "./core/game.ts";
import type { GameMode, TableVariant } from "./core/types.ts";
import { spin } from "./spin/spinEngine.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
let game: GameState | null = null;
let timer: number | null = null;
let wheelAngle = 0;
let selectedMode: GameMode = "dealer";

function showMenu(): void {
  stopTimer();
  game = null;
  app.innerHTML = `
    <main class="landing">
      <section class="brand-card">
        <div class="eyebrow">LOCAL-FIRST · 8-BIT ROULETTE</div>
        <h1>BIT<span>CROUPIER</span></h1>
        <p class="tagline">Roulette from both sides of the table</p>
        <div class="mode-grid" role="group" aria-label="Game mode">
          <button class="mode-card active" data-mode="dealer"><b>DEALER</b><span>Run the table. Pay fast. Stay sharp.</span></button>
          <button class="mode-card locked" disabled><b>PLAYER</b><span>Coming in v0.3 · earn units as Dealer</span></button>
          <button class="mode-card" data-mode="autoplay"><b>AUTOPLAY</b><span>Watch a complete demo run</span></button>
        </div>
        <form id="setup" class="setup-panel">
          <label>Difficulty<select name="preset"><option value="training">Training</option><option value="standard" selected>Standard</option><option value="busy">Busy</option><option value="rush">Rush</option></select></label>
          <label>Wheel<select name="variant"><option value="european">European · 0</option><option value="american">American · 0 + 00</option></select></label>
          <label class="toggle"><input type="checkbox" name="animation" checked /> Wheel animation</label>
          <button class="start-button" type="submit">START SHIFT <span>→</span></button>
        </form>
        <footer>Entertainment only · No real money · Data stays on your device</footer>
      </section>
    </main>`;
  app.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => button.addEventListener("click", () => {
    selectedMode = button.dataset.mode as GameMode;
    app.querySelectorAll("[data-mode]").forEach((item) => item.classList.toggle("active", item === button));
  }));
  app.querySelector<HTMLFormElement>("#setup")!.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    game = createGame(selectedMode, String(data.get("preset")), String(data.get("variant")) as TableVariant, data.get("animation") === "on");
    renderTable();
    window.setTimeout(nextRound, 700);
  });
}

function renderTable(): void {
  if (!game) return;
  const preset = getPreset(game.presetId);
  const current = game.payments[game.paymentIndex];
  const dueLeft = current ? current.due - current.paid : 0;
  const clicksTotal = current ? Math.ceil(current.due / preset.chipValue) : 0;
  const clicksDone = current ? Math.ceil(current.paid / preset.chipValue) : 0;
  const resultClass = game.result === "0" || game.result === "00" ? "green" : isRed(game.result) ? "red" : "black";
  const saveButton = game.mode === "dealer" && controlsConfig.hudChrome.dealerMode.showSaveButton ? `<button id="save" class="chrome-button">SAVE</button>` : "";
  app.innerHTML = `
    <main class="game-shell">
      <header class="arcade-strip">
        <div class="metric"><span>LEVEL</span><strong>${pad(game.level)}</strong></div>
        <div class="metric"><span>ENERGY</span><strong class="energy">${game.mode === "autoplay" ? "∞" : energyBar(game.energy, game.energyMax)}</strong></div>
        <div class="metric score"><span>SCORE</span><strong>${format(game.score)}<small> u</small></strong></div>
        <div class="meta"><b>${game.variant === "european" ? "EU" : "US"}</b> · ${game.presetId.toUpperCase()} · ROUND ${game.round}${game.mode === "autoplay" ? `<em>AUTOPLAY</em>` : ""}</div>
        <nav>${saveButton}<button id="exit" class="chrome-button danger">EXIT</button></nav>
      </header>
      <section class="phase-row"><span>${game.phase.replaceAll("_", " ")}</span><b>${game.message}</b>${game.bonus ? `<mark>BONUS! ${game.bonus}</mark>` : ""}<time>${phaseTime(game)}</time></section>
      <section class="table-grid">
        <aside class="wheel-panel">
          <div class="wheel-wrap"><div id="wheel" class="wheel ${game.phase === "SPINNING" ? "spinning" : ""}" style="--wheel-angle:${wheelAngle}deg"><div class="wheel-center">BC</div></div><div class="ball">●</div></div>
          <div class="last-result ${resultClass}">${game.result ?? "—"}</div>
          <div class="history"><span>LAST NUMBERS</span><div>${game.history.length ? game.history.slice(0, 12).map(numberChip).join("") : `<i>First spin awaits</i>`}</div></div>
        </aside>
        <section class="felt-panel">
          <div class="felt-grid">${buildFelt(game.variant, game.result)}</div>
          <div class="payout-card ${game.phase === "PAYOUT" ? "visible" : ""}">
            <span class="kicker">${current ? `PAY → ${current.seatName}` : game.phase === "PAYOUT" ? "TABLE CLEAR" : "CROUPIER CONTROL"}</span>
            <strong>${current ? `${dueLeft} units left` : phaseInstruction(game)}</strong>
            ${current ? `<div class="click-count">CLICKS <b>${clicksDone} / ${clicksTotal}</b></div><small>CHIP ${preset.chipValue} · DO NOT OVERPAY</small>` : `<small>${game.mode === "autoplay" ? "AI RUNNING THE TABLE" : "SPACE = PRIMARY ACTION"}</small>`}
            <button id="primary" class="primary-action" ${primaryDisabled(game) ? "disabled" : ""}>${primaryLabel(game)}</button>
          </div>
        </section>
      </section>
      <section class="seats">${game.seats.map((seat) => `<article class="seat ${current?.seatId === seat.id ? "current" : ""}"><span>${seat.name}</span><strong>${format(seat.bankroll)} u</strong><small>${seat.bets.length} BET${seat.bets.length === 1 ? "" : "S"}</small></article>`).join("")}</section>
      <footer class="table-footer"><span>BITCROUPIER · HOUSE FLOOR 01</span><span>${game.mode === "autoplay" ? "DEMO — NO WALLET EARNINGS" : "LOCAL AUTOSAVE ON"}</span></footer>
    </main>`;
  app.querySelector<HTMLButtonElement>("#primary")?.addEventListener("click", primaryAction);
  app.querySelector<HTMLButtonElement>("#save")?.addEventListener("click", saveGame);
  app.querySelector<HTMLButtonElement>("#exit")?.addEventListener("click", () => {
    if (game?.mode === "dealer") saveLocal();
    showMenu();
  });
}

function primaryAction(): void {
  if (!game || game.mode === "autoplay") return;
  if (game.phase === "BETTING_OPEN") { closeBets(game); renderTable(); }
  else if (game.phase === "BETTING_CLOSED") performSpin();
  else if (game.phase === "PAYOUT") {
    const outcome = pay(game);
    renderTable();
    if (outcome === "complete") window.setTimeout(completeRound, 650);
  }
}

function nextRound(): void {
  if (!game) return;
  openBetting(game);
  renderTable();
  startTimer("betting");
  if (game.mode === "autoplay") window.setTimeout(() => { if (game?.phase === "BETTING_OPEN") { closeBets(game); renderTable(); window.setTimeout(performSpin, 650); } }, 1700);
}

function performSpin(): void {
  if (!game || !markSpinning(game)) return;
  stopTimer();
  const plan = spin({ spinPower: 6, consistency: 6, releaseStyle: "snap_clockwise" }, game.variant);
  wheelAngle += plan.finalAngle;
  renderTable();
  const delay = game.animationEnabled ? 2400 : 180;
  window.setTimeout(() => {
    if (!game) return;
    resolveSpin(game, plan.winningNumber);
    renderTable();
    if (game.payments.length === 0) window.setTimeout(completeRound, 900);
    else { startTimer("payout"); if (game.mode === "autoplay") autoplayPay(); }
  }, delay);
}

function autoplayPay(): void {
  if (!game || game.mode !== "autoplay" || game.phase !== "PAYOUT") return;
  const outcome = pay(game);
  renderTable();
  if (outcome === "complete") window.setTimeout(completeRound, 700);
  else window.setTimeout(autoplayPay, 180);
}

function completeRound(): void {
  if (!game || game.phase === "GAME_OVER") return;
  stopTimer();
  finishRound(game);
  saveLocal();
  renderTable();
  window.setTimeout(nextRound, 850);
}

function startTimer(kind: "betting" | "payout"): void {
  stopTimer();
  timer = window.setInterval(() => {
    if (!game) return;
    if (kind === "betting" && game.phase === "BETTING_OPEN") {
      game.bettingSeconds = Math.max(0, game.bettingSeconds - 1);
      if (game.bettingSeconds === 0) { closeBets(game); stopTimer(); renderTable(); if (game.mode === "autoplay") window.setTimeout(performSpin, 650); }
      else renderTable();
    } else if (kind === "payout" && game.phase === "PAYOUT") {
      game.paySeconds = Math.max(0, game.paySeconds - 1);
      if (game.paySeconds === 0) { payoutTimeout(game); stopTimer(); renderTable(); if (game.energy > 0 || game.mode === "autoplay") window.setTimeout(completeRound, 900); }
      else renderTable();
    }
  }, 1000);
}

function stopTimer(): void { if (timer !== null) window.clearInterval(timer); timer = null; }

function saveLocal(): void {
  if (!game || game.mode !== "dealer") return;
  localStorage.setItem("bitcroupier.session.v1", JSON.stringify(snapshot(game)));
}

function saveGame(): void {
  if (!game) return;
  saveLocal();
  const blob = new Blob([JSON.stringify(snapshot(game), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `bitcroupier-round-${game.round}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  game.message = "Session saved locally + exported";
  renderTable();
}

function primaryLabel(state: GameState): string {
  if (state.mode === "autoplay") return "AI IN CONTROL";
  if (state.phase === "BETTING_OPEN") return "NO MORE BETS";
  if (state.phase === "BETTING_CLOSED") return "SPIN";
  if (state.phase === "PAYOUT") return "PAY";
  if (state.phase === "GAME_OVER") return "SHIFT OVER";
  return "STAND BY";
}

function primaryDisabled(state: GameState): boolean { return state.mode === "autoplay" || !["BETTING_OPEN", "BETTING_CLOSED", "PAYOUT"].includes(state.phase); }
function phaseInstruction(state: GameState): string { return state.phase === "BETTING_OPEN" ? "Watch the NPC bets" : state.phase === "BETTING_CLOSED" ? "The table is locked" : state.phase === "SPINNING" ? "Ball in motion" : state.phase === "GAME_OVER" ? `LEVEL ${state.level} · SCORE ${state.score}` : "Ready for the next call"; }
function phaseTime(state: GameState): string { return state.phase === "BETTING_OPEN" ? `00:${String(Math.ceil(state.bettingSeconds)).padStart(2, "0")}` : state.phase === "PAYOUT" ? `00:${String(Math.ceil(state.paySeconds)).padStart(2, "0")}` : "—"; }
function pad(value: number): string { return String(value).padStart(2, "0"); }
function format(value: number): string { return new Intl.NumberFormat("en-US").format(value); }
function energyBar(value: number, max: number): string { return Array.from({ length: max }, (_, index) => index < value ? "◆" : "◇").join(""); }
const redNumbers = new Set(["1","3","5","7","9","12","14","16","18","19","21","23","25","27","30","32","34","36"]);
function isRed(value: string | null): boolean { return value ? redNumbers.has(value) : false; }
function numberChip(value: string): string { const color = value === "0" || value === "00" ? "green" : isRed(value) ? "red" : "black"; return `<b class="number ${color}">${value}</b>`; }
function buildFelt(variant: TableVariant, result: string | null): string {
  const cells = Array.from({ length: 36 }, (_, index) => String(index + 1));
  return `<div class="zero-zone">${variant === "american" ? `<b class="green ${result === "00" ? "hit" : ""}">00</b>` : ""}<b class="green ${result === "0" ? "hit" : ""}">0</b></div><div class="numbers">${cells.map((number) => `<b class="${isRed(number) ? "red" : "black"} ${result === number ? "hit" : ""}">${number}</b>`).join("")}</div><div class="outside"><span>1ST 12</span><span>2ND 12</span><span>3RD 12</span><span>RED</span><span>BLACK</span><span>ODD</span></div>`;
}

document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && game) { event.preventDefault(); primaryAction(); }
  if (event.code === "Escape" && game) showMenu();
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}

showMenu();
