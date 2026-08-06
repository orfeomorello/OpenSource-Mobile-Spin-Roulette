import "./styles.css";
import controlsConfig from "../config/controls.json" with { type: "json" };
import wheelConfig from "../config/wheel-spin.json" with { type: "json" };
import europeanBets from "../config/bets-european.json" with { type: "json" };
import americanBets from "../config/bets-american.json" with { type: "json" };
import { closeBets, createGame, finishRound, getPreset, markSpinning, openBetting, pay, payoutTimeout, resolveSpin, snapshot, type GameState } from "./core/game.ts";
import type { BetDefinition, GameMode, Seat, TableVariant } from "./core/types.ts";
import { spin } from "./spin/spinEngine.ts";
import { isMuted, playSound, setMuted } from "./audio.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
let game: GameState | null = null;
let timer: number | null = null;
let selectedMode: GameMode = "dealer";
let lastFx = "";
let fxTimer: number | null = null;
let spinTickTimers: number[] = [];

function showMenu(): void {
  stopTimer();
  game = null;
  app.innerHTML = `
    <main class="landing">
      <section class="brand-card">
        <div class="eyebrow">LOCAL-FIRST · 8-BIT ROULETTE</div>
        <h1>BIT<span>CROUPIER</span></h1>
        <p class="tagline">Roulette from both sides of the table</p>
        <div class="role-explainer">
          <b>YOUR SHIFT IN 3 MOVES</b>
          <span>1 / Let customers bet</span><span>2 / Close and spin</span><span>3 / Pay every winner before time runs out</span>
        </div>
        <div class="mode-grid" role="group" aria-label="Game mode">
          <button class="mode-card active" data-mode="dealer"><b>DEALER</b><span>You control the calls, launch the ball and physically pay the winners.</span></button>
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
    playSound("bet");
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
  const displayResult = game.result ?? game.history[0] ?? null;
  const resultClass = displayResult === "0" || displayResult === "00" ? "green" : isRed(displayResult) ? "red" : "black";
  const saveButton = game.mode === "dealer" && controlsConfig.hudChrome.dealerMode.showSaveButton ? `<button id="save" class="chrome-button">SAVE</button>` : "";
  const guideStep = game.phase === "BETTING_OPEN" ? 1 : ["BETTING_CLOSED", "SPINNING", "RESULT"].includes(game.phase) ? 2 : game.phase === "PAYOUT" ? 3 : 0;
  const progress = current ? Math.round((current.paid / current.due) * 100) : 0;
  app.innerHTML = `
    <main class="game-shell ${lastFx ? `fx-${lastFx}` : ""}">
      <header class="arcade-strip">
        <div class="metric"><span>LEVEL</span><strong>${pad(game.level)}</strong></div>
        <div class="metric"><span>ENERGY</span><strong class="energy">${game.mode === "autoplay" ? "∞" : energyBar(game.energy, game.energyMax)}</strong></div>
        <div class="metric score"><span>SCORE</span><strong>${format(game.score)}<small> u</small></strong></div>
        <div class="meta"><b>${game.variant === "european" ? "EU" : "US"}</b> · ${game.presetId.toUpperCase()} · ROUND ${game.round}${game.mode === "autoplay" ? `<em>AUTOPLAY</em>` : ""}</div>
        <nav><button id="sound" class="chrome-button" aria-label="Toggle sound">${isMuted() ? "SOUND OFF" : "SOUND ON"}</button>${saveButton}<button id="exit" class="chrome-button danger">EXIT</button></nav>
      </header>
      <section class="dealer-guide">
        <div class="your-role"><span>YOU ARE</span><b>${game.mode === "autoplay" ? "WATCHING THE CROUPIER" : "THE CROUPIER"}</b></div>
        ${guideItem(1, "BETTING", "Customers place chips", guideStep)}
        ${guideItem(2, "SPIN", "Lock bets and launch", guideStep)}
        ${guideItem(3, "PAYOUT", "Pay winners in time", guideStep)}
      </section>
      <section class="phase-row"><span>${phaseTitle(game)}</span><b>${phaseHelp(game)}</b>${game.bonus ? `<mark>BONUS! ${game.bonus}</mark>` : ""}<time class="${phaseCritical(game) ? "critical" : ""}">${phaseTime(game)}</time></section>
      <section class="table-grid">
        <aside class="wheel-panel">
          ${buildWheel(game.variant, game.result, game.phase === "SPINNING" && game.animationEnabled)}
          <div class="last-result ${resultClass}">${displayResult ?? "—"}</div>
          <div class="history"><span>LAST NUMBERS</span><div>${game.history.length ? game.history.slice(0, 12).map(numberChip).join("") : `<i>First spin awaits</i>`}</div></div>
        </aside>
        <section class="felt-panel">
          <div class="felt-heading"><span>LIVE TABLE / ${game.variant.toUpperCase()}</span><small>CHIPS SHOW WHERE EACH CUSTOMER BET</small></div>
          <div class="felt-grid">${buildFelt(game.variant, game.result, game.seats)}</div>
          <div class="payout-card ${game.phase === "PAYOUT" ? "visible" : ""}">
            <span class="kicker">${current ? `PAY → ${current.seatName}` : game.phase === "PAYOUT" ? "TABLE CLEAR" : "CROUPIER CONTROL"}</span>
            <strong>${current ? `${dueLeft} units left` : phaseInstruction(game)}</strong>
            ${current ? `<div class="click-count">CLICKS <b>${clicksDone} / ${clicksTotal}</b><span>LEFT ${clicksTotal - clicksDone}</span></div><div class="pay-progress"><i style="width:${progress}%"></i></div><small>EACH PRESS SENDS ${preset.chipValue} u / STOP AT ZERO</small><i class="flying-chip">${preset.chipValue}</i>` : `<small>${game.mode === "autoplay" ? "AI RUNNING THE TABLE" : "SPACE = PRIMARY ACTION"}</small>`}
            <button id="primary" class="primary-action" ${primaryDisabled(game) ? "disabled" : ""}>${primaryLabel(game)}</button>
          </div>
        </section>
      </section>
      <section class="seats">${game.seats.map((seat, index) => `<article class="seat seat-${index + 1} ${current?.seatId === seat.id ? "current" : ""}"><i>${seat.name.slice(0, 1)}</i><span>${seat.name}</span><strong>${format(seat.bankroll)} u</strong><small>${betSummary(seat, game!.variant)}</small></article>`).join("")}</section>
      <footer class="table-footer"><span>BITCROUPIER · HOUSE FLOOR 01</span><span>${game.mode === "autoplay" ? "DEMO — NO WALLET EARNINGS" : "LOCAL AUTOSAVE ON"}</span></footer>
      ${game.phase === "RESULT" || (game.phase === "PAYOUT" && game.result) ? `<div class="result-burst ${resultClass}"><small>WINNING NUMBER</small><b>${game.result}</b></div>` : ""}
    </main>`;
  app.querySelector<HTMLButtonElement>("#primary")?.addEventListener("click", primaryAction);
  app.querySelector<HTMLButtonElement>("#save")?.addEventListener("click", saveGame);
  app.querySelector<HTMLButtonElement>("#sound")?.addEventListener("click", () => { setMuted(!isMuted()); if (!isMuted()) playSound("bet"); renderTable(); });
  app.querySelector<HTMLButtonElement>("#exit")?.addEventListener("click", () => {
    if (game?.mode === "dealer") saveLocal();
    showMenu();
  });
}

function primaryAction(): void {
  if (!game || game.mode === "autoplay") return;
  if (game.phase === "BETTING_OPEN") { closeBets(game); playSound("close"); triggerFx("close"); renderTable(); }
  else if (game.phase === "BETTING_CLOSED") performSpin();
  else if (game.phase === "PAYOUT") {
    const outcome = pay(game);
    playSound(outcome === "overpay" ? "error" : "pay");
    triggerFx(outcome === "overpay" ? "overpay" : outcome === "complete" ? "perfect" : "pay");
    renderTable();
    if (outcome === "complete") window.setTimeout(completeRound, 650);
  }
}

function nextRound(): void {
  if (!game) return;
  openBetting(game);
  playSound("bet");
  triggerFx("bet");
  renderTable();
  startTimer("betting");
  if (game.mode === "autoplay") window.setTimeout(() => { if (game?.phase === "BETTING_OPEN") { closeBets(game); playSound("close"); triggerFx("close"); renderTable(); window.setTimeout(performSpin, 650); } }, 1900);
}

function performSpin(): void {
  if (!game || !markSpinning(game)) return;
  stopTimer();
  const plan = spin({ spinPower: 6, consistency: 6, releaseStyle: "snap_clockwise" }, game.variant);
  playSound("spin");
  triggerFx("spin", game.animationEnabled ? 4200 : 180);
  scheduleSpinTicks(game.animationEnabled ? 4200 : 0);
  renderTable();
  const delay = game.animationEnabled ? 4200 : 180;
  window.setTimeout(() => {
    if (!game) return;
    resolveSpin(game, plan.winningNumber);
    clearSpinTicks();
    playSound("settle");
    triggerFx("result", 900);
    renderTable();
    if (game.payments.length === 0) window.setTimeout(completeRound, 900);
    else { startTimer("payout"); if (game.mode === "autoplay") autoplayPay(); }
  }, delay);
}

function autoplayPay(): void {
  if (!game || game.mode !== "autoplay" || game.phase !== "PAYOUT") return;
  const outcome = pay(game);
  playSound(outcome === "overpay" ? "error" : "pay");
  triggerFx(outcome === "complete" ? "perfect" : "pay");
  renderTable();
  if (outcome === "complete") window.setTimeout(completeRound, 700);
  else window.setTimeout(autoplayPay, 280);
}

function completeRound(): void {
  if (!game || game.phase === "GAME_OVER") return;
  stopTimer();
  const levelBefore = game.level;
  finishRound(game);
  if (game.level > levelBefore) {
    playSound("level");
    triggerFx("level", 900);
  }
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
      if (game.bettingSeconds === 0) { closeBets(game); playSound("close"); triggerFx("close"); stopTimer(); renderTable(); if (game.mode === "autoplay") window.setTimeout(performSpin, 650); }
      else renderTable();
    } else if (kind === "payout" && game.phase === "PAYOUT") {
      game.paySeconds = Math.max(0, game.paySeconds - 1);
      if (game.paySeconds === 0) { payoutTimeout(game); playSound("error"); triggerFx("timeout", 900); stopTimer(); renderTable(); if (game.energy > 0 || game.mode === "autoplay") window.setTimeout(completeRound, 900); }
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
  if (state.phase === "BETTING_OPEN") return "CLOSE BETTING";
  if (state.phase === "BETTING_CLOSED") return "LAUNCH BALL";
  if (state.phase === "PAYOUT") {
    const current = state.payments[state.paymentIndex];
    const piece = current ? Math.min(getPreset(state.presetId).chipValue, current.due - current.paid) : 0;
    return current ? `PAY ${piece} u` : "PAYOUT COMPLETE";
  }
  if (state.phase === "GAME_OVER") return "SHIFT OVER";
  return "STAND BY";
}

function primaryDisabled(state: GameState): boolean { return state.mode === "autoplay" || !["BETTING_OPEN", "BETTING_CLOSED", "PAYOUT"].includes(state.phase); }
function phaseInstruction(state: GameState): string { return state.phase === "BETTING_OPEN" ? "Customers are choosing their bets" : state.phase === "BETTING_CLOSED" ? "Bets locked - launch the ball" : state.phase === "SPINNING" ? "Wheel clockwise / ball counter-clockwise" : state.phase === "GAME_OVER" ? `LEVEL ${state.level} / SCORE ${state.score}` : "Ready for the next call"; }
function phaseTime(state: GameState): string { return state.phase === "BETTING_OPEN" ? `00:${String(Math.ceil(state.bettingSeconds)).padStart(2, "0")}` : state.phase === "PAYOUT" ? `00:${String(Math.ceil(state.paySeconds)).padStart(2, "0")}` : "—"; }
function guideItem(step: number, title: string, copy: string, activeStep: number): string {
  const state = step === activeStep ? "active" : activeStep > step ? "done" : "";
  return `<div class="guide-item ${state}"><i>${activeStep > step ? "OK" : step}</i><span><b>${title}</b><small>${copy}</small></span></div>`;
}

function phaseTitle(state: GameState): string {
  const titles: Record<GameState["phase"], string> = {
    PREPARE: "GET READY", BETTING_OPEN: "PLACE YOUR BETS", BETTING_CLOSED: "NO MORE BETS",
    SPINNING: "BALL IN MOTION", RESULT: "WINNING NUMBER", PAYOUT: "PAY THE WINNERS", GAME_OVER: "SHIFT OVER",
  };
  return titles[state.phase];
}

function phaseHelp(state: GameState): string {
  if (state.mode === "autoplay") return "Demo croupier is showing every action automatically";
  if (state.phase === "BETTING_OPEN") return "Customers are placing chips. Close betting now or wait for the timer.";
  if (state.phase === "BETTING_CLOSED") return "All chips are locked. Press LAUNCH BALL to spin.";
  if (state.phase === "SPINNING") return "Wheel and ball rotate in opposite directions, then slow into a pocket.";
  if (state.phase === "PAYOUT") return "Press PAY once per chip shown. A press after zero costs ENERGY.";
  if (state.phase === "RESULT") return "Read the result, then get ready to pay every winning customer.";
  return state.message;
}

function phaseCritical(state: GameState): boolean {
  return (state.phase === "BETTING_OPEN" && state.bettingSeconds <= 5) || (state.phase === "PAYOUT" && state.paySeconds <= 5);
}

function triggerFx(name: string, duration = 480): void {
  lastFx = name;
  if (fxTimer !== null) window.clearTimeout(fxTimer);
  fxTimer = window.setTimeout(() => {
    document.querySelector(".game-shell")?.classList.remove(`fx-${name}`);
    if (lastFx === name) lastFx = "";
  }, duration);
}
function pad(value: number): string { return String(value).padStart(2, "0"); }
function format(value: number): string { return new Intl.NumberFormat("en-US").format(value); }
function energyBar(value: number, max: number): string { return Array.from({ length: max }, (_, index) => index < value ? "◆" : "◇").join(""); }
const redNumbers = new Set(["1","3","5","7","9","12","14","16","18","19","21","23","25","27","30","32","34","36"]);
function isRed(value: string | null): boolean { return value ? redNumbers.has(value) : false; }
function numberChip(value: string): string { const color = value === "0" || value === "00" ? "green" : isRed(value) ? "red" : "black"; return `<b class="number ${color}">${value}</b>`; }
function buildWheel(variant: TableVariant, result: string | null, spinning: boolean): string {
  const pockets: string[] = [...wheelConfig.variants[variant].pockets];
  const labels = pockets.map((pocket, index) => {
    const angle = (index / pockets.length) * 360;
    const radians = (angle * Math.PI) / 180;
    const x = 50 + Math.sin(radians) * 42;
    const y = 50 - Math.cos(radians) * 42;
    const color = pocket === "0" || pocket === "00" ? "green" : isRed(pocket) ? "red" : "black";
    return `<span class="wheel-pocket ${color} ${result === pocket ? "winner" : ""}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;--label-angle:${angle}deg">${pocket}</span>`;
  }).join("");
  return `<div class="wheel-stage ${spinning ? "is-spinning" : ""}">
    <div class="wheel-glow"></div>
    <div class="wheel-rotor">${labels}<div class="wheel-rim"></div><div class="wheel-center"><i>BC</i><b></b></div></div>
    <div class="ball-orbit"><i class="roulette-ball"></i></div>
    <div class="spin-sparks"><i></i><i></i><i></i><i></i></div>
    <small>${spinning ? "WHEEL / BALL COUNTER-ROTATION" : variant === "european" ? "EUROPEAN 37-POCKET WHEEL" : "AMERICAN 38-POCKET WHEEL"}</small>
  </div>`;
}

interface FeltChip { seatName: string; stake: number; className: string }

function catalogFor(variant: TableVariant): BetDefinition[] {
  return (variant === "european" ? europeanBets.bets : americanBets.bets) as BetDefinition[];
}

function buildChipMap(variant: TableVariant, seats: Seat[]): Map<string, FeltChip[]> {
  const catalog = new Map(catalogFor(variant).map((bet) => [bet.id, bet]));
  const outsideIds = new Set(["red", "black", "even", "odd", "low", "high", "dozen1", "dozen2", "dozen3", "column1", "column2", "column3"]);
  const chips = new Map<string, FeltChip[]>();
  seats.forEach((seat, seatIndex) => {
    seat.bets.forEach((placed) => {
      const definition = catalog.get(placed.betId);
      if (!definition) return;
      const target = outsideIds.has(placed.betId) ? placed.betId : definition.pockets[0];
      const list = chips.get(target) ?? [];
      list.push({ seatName: seat.name, stake: placed.stake, className: `customer-${seatIndex + 1}` });
      chips.set(target, list);
    });
  });
  return chips;
}

function chipsAt(target: string, chips: Map<string, FeltChip[]>): string {
  const placed = chips.get(target) ?? [];
  if (!placed.length) return "";
  return `<span class="chip-stack">${placed.slice(0, 4).map((chip, index) => `<i class="felt-chip ${chip.className}" style="--stack:${index}" title="${chip.seatName}: ${chip.stake} units">${chip.seatName.slice(0, 1)}</i>`).join("")}</span>`;
}

function buildFelt(variant: TableVariant, result: string | null, seats: Seat[]): string {
  const chips = buildChipMap(variant, seats);
  const rowOrder = [
    ...Array.from({ length: 12 }, (_, index) => String((index + 1) * 3)),
    ...Array.from({ length: 12 }, (_, index) => String((index + 1) * 3 - 1)),
    ...Array.from({ length: 12 }, (_, index) => String((index + 1) * 3 - 2)),
  ];
  const numberCells = rowOrder.map((number) => `<b class="felt-cell ${isRed(number) ? "red" : "black"} ${result === number ? "hit" : ""}"><span>${number}</span>${chipsAt(number, chips)}</b>`).join("");
  const zeroCells = variant === "american"
    ? `<b class="green ${result === "0" ? "hit" : ""}"><span>0</span>${chipsAt("0", chips)}</b><b class="green ${result === "00" ? "hit" : ""}"><span>00</span>${chipsAt("00", chips)}</b>`
    : `<b class="green ${result === "0" ? "hit" : ""}"><span>0</span>${chipsAt("0", chips)}</b>`;
  return `<div class="zero-zone">${zeroCells}</div>
    <div class="numbers">${numberCells}</div>
    <div class="column-pays"><span>2 TO 1${chipsAt("column3", chips)}</span><span>2 TO 1${chipsAt("column2", chips)}</span><span>2 TO 1${chipsAt("column1", chips)}</span></div>
    <div class="dozens"><span>1ST 12${chipsAt("dozen1", chips)}</span><span>2ND 12${chipsAt("dozen2", chips)}</span><span>3RD 12${chipsAt("dozen3", chips)}</span></div>
    <div class="even-money"><span>1 TO 18${chipsAt("low", chips)}</span><span>EVEN${chipsAt("even", chips)}</span><span class="red-label">RED${chipsAt("red", chips)}</span><span class="black-label">BLACK${chipsAt("black", chips)}</span><span>ODD${chipsAt("odd", chips)}</span><span>19 TO 36${chipsAt("high", chips)}</span></div>`;
}

function betSummary(seat: Seat, variant: TableVariant): string {
  if (!seat.bets.length) return "NO BET THIS ROUND";
  const catalog = new Map(catalogFor(variant).map((bet) => [bet.id, bet]));
  return seat.bets.map((placed) => {
    const type = catalog.get(placed.betId)?.type ?? "bet";
    return `${type.replace(/([A-Z])/g, " $1").toUpperCase()} ${placed.stake}`;
  }).join(" / ");
}

function scheduleSpinTicks(duration: number): void {
  clearSpinTicks();
  if (!duration) return;
  for (let index = 0; index < 22; index += 1) {
    const delay = index * 70 + index * index * 5;
    if (delay < duration - 120) spinTickTimers.push(window.setTimeout(() => playSound("tick"), delay));
  }
}

function clearSpinTicks(): void {
  spinTickTimers.forEach((id) => window.clearTimeout(id));
  spinTickTimers = [];
}

document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && game) { event.preventDefault(); primaryAction(); }
  if (event.code === "Escape" && game) showMenu();
  if (event.code === "KeyM") { setMuted(!isMuted()); if (game) renderTable(); }
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}

showMenu();
