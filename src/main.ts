import "./styles.css";
import "./player.css";
import "./theme.css";
import europeanBets from "../config/bets-european.json" with { type: "json" };
import americanBets from "../config/bets-american.json" with { type: "json" };
import {
  applySavedBets, canEnterPlayer, cashOutPlayer, clearDraftBets, clearPlayerBets,
  createBetCreatorDraft, createPlayerGame, doubleBets, draftTotal, finishPlayerRound,
  getPlayerModeConfig, openPlayerBankroll, openPlayerBetting, placeBetsPackage, placeChip, placeDraftChip,
  playerProfit, rebetLast, requestPlayerSpin, setDraftChip, setSelectedChip,
  settlePlayerRound, snapshotPlayer, syncPlayerScore, tableCoverage, tableLayoutForStrategy, totalStaked, undoChip, undoDraftChip,
  type BetCreatorDraft, type PlayerGameState,
} from "./core/player.ts";
import {
  expandRecipe,
  getFinalePackage,
  getNeighborsPackage,
  getSectorPackage,
  isFrenchSectorAvailable,
  listSectorPackages,
  NEIGHBOR_RADIUS_OPTIONS,
  neighborSpan,
  packageCost,
  pocketColor,
  sectorForPocket,
  type CallSectorId,
  type NeighborRadius,
  wheelPockets,
} from "./core/callBets.ts";
import type { BetDefinition, Locale, PlacedBet, PlayerChipAction, SpinResult, TableVariant } from "./core/types.ts";
import { isLocale, LOCALE_META, LOCALE_STORAGE_KEY, readStoredLocale, storeLocale, translate } from "./i18n.ts";
import {
  deleteBetTemplate, duplicateBetTemplate, loadBetTemplates, MAX_BET_TEMPLATES, saveBetTemplates, templateTotal, upsertBetTemplate,
  type BetTemplate, BET_TEMPLATES_STORAGE_KEY,
} from "./persist/betTemplates.ts";
import { loadUserProfile, refillEmptyProfile, restoreStarterBankroll, saveUserProfile, PROFILE_STORAGE_KEY } from "./persist/profile.ts";
import { clearStoredSession, readStoredSession, writeStoredSession, SESSION_STORAGE_KEY } from "./persist/session.ts";
import {
  asBackgroundAnimation,
  buildDataExport,
  loadSettings,
  saveSettings,
  updateSettings,
  type AppSettings,
  type BackgroundAnimationId,
  SETTINGS_STORAGE_KEY,
} from "./persist/settings.ts";
import { LEGACY_APP_PREFIX } from "./persist/storageMigration.ts";
import { animateWheel, drawStaticWheel, getSpinEndAngle, type WheelAnimationHandle } from "./wheel/canvasWheel.ts";
import { spin } from "./spin/spinEngine.ts";
import { escapePrivacyHtml, privacyArticleMarkup, privacyDocument } from "./legal/privacy.ts";
import { isMuted, playSound, PLAYER_MUSIC_TRACKS, setMusic, setMusicVolume, setMuted, setPlayerMusicMode, type PlayerMusicMode } from "./audio.ts";
import {
  resolveNumberCellSnap,
  resolveZeroSnap,
  snapKindLabelKey,
  type FeltSnapResult,
} from "./player/feltSnap.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
const SOURCE_CODE_URL = "https://github.com/orfeomorello/OpenSource-Mobile-Spin-Roulette";

function syncUsableViewport(): void {
  const viewport = window.visualViewport;
  const usableHeight = Math.round(viewport?.height ?? window.innerHeight);
  const usableWidth = Math.round(viewport?.width ?? window.innerWidth);
  document.documentElement.style.setProperty("--app-height", `${usableHeight}px`);
  document.documentElement.style.setProperty("--app-width", `${usableWidth}px`);
}

syncUsableViewport();
window.visualViewport?.addEventListener("resize", syncUsableViewport, { passive: true });
window.visualViewport?.addEventListener("scroll", syncUsableViewport, { passive: true });
window.addEventListener("orientationchange", syncUsableViewport, { passive: true });
window.addEventListener("resize", syncUsableViewport, { passive: true });

/** Default English; user can switch EN/IT from home or Settings. */
let locale: Locale = readStoredLocale() ?? "en";
let profile = loadUserProfile();
let appSettings: AppSettings = loadSettings();
setMuted(appSettings.muted);
setMusicVolume(appSettings.musicVolume);
setPlayerMusicMode(appSettings.playerMusicMode);

function toggleMute(): void {
  const nextMuted = !isMuted();
  setMuted(nextMuted);
  appSettings = updateSettings({ muted: nextMuted });
}

function haptic(pattern: number | number[] = 12): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* vibration is optional */
  }
}

function uniqueStrategyCopyName(sourceName: string): string {
  const names = new Set(loadBetTemplates().map((item) => item.name));
  const first = t("player.strategyCopyName", { name: sourceName }).slice(0, 40);
  if (!names.has(first)) return first;
  for (let n = 2; n < 99; n += 1) {
    const next = t("player.strategyCopyNameN", { name: sourceName, n }).slice(0, 40);
    if (!names.has(next)) return next;
  }
  return first;
}

function openBetCreatorFromTable(): void {
  if (!playerGame) return;
  const layout = tableLayoutForStrategy(playerGame);
  strategyPanelOpen = false;
  creatorNameDialogOpen = false;
  playerChipMenuOpen = false;
  creatorDraft = createBetCreatorDraft(playerGame.variant, {
    selectedChip: playerGame.selectedChip,
    bets: layout.length ? layout : undefined,
  });
}

/** Home + Settings → menu; Player → soft playlist. */
function syncScreenMusic(screen: "menu" | "settings" | "player" | "none"): void {
  if (screen === "menu" || screen === "settings") setMusic("menu");
  else if (screen === "player") setMusic("player");
  else setMusic(null);
}

/** Shared landing FX markup (home + settings share the square grid background). */
function landingFxMarkup(fx: BackgroundAnimationId): string {
  const particles = fx === "recommended";
  const parallax = fx === "c64_parallax";
  return `
    <div class="home-fx-layer" aria-hidden="true">
      <div class="home-grid-fx"></div>
      <div class="home-ambient-glow"></div>
      <div class="home-scanline"></div>
      ${particles
        ? `<div class="home-pixels">${Array.from({ length: 8 }, (_, i) => `<i class="home-pixel p${i}"></i>`).join("")}</div>`
        : ""}
      ${parallax
        ? `<div class="home-parallax">
            <div class="home-parallax-layer home-parallax-stars-far"></div>
            <div class="home-parallax-layer home-parallax-stars-mid"></div>
            <div class="home-parallax-layer home-parallax-stars-near"></div>
            <div class="home-parallax-layer home-parallax-hills-far"></div>
            <div class="home-parallax-layer home-parallax-hills-near"></div>
            <div class="home-parallax-layer home-parallax-ground"></div>
          </div>`
        : ""}
    </div>`;
}

function landingBgClass(fx: BackgroundAnimationId = appSettings.backgroundAnimation): string {
  return `home-bg-${fx}`;
}

let playerGame: PlayerGameState | null = null;
/** Bet Creator sandbox (no score spend) — when set, overrides the live table view. */
let creatorDraft: BetCreatorDraft | null = null;
/** Full-screen name dialog after pressing Save strategy. */
let creatorNameDialogOpen = false;
/** Live text while typing the strategy name (survives accidental re-renders). */
let creatorNameBuffer = "";
/** Strategy list panel over the live Player table. */
let strategyPanelOpen = false;
/** French / neighbors racetrack overlay (Player). */
let racetrackOpen = false;
/** Session stats overlay (Player). */
let statsPanelOpen = false;
/** Compact Player options sheet (mobile-first replacement for scattered toolbar buttons). */
let playerMenuOpen = false;
/** Compact chip picker; the live table normally exposes only the last-used chip. */
let playerChipMenuOpen = false;
/** Player sound configuration overlay. */
let soundPanelOpen = false;
/** Neighbor radius: 0→1 number, 2→5 (classic). */
let racetrackNeighborRadius: NeighborRadius = 2;
let lastPlayerNet: number | null = null;
/** Full-screen winning-number reveal after every Player spin. */
interface ResultRevealState {
  winningNumber: string;
  playerNet: number | null;
  /** True when the hand had no chips (free spin) — net is 0 but not “even this hand”. */
  playerFreeSpin?: boolean;
}
let resultReveal: ResultRevealState | null = null;
let resultRevealTimer: number | null = null;
/** Called once when reveal ends (timer or user tap). */
let resultRevealOnDone: (() => void) | null = null;
/** ~2s — matches live-table / sim “big number” beat; skip early with tap anywhere. */
const RESULT_REVEAL_MS = 2200;
let spinTickTimers: number[] = [];
let activeSpinPlan: SpinResult | null = null;
let spinDurationMs = 0;
let playerSpinTimer: number | null = null;
let wheelRestAngle = 0;
let wheelAnimation: WheelAnimationHandle | null = null;
const t = (key: string, variables: Record<string, string | number> = {}): string => translate(locale, key, variables);

type AppMessageTone = "info" | "success" | "error" | "danger";

interface AppDialogOptions {
  message: string;
  tone?: AppMessageTone;
  confirmLabel?: string;
  cancelLabel?: string;
}

let appNoticeTimer: number | null = null;
let closeActiveAppDialog: ((result: boolean) => void) | null = null;
let appDialogSequence = 0;

function showAppNotice(message: string, tone: AppMessageTone = "info"): void {
  if (appNoticeTimer !== null) window.clearTimeout(appNoticeTimer);
  document.querySelector(".app-notice")?.remove();

  const notice = document.createElement("div");
  notice.className = `app-notice tone-${tone}`;
  notice.setAttribute("role", tone === "error" || tone === "danger" ? "alert" : "status");
  notice.setAttribute("aria-live", tone === "error" || tone === "danger" ? "assertive" : "polite");
  notice.textContent = message;
  document.body.append(notice);
  window.requestAnimationFrame(() => notice.classList.add("is-visible"));

  appNoticeTimer = window.setTimeout(() => {
    notice.classList.remove("is-visible");
    window.setTimeout(() => notice.remove(), 180);
    appNoticeTimer = null;
  }, 3200);
}

function showAppDialog({
  message,
  tone = "info",
  confirmLabel = t("player.creatorConfirm"),
  cancelLabel,
}: AppDialogOptions): Promise<boolean> {
  closeActiveAppDialog?.(false);
  document.querySelector(".app-dialog-layer")?.remove();

  const priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const dialogId = `app-dialog-${++appDialogSequence}`;
  const overlay = document.createElement("div");
  overlay.className = `app-dialog-layer tone-${tone}`;
  overlay.innerHTML = `<section class="app-dialog-card" role="${cancelLabel ? "alertdialog" : "dialog"}" aria-modal="true" aria-labelledby="${dialogId}-title" aria-describedby="${dialogId}-message">
    <span class="app-dialog-icon" aria-hidden="true">${tone === "success" ? "✓" : tone === "info" ? "i" : "!"}</span>
    <h2 id="${dialogId}-title">MobileSpinRoulette</h2>
    <p id="${dialogId}-message">${escapeHtml(message)}</p>
    <div class="app-dialog-actions ${cancelLabel ? "" : "is-single"}">
      ${cancelLabel ? `<button type="button" class="app-dialog-cancel">${escapeHtml(cancelLabel)}</button>` : ""}
      <button type="button" class="app-dialog-confirm">${escapeHtml(confirmLabel)}</button>
    </div>
  </section>`;
  document.body.append(overlay);
  document.documentElement.classList.add("app-dialog-open");

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKeyDown, true);
      overlay.remove();
      document.documentElement.classList.remove("app-dialog-open");
      if (closeActiveAppDialog === finish) closeActiveAppDialog = null;
      if (priorFocus?.isConnected) priorFocus.focus({ preventScroll: true });
      resolve(result);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      finish(cancelLabel ? false : true);
    };

    closeActiveAppDialog = finish;
    overlay.querySelector<HTMLButtonElement>(".app-dialog-confirm")?.addEventListener("click", () => finish(true));
    overlay.querySelector<HTMLButtonElement>(".app-dialog-cancel")?.addEventListener("click", () => finish(false));
    overlay.addEventListener("pointerdown", (event) => {
      if (cancelLabel && event.target === overlay) finish(false);
    });
    document.addEventListener("keydown", onKeyDown, true);
    window.requestAnimationFrame(() => {
      overlay.querySelector<HTMLButtonElement>(cancelLabel ? ".app-dialog-cancel" : ".app-dialog-confirm")?.focus({ preventScroll: true });
    });
  });
}

function syncDocumentLanguage(): void {
  document.documentElement.lang = LOCALE_META.find((meta) => meta.id === locale)?.bcp47 ?? "en";
}

syncDocumentLanguage();

/** Defaults for one-click role start — from Settings (home gear). */
function menuDefaults(): { variant: TableVariant; animation: boolean } {
  appSettings = loadSettings();
  return {
    variant: appSettings.defaultTableVariant,
    animation: appSettings.animationEnabled,
  };
}

function showMenu(): void {
  removeCreatorNameDialogLayer();
  wheelAnimation?.cancel();
  wheelAnimation = null;
  playerGame = null;
  lastPlayerNet = null;
  playerMenuOpen = false;
  playerChipMenuOpen = false;
  soundPanelOpen = false;
  syncScreenMusic("menu");

  appSettings = loadSettings();
  const homeFx = appSettings.backgroundAnimation;
  app.innerHTML = `
    <main class="landing home-clean ${landingBgClass(homeFx)}">
      ${landingFxMarkup(homeFx)}
      <header class="home-topbar">
        <button type="button" id="open-settings" class="home-settings-btn" aria-label="${t("menu.settingsAria")}" title="${t("menu.settings")}">
          <span class="home-settings-gear" aria-hidden="true">⚙</span>
          <span class="home-settings-label">${t("menu.settings")}</span>
        </button>
        <label class="home-lang" aria-label="${t("menu.language")}">
          <span class="home-lang-icon" aria-hidden="true">&#127760;</span>
          <select id="home-language" class="home-lang-select" aria-label="${t("menu.language")}">
            ${LOCALE_META.map((meta) =>
              `<option value="${meta.id}" ${locale === meta.id ? "selected" : ""}>${meta.native}</option>`
            ).join("")}
          </select>
        </label>
      </header>
      <section class="brand-card home-hero">
        <div class="home-glow" aria-hidden="true"></div>
        <div class="home-table-emblem" aria-hidden="true">
          <span class="home-emblem-wheel"><i></i><b></b></span>
          <span class="home-emblem-ball"></span>
        </div>
        <p class="home-eyebrow">${t("menu.tableTypes")}</p>
        <h1 class="home-title">${t("menu.titlePrimary")}<br><span>${t("menu.titleAccent")}</span></h1>
        <p class="tagline home-enter">${t("menu.tagline")}</p>
        <div class="mode-grid mode-grid-roles">
          <button class="mode-card role-card role-player" id="start-game" type="button">
            <span class="home-play-icon" aria-hidden="true"></span>
            <span class="home-play-copy"><small>${t("table.live")}</small><b>${t("menu.start")}</b></span>
            <span class="home-play-arrow" aria-hidden="true">&#8594;</span>
          </button>
        </div>
      </section>
      <footer class="home-footer">
        <p class="home-legal">${t("menu.footer")}</p>
        <p class="home-credit">
          <a class="home-credit-link" href="${SOURCE_CODE_URL}" target="_blank" rel="noopener noreferrer">${t("menu.sourceCode")}</a>
          <span aria-hidden="true">·</span>
          <button type="button" class="home-credit-link" id="open-privacy">${t("menu.privacy")}</button>
        </p>
      </footer>
    </main>`;

  app.querySelector<HTMLButtonElement>("#open-settings")?.addEventListener("click", () => {
    playSound("bet");
    showSettings();
  });

  app.querySelector<HTMLSelectElement>("#home-language")?.addEventListener("change", (event) => {
    const selectedLocale = (event.currentTarget as HTMLSelectElement).value;
    if (!isLocale(selectedLocale)) return;
    locale = selectedLocale;
    storeLocale(locale);
    syncDocumentLanguage();
    playSound("bet");
    showMenu();
  });

  app.querySelector<HTMLButtonElement>("#start-game")?.addEventListener("click", () => {
    const defaults = menuDefaults();
    startPlayerSession(defaults.variant, defaults.animation);
  });

  app.querySelector<HTMLButtonElement>("#open-privacy")?.addEventListener("click", () => {
    playSound("bet");
    showPrivacy("menu");
  });
}

function showPrivacy(returnTo: "menu" | "settings"): void {
  wheelAnimation?.cancel();
  wheelAnimation = null;
  syncScreenMusic("settings");
  const doc = privacyDocument(locale);
  const settingsFx = loadSettings().backgroundAnimation;
  app.innerHTML = `
    <main class="landing settings-screen privacy-screen ${landingBgClass(settingsFx)}">
      ${landingFxMarkup(settingsFx)}
      <section class="settings-panel privacy-panel" aria-labelledby="privacy-title">
        <header class="settings-header">
          <button type="button" id="privacy-back" class="settings-back">${t("settings.back")}</button>
          <h1 id="privacy-title" class="home-title">${escapePrivacyHtml(doc.title)}</h1>
        </header>
        <article class="privacy-article">
          ${privacyArticleMarkup(doc)}
        </article>
      </section>
    </main>`;

  app.querySelector<HTMLButtonElement>("#privacy-back")?.addEventListener("click", () => {
    playSound("bet");
    if (returnTo === "settings") showSettings();
    else showMenu();
  });
}

function showSettings(): void {
  wheelAnimation?.cancel();
  wheelAnimation = null;
  appSettings = loadSettings();
  setMuted(appSettings.muted);
  setMusicVolume(appSettings.musicVolume);
  syncScreenMusic("settings");
  const settingsFx = appSettings.backgroundAnimation;

  app.innerHTML = `
    <main class="landing settings-screen ${landingBgClass(settingsFx)}">
      ${landingFxMarkup(settingsFx)}
      <section class="settings-panel" aria-labelledby="settings-title">
        <header class="settings-header">
          <button type="button" id="settings-back" class="settings-back">${t("settings.back")}</button>
          <h1 id="settings-title" class="home-title">${t("settings.title")}</h1>
        </header>

        <section class="settings-block">
          <h2>${t("settings.sectionLanguage")}</h2>
          <p class="settings-help">${t("settings.languageHelp")}</p>
          <div class="settings-segment settings-segment-wrap settings-lang-grid" role="group" aria-label="${t("menu.language")}">
            ${LOCALE_META.map((meta) =>
              `<button type="button" class="settings-option ${locale === meta.id ? "active" : ""}" data-set-locale="${meta.id}">${meta.native}</button>`
            ).join("")}
          </div>
        </section>

        <section class="settings-block">
          <h2>${t("settings.sectionPlay")}</h2>
          <label class="settings-label">${t("settings.variant")}</label>
          <div class="settings-choice-grid" role="radiogroup" aria-label="${t("settings.variant")}">
            <button type="button" class="settings-choice ${appSettings.defaultTableVariant === "european" ? "active" : ""}" data-variant="european">
              <b>${t("settings.variantEu")}</b>
              <span>${t("settings.variantEuHelp")}</span>
            </button>
            <button type="button" class="settings-choice ${appSettings.defaultTableVariant === "american" ? "active" : ""}" data-variant="american">
              <b>${t("settings.variantUs")}</b>
              <span>${t("settings.variantUsHelp")}</span>
            </button>
          </div>

          <label class="settings-label">${t("settings.animation")}</label>
          <p class="settings-help">${t("settings.animationHelp")}</p>
          <div class="settings-segment" role="group" aria-label="${t("settings.animation")}">
            <button type="button" class="settings-option ${appSettings.animationEnabled ? "active" : ""}" data-animation="on">${t("settings.animationOn")}</button>
            <button type="button" class="settings-option ${!appSettings.animationEnabled ? "active" : ""}" data-animation="off">${t("settings.animationOff")}</button>
          </div>

        </section>

        <section class="settings-block">
          <h2>${t("settings.sectionAudio")}</h2>
          <p class="settings-help">${t("settings.soundHelp")}</p>
          <div class="settings-segment" role="group" aria-label="${t("settings.sound")}">
            <button type="button" class="settings-option ${!appSettings.muted ? "active" : ""}" data-sound="on">${t("settings.soundOn")}</button>
            <button type="button" class="settings-option ${appSettings.muted ? "active" : ""}" data-sound="off">${t("settings.soundOff")}</button>
          </div>
          <label class="settings-label" for="settings-music-volume">${t("settings.musicVolume")}</label>
          <p class="settings-help">${t("settings.musicVolumeHelp")}</p>
          <div class="settings-volume-row">
            <input
              type="range"
              id="settings-music-volume"
              class="settings-volume-slider"
              min="0"
              max="100"
              step="1"
              value="${Math.round(appSettings.musicVolume * 100)}"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow="${Math.round(appSettings.musicVolume * 100)}"
              aria-label="${t("settings.musicVolume")}"
            />
            <output id="settings-music-volume-value" class="settings-volume-value" for="settings-music-volume">${Math.round(appSettings.musicVolume * 100)}%</output>
          </div>
        </section>

        <section class="settings-block">
          <h2>${t("settings.sectionData")}</h2>
          <p class="settings-help">${t("settings.privacyNote")}</p>
          <p class="settings-privacy"><button type="button" class="settings-privacy-btn" id="open-privacy">${t("menu.privacy")}</button></p>
          <ul class="settings-data-table">
            <li class="settings-data-row">
              <div class="settings-data-copy">
                <b>${t("settings.export")}</b>
                <span>${t("settings.exportHelp")}</span>
              </div>
              <button type="button" id="settings-export" class="chrome-button">${t("settings.exportAction")}</button>
            </li>
            <li class="settings-data-row">
              <div class="settings-data-copy">
                <b>${t("settings.import")}</b>
                <span>${t("settings.importHelp")}</span>
              </div>
              <button type="button" id="settings-import" class="chrome-button">${t("settings.importAction")}</button>
            </li>
            <li class="settings-data-row">
              <div class="settings-data-copy">
                <b>${t("settings.restoreBankroll")}</b>
                <span>${t("settings.restoreBankrollHelp")}</span>
              </div>
              <button type="button" id="settings-restore-bankroll" class="chrome-button settings-restore-btn">${t("settings.restoreBankrollAction")}</button>
            </li>
            <li class="settings-data-row is-danger">
              <div class="settings-data-copy">
                <b>${t("settings.reset")}</b>
                <span>${t("settings.resetHelp")}</span>
              </div>
              <button type="button" id="settings-reset" class="chrome-button danger">${t("settings.resetAction")}</button>
            </li>
          </ul>
          <input type="file" id="settings-import-file" accept="application/json,.json" hidden />
        </section>
      </section>
    </main>`;

  app.querySelector<HTMLButtonElement>("#settings-back")?.addEventListener("click", () => {
    playSound("bet");
    showMenu();
  });

  app.querySelector<HTMLButtonElement>("#open-privacy")?.addEventListener("click", () => {
    playSound("bet");
    showPrivacy("settings");
  });

  app.querySelectorAll<HTMLButtonElement>("[data-set-locale]").forEach((button) => {
    button.addEventListener("click", () => {
      locale = button.dataset.setLocale as Locale;
      storeLocale(locale);
      syncDocumentLanguage();
      playSound("bet");
      showSettings();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-variant]").forEach((button) => {
    button.addEventListener("click", () => {
      const variant = button.dataset.variant === "american" ? "american" : "european";
      appSettings = updateSettings({ defaultTableVariant: variant });
      playSound("bet");
      showSettings();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-animation]").forEach((button) => {
    button.addEventListener("click", () => {
      appSettings = updateSettings({ animationEnabled: button.dataset.animation !== "off" });
      playSound("bet");
      showSettings();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-sound]").forEach((button) => {
    button.addEventListener("click", () => {
      const muted = button.dataset.sound === "off";
      appSettings = updateSettings({ muted });
      setMuted(muted);
      syncScreenMusic("settings");
      if (!muted) playSound("bet");
      showSettings();
    });
  });

  const musicVolumeSlider = app.querySelector<HTMLInputElement>("#settings-music-volume");
  const musicVolumeLabel = app.querySelector<HTMLOutputElement>("#settings-music-volume-value");
  const applyMusicVolumeFromSlider = (persist: boolean) => {
    if (!musicVolumeSlider) return;
    const pct = Math.min(100, Math.max(0, Number(musicVolumeSlider.value) || 0));
    const volume = pct / 100;
    setMusicVolume(volume);
    if (musicVolumeLabel) musicVolumeLabel.textContent = `${pct}%`;
    musicVolumeSlider.setAttribute("aria-valuenow", String(pct));
    if (persist) {
      appSettings = updateSettings({ musicVolume: volume });
    }
  };
  musicVolumeSlider?.addEventListener("input", () => applyMusicVolumeFromSlider(false));
  musicVolumeSlider?.addEventListener("change", () => applyMusicVolumeFromSlider(true));

  app.querySelector<HTMLButtonElement>("#settings-export")?.addEventListener("click", () => {
    const bundle = {
      ...buildDataExport(readStoredLocale(), loadUserProfile(), readStoredSession()),
      betTemplates: loadBetTemplates(),
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mobilespinroulette-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    playSound("settle");
    showAppNotice(t("settings.exportDone"), "success");
  });

  const importInput = app.querySelector<HTMLInputElement>("#settings-import-file");
  app.querySelector<HTMLButtonElement>("#settings-import")?.addEventListener("click", () => importInput?.click());
  importInput?.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    importInput.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as {
        schemaVersion?: number;
        locale?: Locale | null;
        settings?: AppSettings;
        profile?: unknown;
        session?: unknown;
        betTemplates?: BetTemplate[];
      };
      if (parsed.schemaVersion !== 1) throw new Error("bad schema");
      if (parsed.settings?.schemaVersion === 1) {
        const importedSettings = parsed.settings;
        const importedVolume =
          typeof importedSettings.musicVolume === "number" && Number.isFinite(importedSettings.musicVolume)
            ? Math.min(1, Math.max(0, importedSettings.musicVolume))
            : 0.5;
        const importedMusicMode = importedSettings.playerMusicMode;
        saveSettings({
          schemaVersion: 1,
          defaultTableVariant: importedSettings.defaultTableVariant === "american" ? "american" : "european",
          animationEnabled: importedSettings.animationEnabled !== false,
          muted: importedSettings.muted === true,
          musicVolume: importedVolume,
          playerMusicMode: PLAYER_MUSIC_TRACKS.some((track) => track.id === importedMusicMode)
            ? importedMusicMode
            : "random",
          backgroundAnimation: asBackgroundAnimation(importedSettings.backgroundAnimation),
        });
        setMusicVolume(importedVolume);
      }
      if (parsed.profile && typeof parsed.profile === "object") {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(parsed.profile));
      }
      if (parsed.session && typeof parsed.session === "object") {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed.session));
      } else if (parsed.session === null) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
      if (Array.isArray(parsed.betTemplates)) {
        saveBetTemplates(parsed.betTemplates);
      }
      if (isLocale(parsed.locale)) {
        storeLocale(parsed.locale);
      }
      playSound("level");
      await showAppDialog({ message: t("settings.importDone"), tone: "success" });
      window.location.reload();
    } catch {
      playSound("error");
      showAppNotice(t("settings.importFailed"), "error");
    }
  });

  app.querySelector<HTMLButtonElement>("#settings-restore-bankroll")?.addEventListener("click", async () => {
    const accepted = await showAppDialog({
      message: t("settings.restoreBankrollConfirm"),
      tone: "info",
      confirmLabel: t("settings.restoreBankrollAction"),
      cancelLabel: t("player.creatorCancel"),
    });
    if (!accepted) return;
    profile = restoreStarterBankroll(profile);
    saveUserProfile(profile);
    clearStoredSession();
    playSound("level");
    showSettings();
    showAppNotice(t("settings.restoreBankrollDone"), "success");
  });

  app.querySelector<HTMLButtonElement>("#settings-reset")?.addEventListener("click", async () => {
    const accepted = await showAppDialog({
      message: t("settings.resetConfirm"),
      tone: "danger",
      confirmLabel: t("settings.resetAction"),
      cancelLabel: t("player.creatorCancel"),
    });
    if (!accepted) return;
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(BET_TEMPLATES_STORAGE_KEY);
    localStorage.removeItem(LOCALE_STORAGE_KEY);
    [
      `${LEGACY_APP_PREFIX}.profile.v1`,
      `${LEGACY_APP_PREFIX}.settings.v1`,
      `${LEGACY_APP_PREFIX}.session.v3`,
      `${LEGACY_APP_PREFIX}.betTemplates.v1`,
      `${LEGACY_APP_PREFIX}.locale.v1`,
      `open-source-mobile-${"spin-roulette"}.profile.v1`,
    ].forEach((key) => localStorage.removeItem(key));
    playSound("error");
    await showAppDialog({ message: t("settings.resetDone"), tone: "success" });
    window.location.reload();
  });
}

/** Enter Player using the full score as the live bankroll (single pool — no separate “bring”). */
function startPlayerSession(variant: TableVariant, animationEnabled: boolean): void {
  try {
    const refilledProfile = refillEmptyProfile(profile);
    if (refilledProfile !== profile) {
      profile = refilledProfile;
      saveUserProfile(profile);
    }
    if (!canEnterPlayer(profile.walletUnits)) {
      playSound("error");
      showMenu();
      return;
    }
    const result = openPlayerBankroll(profile);
    if (!result) {
      playSound("error");
      showMenu();
      return;
    }
    playerGame = createPlayerGame(variant, result.tableScore, animationEnabled, locale);
    lastPlayerNet = null;
    strategyPanelOpen = false;
    racetrackOpen = false;
    statsPanelOpen = false;
    playerMenuOpen = false;
    soundPanelOpen = false;
    creatorDraft = null;
    syncScreenMusic("player");
    try {
      playSound("level");
    } catch {
      /* ignore */
    }
    persistPlayerScore();
    savePlayerLocal();
    openPlayerBetting(playerGame);
    renderPlayerTable();
  } catch (error) {
    console.error("Failed to start player", error);
    playSound("error");
    showAppNotice(t("menu.startFailed"), "error");
  }
}

/** Keep profile.walletUnits in sync with live Player wealth (free + on felt). */
function persistPlayerScore(): void {
  if (!playerGame) return;
  profile = syncPlayerScore(profile, playerGame);
  saveUserProfile(profile);
}

function showPlayerExitConfirm(): void {
  if (!playerGame) return;
  if (playerGame.phase === "SPINNING" || resultReveal) return; // no exit mid-spin / mid-reveal
  const residual = playerGame.tableScore + (playerGame.phase === "BETTING_OPEN" || playerGame.phase === "PREPARE" ? totalStaked(playerGame) : 0);
  const overlay = document.createElement("div");
  overlay.className = "exit-confirm";
  overlay.innerHTML = `<section class="exit-confirm-card" role="dialog" aria-modal="true" aria-labelledby="exit-confirm-title">
    <span class="exit-confirm-icon" aria-hidden="true"><i></i></span>
    <h2 id="exit-confirm-title">${t("player.exitTitle")}</h2>
    <p>${t("player.exitHelp")}</p>
    <div class="exit-confirm-score"><small>${t("player.score")}</small><strong>${format(residual)}</strong></div>
    <div class="exit-confirm-actions"><button type="button" id="exit-cancel" class="exit-cancel">${t("player.exitCancel")}</button><button type="button" id="exit-confirm" class="exit-danger">${t("player.exitConfirm")}</button></div>
  </section>`;
  app.append(overlay);
  overlay.querySelector<HTMLButtonElement>("#exit-cancel")!.addEventListener("click", () => {
    overlay.remove();
  });
  overlay.querySelector<HTMLButtonElement>("#exit-confirm")!.addEventListener("click", () => {
    if (!playerGame) return;
    const out = cashOutPlayer(playerGame, profile);
    profile = out.profile;
    saveUserProfile(profile);
    clearStoredSession();
    playerGame = null;
    creatorDraft = null;
    creatorNameDialogOpen = false;
    creatorNameBuffer = "";
    strategyPanelOpen = false;
    racetrackOpen = false;
    statsPanelOpen = false;
    playSound("pay");
    showMenu();
  });
}

/** Abort reveal without running onDone (e.g. new spin starting). */
function clearResultReveal(): void {
  if (resultRevealTimer !== null) {
    window.clearTimeout(resultRevealTimer);
    resultRevealTimer = null;
  }
  resultReveal = null;
  resultRevealOnDone = null;
}

/** End reveal once — timer or tap — then continue hunt / next hand. */
function finishResultReveal(): void {
  if (resultReveal === null && resultRevealOnDone === null) return;
  const done = resultRevealOnDone;
  if (resultRevealTimer !== null) {
    window.clearTimeout(resultRevealTimer);
    resultRevealTimer = null;
  }
  resultReveal = null;
  resultRevealOnDone = null;
  done?.();
}

function scheduleResultReveal(state: ResultRevealState, onDone: () => void): void {
  clearResultReveal();
  resultReveal = state;
  resultRevealOnDone = onDone;
  resultRevealTimer = window.setTimeout(() => {
    resultRevealTimer = null;
    finishResultReveal();
  }, RESULT_REVEAL_MS);
}

function bindResultRevealDismiss(): void {
  const overlay = app.querySelector<HTMLElement>(".result-reveal");
  if (!overlay) return;
  const dismiss = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    finishResultReveal();
  };
  overlay.addEventListener("click", dismiss);
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " " || event.key === "Escape") dismiss(event);
  });
  // Prefer focus so keyboard users can dismiss without hunting the card.
  overlay.focus({ preventScroll: true });
}

function buildResultRevealOverlay(): string {
  if (!resultReveal) return "";
  const n = resultReveal.winningNumber;
  const color = n === "0" || n === "00" ? "green" : isRed(n) ? "red" : "black";
  let outcomeClass = "is-reveal";
  let outcome = "";
  if (resultReveal.playerNet !== null) {
    if (resultReveal.playerNet > 0) {
      outcomeClass = "is-win";
      outcome = t("reveal.playerWin", { net: format(resultReveal.playerNet) });
    } else if (resultReveal.playerNet < 0) {
      outcomeClass = "is-lose";
      outcome = t("reveal.playerLose", { net: format(Math.abs(resultReveal.playerNet)) });
    } else if (resultReveal.playerFreeSpin) {
      outcomeClass = "is-reveal";
      outcome = t("reveal.playerFree");
    } else {
      outcomeClass = "is-even";
      outcome = t("reveal.playerEven");
    }
  }
  return `<div class="result-reveal" role="button" tabindex="0" aria-live="assertive" aria-label="${t("reveal.number")} ${n}">
    <div class="result-reveal-card color-${color} ${outcomeClass}">
      <span class="result-reveal-label">${t("reveal.number")}</span>
      <b class="result-reveal-number">${n}</b>
      ${outcome ? `<p class="result-reveal-outcome">${outcome}</p>` : ""}
    </div>
  </div>`;
}

function performPlayerSpin(): void {
  if (!playerGame || !requestPlayerSpin(playerGame)) {
    playSound("error");
    if (playerGame) renderPlayerTable();
    return;
  }
  clearResultReveal();
  const generatedPlan = spin(playerGame.variant);
  activeSpinPlan = generatedPlan;
  spinDurationMs = playerGame.animationEnabled ? Math.min(6200, Math.max(5000, generatedPlan.durationMs * 0.68)) : 160;
  playSound("spin");
  haptic([16, 40, 16]);
  scheduleSpinTicks(playerGame.animationEnabled ? spinDurationMs : 0);
  renderPlayerTable();
  playerSpinTimer = window.setTimeout(settleActivePlayerSpin, spinDurationMs);
}

function settleActivePlayerSpin(): void {
    if (!playerGame || !activeSpinPlan || playerGame.phase !== "SPINNING") return;
    if (playerSpinTimer !== null) window.clearTimeout(playerSpinTimer);
    playerSpinTimer = null;
    const completedPlan = activeSpinPlan;
    wheelRestAngle = getSpinEndAngle(wheelRestAngle, playerGame.variant, completedPlan.winningNumber, completedPlan.turns);
    activeSpinPlan = null;
    const settle = settlePlayerRound(playerGame, completedPlan.winningNumber);
    lastPlayerNet = settle.netDelta;
    clearSpinTicks();
    playSound(settle.netDelta > 0 ? "pay" : settle.totalStaked === 0 ? "settle" : "error");
    haptic(settle.netDelta > 0 ? [18, 30, 28] : 22);
    persistPlayerScore();
    savePlayerLocal();
    scheduleResultReveal({
      winningNumber: completedPlan.winningNumber,
      playerNet: settle.netDelta,
      playerFreeSpin: settle.totalStaked === 0,
    }, () => {
      completePlayerRound();
    });
    renderPlayerTable();
}

function completePlayerRound(): void {
  if (!playerGame) return;
  clearResultReveal();
  finishPlayerRound(playerGame);
  persistPlayerScore();
  savePlayerLocal();
  if (playerGame.phase === "GAME_OVER") {
    clearStoredSession();
    renderPlayerTable();
    return;
  }
  openPlayerBetting(playerGame);
  lastPlayerNet = null;
  savePlayerLocal();
  renderPlayerTable();
}

function savePlayerLocal(): void {
  if (!playerGame) return;
  writeStoredSession(snapshotPlayer(playerGame));
}

/** Score, stakes and bankroll are always shown as plain integers. */
function format(value: number): string {
  return String(Math.trunc(Number.isFinite(value) ? value : 0));
}
const redNumbers = new Set(["1","3","5","7","9","12","14","16","18","19","21","23","25","27","30","32","34","36"]);
function isRed(value: string | null): boolean { return value ? redNumbers.has(value) : false; }
function numberChip(value: string): string {
  const color = value === "0" || value === "00" ? "green" : isRed(value) ? "red" : "black";
  return `<b class="number ${color}">${value}</b>`;
}
function buildWheel(variant: TableVariant, spinning: boolean): string {
  return `<div class="wheel-stage ${spinning ? "is-spinning" : ""}">
    <div class="wheel-glow"></div>
    <canvas id="wheel-canvas" class="wheel-canvas" role="img" aria-label="${variant === "european" ? "European 37-pocket" : "American 38-pocket"} roulette wheel"></canvas>
    <small>${spinning ? t("wheel.live") : variant === "european" ? t("wheel.european") : t("wheel.american")}</small>
  </div>`;
}

function mountWheel(): void {
  const active = playerGame;
  if (!active) return;
  const canvas = app.querySelector<HTMLCanvasElement>("#wheel-canvas");
  if (!canvas) return;
  if (active.phase === "SPINNING" && activeSpinPlan) {
    wheelAnimation = animateWheel(
      canvas,
      active.variant,
      activeSpinPlan,
      wheelRestAngle,
      spinDurationMs,
      // Keep the canvas, spin timer and audio on the same in-app animation setting.
      active.animationEnabled,
    );
  } else {
    drawStaticWheel(canvas, active.variant, wheelRestAngle, active.result);
  }
}

// ---------------------------------------------------------------------------
// Player mode presenter
// ---------------------------------------------------------------------------

const playerBettingStatusNoise = new Set([
  "message.playerWelcome",
  "message.playerBetting",
  "message.playerChipPlaced",
  "message.playerChipMoved",
  "message.playerMoveUndone",
  "message.playerUndo",
  "message.playerCleared",
  "message.playerStrategyApplied",
  "message.playerRebet",
  "message.playerDouble",
  "message.playerCallPlaced",
]);

function showPlayerBettingFeedback(state: PlayerGameState): boolean {
  return Boolean(state.message && !playerBettingStatusNoise.has(state.message));
}

/** Keep placed chips above magnetic snap previews on adjacent cells and rails. */
function markPlayerFeltStackLayers(felt: HTMLElement): void {
  felt.querySelectorAll(".has-player-stack").forEach((host) => host.classList.remove("has-player-stack"));
  felt.querySelectorAll<HTMLElement>("[data-chip-host]").forEach((host) => {
    const hasDirectStack = Array.from(host.children).some((child) => child.classList.contains("player-stack"));
    if (!hasDirectStack) return;
    host.classList.add("has-player-stack");
  });
}

/** Update chip stacks in place so the felt cells (and keyboard focus) stay mounted. */
function syncPlayerFeltStacks(felt: HTMLElement, state: PlayerGameState): boolean {
  const hosts = new Map<string, HTMLElement>();
  felt.querySelectorAll<HTMLElement>("[data-chip-host]").forEach((host) => {
    const betId = host.dataset.chipHost;
    if (betId && !hosts.has(betId)) hosts.set(betId, host);
  });
  const chips = playerChipMap(feltDisplayBets(state), state.chipHistory);
  for (const [betId, stake] of chips.stakes) {
    if (stake > 0 && !hosts.has(betId)) return false;
  }
  felt.querySelectorAll(".player-stack").forEach((stack) => stack.remove());
  for (const [betId, stake] of chips.stakes) {
    if (stake <= 0) continue;
    hosts.get(betId)?.insertAdjacentHTML("beforeend", playerChipAt(betId, chips));
  }
  markPlayerFeltStackLayers(felt);
  return true;
}

/** Keep the frequently changing betting UI current without rebuilding the app shell. */
function syncPlayerBettingUi(): boolean {
  const state = playerGame;
  if (!state || state.phase !== "BETTING_OPEN") return false;
  const root = app.querySelector<HTMLElement>(".mobile-first-player.is-betting");
  const felt = root?.querySelector<HTMLElement>(".player-felt");
  const score = root?.querySelector<HTMLElement>(".player-hud-score strong");
  const stakedValue = root?.querySelector<HTMLElement>(".player-hud-bet strong");
  const coverageRoot = root?.querySelector<HTMLElement>(".table-coverage");
  const coverageTrack = root?.querySelector<HTMLElement>(".table-coverage-track");
  const coverageFill = root?.querySelector<HTMLElement>(".table-coverage-fill");
  const coveragePct = root?.querySelector<HTMLElement>(".table-coverage-pct");
  const feedback = root?.querySelector<HTMLElement>(".player-phase-feedback");
  const undo = root?.querySelector<HTMLButtonElement>("#player-undo");
  const double = root?.querySelector<HTMLButtonElement>("#player-double");
  const rebet = root?.querySelector<HTMLButtonElement>("#player-rebet");
  if (!root || !felt || !score || !stakedValue || !coverageRoot || !coverageTrack || !coverageFill || !coveragePct || !feedback || !undo || !double || !rebet) {
    return false;
  }

  const staked = totalStaked(state);
  const free = state.tableScore;
  const coverage = tableCoverage(state);
  const lastCost = state.lastBets.reduce((sum, bet) => sum + bet.stake, 0);
  score.textContent = format(free + staked);
  stakedValue.textContent = format(staked);
  coverageRoot.title = t("player.coverageHelp", { covered: coverage.covered, total: coverage.total });
  coverageTrack.setAttribute("aria-valuenow", String(coverage.percent));
  coverageTrack.setAttribute("aria-label", t("player.coverageAria", { percent: coverage.percent, covered: coverage.covered, total: coverage.total }));
  coverageFill.style.width = `${coverage.percent}%`;
  coveragePct.textContent = `${coverage.percent}%`;
  const showFeedback = showPlayerBettingFeedback(state);
  feedback.hidden = !showFeedback;
  feedback.textContent = showFeedback ? t(state.message, state.messageParams) : "";
  undo.disabled = !state.chipHistory.length && !state.bets.length;
  double.disabled = staked <= 0 || free < staked;
  rebet.disabled = lastCost <= 0 || free + staked < lastCost;
  return syncPlayerFeltStacks(felt, state);
}

function refreshPlayerBettingUi(): void {
  if (!syncPlayerBettingUi()) renderPlayerTable();
}

function renderPlayerTable(): void {
  if (!playerGame) return;
  if (!creatorNameDialogOpen) removeCreatorNameDialogLayer();
  // Full Bet Creator only when not mid Racetrack “save as strategy” naming
  if (creatorDraft && !racetrackOpen) {
    renderBetCreator();
    return;
  }
  wheelAnimation?.cancel();
  wheelAnimation = null;
  const cfg = getPlayerModeConfig();
  const staked = totalStaked(playerGame);
  const free = playerGame.tableScore;
  const total = free + staked;
  const coverage = tableCoverage(playerGame);
  const betting = playerGame.phase === "BETTING_OPEN";
  /** Coverage bar while bets are still on the table (open + spin). */
  const showCoverage = betting || playerGame.phase === "SPINNING" || playerGame.phase === "BETTING_CLOSED";
  const playerPhaseKeys = new Set(["BETTING_OPEN", "BETTING_CLOSED", "SPINNING", "PAYOUT", "PREPARE", "GAME_OVER"]);
  const phaseKey = playerPhaseKeys.has(playerGame.phase) ? `player.phase.${playerGame.phase}` : `phase.${playerGame.phase}`;
  // Single hand outcome for the phase strip (avoid duplicating net in message + mark)
  const handOutcomeLabel = lastPlayerNet === null
    ? ""
    : lastPlayerNet > 0
      ? t("player.resultWin", { net: format(lastPlayerNet) })
      : lastPlayerNet < 0
        ? t("player.resultLose", { net: format(lastPlayerNet) })
        : lastPlayerNet === 0 && playerGame.lastSettle?.totalStaked === 0
          ? t("player.resultFree")
          : t("player.resultEven");
  const wheelOutcomeLabel = lastPlayerNet === null
    ? ""
    : lastPlayerNet > 0
      ? t("reveal.playerWin", { net: format(lastPlayerNet) })
      : lastPlayerNet < 0
        ? t("reveal.playerLose", { net: format(Math.abs(lastPlayerNet)) })
        : playerGame.lastSettle?.totalStaked === 0
          ? t("reveal.playerFree")
          : t("reveal.playerEven");
  const wheelOutcomeClass = lastPlayerNet === null
    ? ""
    : lastPlayerNet > 0
      ? "is-win"
      : lastPlayerNet < 0
        ? "is-lose"
        : "is-even";
  const lastCost = playerGame.lastBets.reduce((sum, bet) => sum + bet.stake, 0);
  // Rebet replaces open bets with one copy of last hand (needs free+staked ≥ cost)
  const canRebet = betting && lastCost > 0 && free + staked >= lastCost;
  const canDouble = betting && staked > 0 && free >= staked;
  // Free spin: SPIN always available in BETTING_OPEN (chips optional)
  const canSpin = betting;
  const canOpenStrategies = betting && playerGame.phase === "BETTING_OPEN";
  const canOpenRacetrack = betting && playerGame.phase === "BETTING_OPEN";
  /** Betting is table-first; after SPIN the wheel always shows the result. */
  const showWheelStage = !betting;
  const templates = loadBetTemplates().filter((item) => item.variant === playerGame!.variant);
  const historyHtml = `<div class="history history-bar"><span>${t("table.lastNumbers")}</span><div>${playerGame.history.length ? playerGame.history.slice(0, 12).map(numberChip).join("") : `<i>${t("table.firstSpin")}</i>`}</div></div>`;
  const selectedChip = playerGame.selectedChip;
  const selectedChipDigits = String(selectedChip).length;

  const playerRevealing = resultReveal !== null;
  // Stats are read-only — open between hands and mid-bet (not during spin/reveal)
  const canOpenStats = !playerRevealing && playerGame.phase !== "SPINNING";
  // During betting: highlight live total on table; suppress routine place noise; keep fail tips
  const showBettingFeedback = betting
    && showPlayerBettingFeedback(playerGame);
  // After spin: one mark only (e.g. "+30 QUESTA MANO") — do not also show "17 · hai vinto +30"
  const phaseStatusHtml = betting
    ? `<b class="player-phase-feedback" ${showBettingFeedback ? "" : "hidden"}>${showBettingFeedback ? t(playerGame.message, playerGame.messageParams) : ""}</b>`
    : handOutcomeLabel
      ? `<mark class="player-hand-result">${handOutcomeLabel}</mark>`
      : `<b>${t(playerGame.message, playerGame.messageParams)}</b>`;
  const moreSheetHtml = playerMenuOpen ? `
    <div class="player-more-backdrop" id="player-more-backdrop">
      <aside class="player-more-sheet" role="dialog" aria-modal="true" aria-labelledby="player-more-title">
        <header>
          <span><strong id="player-more-title">${t("settings.title")}</strong></span>
          <button type="button" id="player-more-close" class="player-sheet-close" aria-label="${t("player.statsClose")}">×</button>
        </header>
        <div class="player-tools">
          <button type="button" id="player-racetrack" class="chrome-button racetrack-btn tool-primary" ${canOpenRacetrack ? "" : "disabled"} title="${t("racetrack.aria")}" aria-label="${t("racetrack.aria")}"><i class="tool-icon tool-track" aria-hidden="true"></i><span><b>${t("racetrack.btn")}</b></span></button>
          <button type="button" id="player-strategies" class="chrome-button strategy-btn tool-primary" ${canOpenStrategies ? "" : "disabled"} title="${t("player.strategyAria")}" aria-label="${t("player.strategyAria")}"><i class="tool-icon tool-star" aria-hidden="true"></i><span><b>${t("player.strategy")}${templates.length ? ` (${templates.length})` : ""}</b></span></button>
          <button type="button" id="player-stats" class="chrome-button stats-btn tool-primary" ${canOpenStats ? "" : "disabled"} title="${t("player.statsAria")}" aria-label="${t("player.statsAria")}"><i class="tool-icon tool-stats" aria-hidden="true"></i><span><b>${t("player.stats")}</b></span></button>
          <button type="button" id="player-anim" class="chrome-button anim-toggle tool-quick" ${playerGame.phase === "SPINNING" || playerRevealing ? "disabled" : ""} title="${t("settings.animationHelp")}" aria-label="${t("settings.animation")}"><i class="tool-icon tool-motion" aria-hidden="true"></i><span><b>${playerGame.animationEnabled ? t("hud.animationOn") : t("hud.animationOff")}</b></span></button>
          <button type="button" id="exit" class="chrome-button danger tool-exit" ${playerGame.phase === "SPINNING" || playerRevealing ? "disabled" : ""}><i class="tool-icon tool-door" aria-hidden="true"></i><span><b>${t("player.exit")}</b></span></button>
        </div>
      </aside>
    </div>` : "";
  const soundPanelHtml = soundPanelOpen ? `
    <div class="sound-panel-backdrop" id="sound-panel-backdrop">
      <section class="sound-panel-card" role="dialog" aria-modal="true" aria-labelledby="sound-panel-title">
        <header>
          <h2 id="sound-panel-title">${t("soundPanel.title")}</h2>
          <button type="button" id="sound-panel-close" class="player-sheet-close" aria-label="${t("soundPanel.close")}">×</button>
        </header>
        <div class="sound-panel-section">
          <span class="sound-panel-label">${t("settings.sound")}</span>
          <div class="sound-panel-options" role="group" aria-label="${t("settings.sound")}">
            <button type="button" data-player-sound="on" class="${!appSettings.muted ? "active" : ""}">${t("settings.soundOn")}</button>
            <button type="button" data-player-sound="off" class="${appSettings.muted ? "active" : ""}">${t("settings.soundOff")}</button>
          </div>
        </div>
        <div class="sound-panel-section">
          <label class="sound-panel-label" for="player-music-volume">${t("settings.musicVolume")}</label>
          <div class="sound-panel-volume">
            <input type="range" id="player-music-volume" min="0" max="100" step="1" value="${Math.round(appSettings.musicVolume * 100)}" aria-label="${t("settings.musicVolume")}" />
            <output id="player-music-volume-value" for="player-music-volume">${Math.round(appSettings.musicVolume * 100)}%</output>
          </div>
        </div>
        <div class="sound-panel-section">
          <span class="sound-panel-label">${t("soundPanel.track")}</span>
          <div class="sound-track-list">
            <button type="button" data-player-music="random" class="${appSettings.playerMusicMode === "random" ? "active" : ""}"><b>${t("soundPanel.random")}</b><small>${t("soundPanel.randomHelp")}</small></button>
            ${PLAYER_MUSIC_TRACKS.map((track) => `<button type="button" data-player-music="${track.id}" class="${appSettings.playerMusicMode === track.id ? "active" : ""}"><b>${track.label}</b><small>${t("soundPanel.track")}</small></button>`).join("")}
          </div>
        </div>
      </section>
    </div>` : "";
  app.innerHTML = `
    <main class="game-shell player-mode mobile-first-player ${showWheelStage ? "" : "player-nowheel"} ${betting ? "is-betting" : "is-wheel-stage"} ${playerRevealing ? "is-result-reveal" : ""} ${playerGame.phase === "SPINNING" ? "phase-is-spinning" : ""} ${playerGame.phase === "PAYOUT" ? "phase-is-payout" : ""}">
      <header class="player-hud">
        <div class="player-hud-brand" aria-hidden="true"><i></i><span>R</span></div>
        <div class="player-hud-metric player-hud-score"><span>${t("player.score")}</span><strong>${format(total)}</strong></div>
        <div class="player-hud-metric player-hud-bet"><span>${t("player.staked")}</span><strong>${format(staked)}</strong></div>
        <nav class="player-hud-actions">
          <button type="button" id="sound" class="player-hud-button hud-sound ${isMuted() ? "is-muted" : ""}" aria-label="${isMuted() ? t("hud.soundOff") : t("hud.soundOn")}" title="${isMuted() ? t("hud.soundOff") : t("hud.soundOn")}"><i aria-hidden="true"></i></button>
          <button type="button" id="exit" class="player-hud-button hud-exit" ${playerGame.phase === "SPINNING" || playerRevealing ? "disabled" : ""} aria-label="${t("player.exit")}" title="${t("player.exit")}"><i aria-hidden="true"></i></button>
        </nav>
      </header>
      <section class="phase-row player-phase-row">
        <span>${t(phaseKey)}</span>
        ${phaseStatusHtml}
        ${showCoverage ? `
          <div class="table-coverage" title="${t("player.coverageHelp", { covered: coverage.covered, total: coverage.total })}">
            <span class="table-coverage-label">${t("player.coverage")}</span>
            <div
              class="table-coverage-track"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow="${coverage.percent}"
              aria-label="${t("player.coverageAria", { percent: coverage.percent, covered: coverage.covered, total: coverage.total })}"
            >
              <i class="table-coverage-fill" style="width:${coverage.percent}%"></i>
            </div>
            <strong class="table-coverage-pct">${coverage.percent}%</strong>
          </div>` : ""}
      </section>
      <section class="table-grid player-stage ${showWheelStage ? "" : "table-grid-nowheel"}">
        ${showWheelStage ? `<aside class="wheel-panel">
          ${wheelOutcomeLabel ? `<p class="wheel-outcome ${wheelOutcomeClass}" aria-live="assertive">${wheelOutcomeLabel}</p>` : ""}
          ${buildWheel(playerGame.variant, playerGame.phase === "SPINNING")}
          ${historyHtml}
          <button type="button" id="player-anim" class="wheel-animation-toggle ${playerGame.animationEnabled ? "active" : ""}" title="${t("settings.animationHelp")}" aria-label="${t("settings.animation")}"><i class="tool-icon tool-motion" aria-hidden="true"></i><span>${playerGame.animationEnabled ? t("hud.animationOn") : t("hud.animationOff")}</span></button>
        </aside>` : ""}
        <section class="felt-panel player-felt casino-felt ${betting ? "interactive snap-felt" : ""}">
          ${showWheelStage ? "" : historyHtml}
          <div class="felt-heading"><span>${t("table.live")} / ${playerGame.variant.toUpperCase()}</span><small>${betting ? t("player.placeHint") : t("player.manualSpinHelp")}</small></div>
          <div class="felt-grid">${buildPlayerFelt(playerGame.variant, playerGame.result, feltDisplayBets(playerGame), betting, playerGame.chipHistory)}</div>
          <div class="felt-snap-guide" hidden aria-live="polite"></div>
          <section class="player-controls player-bet-dock" aria-label="${t("player.chipTray")}">
            ${playerChipMenuOpen ? `<button type="button" id="chip-picker-dismiss" class="chip-picker-dismiss" aria-label="${t("player.statsClose")}"></button>` : ""}
            <div class="chip-tray chip-selector">
              <span class="tray-label">${t("player.chipTray")}</span>
              <button
                type="button"
                id="player-chip-trigger"
                class="chip-btn casino-chip chip-${selectedChip} digits-${selectedChipDigits} active"
                aria-haspopup="menu"
                aria-expanded="${playerChipMenuOpen}"
                aria-label="${t("player.chipTray")}: ${selectedChip}"
                ${betting ? "" : "disabled"}
              ><span>${selectedChip}</span></button>
              ${playerChipMenuOpen ? `<div class="chip-picker-menu" role="menu" aria-label="${t("player.chipTray")}">
                ${cfg.chipDenominations.map((d) => {
                  const disabled = !betting || free < d;
                  const digits = String(d).length;
                  return `<button type="button" class="chip-btn casino-chip chip-${d} digits-${digits} ${selectedChip === d ? "active" : ""}" data-chip="${d}" role="menuitemradio" aria-checked="${selectedChip === d}" ${disabled ? "disabled" : ""}><span>${d}</span></button>`;
                }).join("")}
              </div>` : ""}
            </div>
            <div class="spin-cluster">
              <button type="button" id="player-undo" class="quick-action action-clear" ${!betting || (!playerGame.chipHistory.length && !playerGame.bets.length) ? "disabled" : ""} aria-label="${t("player.undoClearHelp")}" title="${t("player.undoClearHelp")}"><i aria-hidden="true"></i></button>
              <button type="button" id="player-double" class="quick-action quick-double" ${canDouble ? "" : "disabled"} title="${t("player.doubleHelp")}" aria-label="${t("player.double")}"><i aria-hidden="true">2&times;</i></button>
              <button type="button" id="player-rebet" class="quick-action quick-rebet" ${canRebet ? "" : "disabled"} title="${t("player.rebetHelp")}" aria-label="${t("player.rebet")}"><i aria-hidden="true"></i></button>
              <button type="button" id="player-spin" class="player-spin-btn" ${canSpin ? "" : "disabled"} aria-label="${t("player.spin")}">
                <span class="spin-label">${t("player.spin")}</span>
              </button>
            </div>
          </section>
          <nav class="player-service-bar" aria-label="${t("settings.title")}">
            <button type="button" id="player-racetrack" ${canOpenRacetrack ? "" : "disabled"} title="${t("racetrack.aria")}" aria-label="${t("racetrack.aria")}"><i class="tool-icon tool-track" aria-hidden="true"></i></button>
            <button type="button" id="player-strategies" ${canOpenStrategies ? "" : "disabled"} title="${t("player.strategyAria")}" aria-label="${t("player.strategyAria")}"><i class="tool-icon tool-star" aria-hidden="true"></i></button>
            <button type="button" id="player-stats" ${canOpenStats ? "" : "disabled"} title="${t("player.statsAria")}" aria-label="${t("player.statsAria")}"><i class="tool-icon tool-stats" aria-hidden="true"></i></button>
          </nav>
        </section>
      </section>
      ${moreSheetHtml}
      ${soundPanelHtml}
      ${playerGame.phase === "GAME_OVER" ? buildPlayerOutPanel() : ""}
      ${strategyPanelOpen && canOpenStrategies ? buildStrategyPanel(templates, free) : ""}
      ${racetrackOpen && canOpenRacetrack ? buildRacetrackPanel(playerGame, free) : ""}
      ${statsPanelOpen && canOpenStats ? buildStatsPanel(playerGame) : ""}
      ${buildResultRevealOverlay()}
    </main>`;

  const mountedPlayerFelt = app.querySelector<HTMLElement>(".player-felt");
  if (mountedPlayerFelt) markPlayerFeltStackLayers(mountedPlayerFelt);
  if (showWheelStage) mountWheel();
  const chipTrigger = app.querySelector<HTMLButtonElement>("#player-chip-trigger");
  let chipHoldTimer: number | null = null;
  let chipHoldOpened = false;
  const cancelChipHold = () => {
    if (chipHoldTimer !== null) window.clearTimeout(chipHoldTimer);
    chipHoldTimer = null;
  };
  chipTrigger?.addEventListener("pointerdown", (event) => {
    if (!betting || event.pointerType === "mouse" && event.button !== 0) return;
    cancelChipHold();
    chipHoldOpened = false;
    chipHoldTimer = window.setTimeout(() => {
      chipHoldOpened = true;
      playerChipMenuOpen = true;
      playSound("tick");
      renderPlayerTable();
    }, 420);
  });
  chipTrigger?.addEventListener("pointerup", cancelChipHold);
  chipTrigger?.addEventListener("pointercancel", cancelChipHold);
  chipTrigger?.addEventListener("click", () => {
    cancelChipHold();
    if (!betting || chipHoldOpened) return;
    playerChipMenuOpen = !playerChipMenuOpen;
    playSound("tick");
    renderPlayerTable();
  });
  app.querySelector<HTMLButtonElement>("#chip-picker-dismiss")?.addEventListener("click", () => {
    playerChipMenuOpen = false;
    renderPlayerTable();
  });
  app.querySelector<HTMLButtonElement>("#player-more")?.addEventListener("click", () => {
    if (playerGame?.phase === "SPINNING" || playerRevealing) return;
    playerChipMenuOpen = false;
    playerMenuOpen = true;
    playSound("tick");
    renderPlayerTable();
  });
  const closePlayerMenu = () => {
    if (!playerMenuOpen) return;
    playerMenuOpen = false;
    playSound("tick");
    renderPlayerTable();
  };
  app.querySelector<HTMLButtonElement>("#player-more-close")?.addEventListener("click", closePlayerMenu);
  app.querySelector<HTMLElement>("#player-more-backdrop")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closePlayerMenu();
  });
  app.querySelector<HTMLButtonElement>("#player-anim")?.addEventListener("click", () => {
    if (!playerGame) return;
    const next = !playerGame.animationEnabled;
    playerGame.animationEnabled = next;
    appSettings = updateSettings({ animationEnabled: next });
    playSound("tick");
    if (!next && playerGame.phase === "SPINNING") {
      wheelAnimation?.cancel();
      clearSpinTicks();
      settleActivePlayerSpin();
      return;
    }
    renderPlayerTable();
  });
  app.querySelector<HTMLButtonElement>("#sound")?.addEventListener("click", () => {
    soundPanelOpen = true;
    renderPlayerTable();
  });
  const closeSoundPanel = () => {
    if (!soundPanelOpen) return;
    soundPanelOpen = false;
    renderPlayerTable();
  };
  app.querySelector<HTMLButtonElement>("#sound-panel-close")?.addEventListener("click", closeSoundPanel);
  app.querySelector<HTMLElement>("#sound-panel-backdrop")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeSoundPanel();
  });
  app.querySelectorAll<HTMLButtonElement>("[data-player-sound]").forEach((button) => {
    button.addEventListener("click", () => {
      const muted = button.dataset.playerSound === "off";
      appSettings = updateSettings({ muted });
      setMuted(muted);
      syncScreenMusic("player");
      if (!muted) playSound("bet");
      renderPlayerTable();
    });
  });
  const playerMusicVolume = app.querySelector<HTMLInputElement>("#player-music-volume");
  const playerMusicVolumeValue = app.querySelector<HTMLOutputElement>("#player-music-volume-value");
  const applyPlayerMusicVolume = (persist: boolean) => {
    if (!playerMusicVolume) return;
    const pct = Math.min(100, Math.max(0, Number(playerMusicVolume.value) || 0));
    const volume = pct / 100;
    setMusicVolume(volume);
    if (playerMusicVolumeValue) playerMusicVolumeValue.textContent = `${pct}%`;
    if (persist) appSettings = updateSettings({ musicVolume: volume });
  };
  playerMusicVolume?.addEventListener("input", () => applyPlayerMusicVolume(false));
  playerMusicVolume?.addEventListener("change", () => applyPlayerMusicVolume(true));
  app.querySelectorAll<HTMLButtonElement>("[data-player-music]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.playerMusic;
      if (mode !== "random" && !PLAYER_MUSIC_TRACKS.some((track) => track.id === mode)) return;
      const playerMusicMode = mode as PlayerMusicMode;
      appSettings = updateSettings({ playerMusicMode });
      setPlayerMusicMode(playerMusicMode);
      setMusic("player");
      if (!isMuted()) playSound("tick");
      renderPlayerTable();
    });
  });
  app.querySelector<HTMLButtonElement>("#exit")?.addEventListener("click", showPlayerExitConfirm);
  app.querySelector<HTMLButtonElement>("#player-strategies")?.addEventListener("click", () => {
    if (!canOpenStrategies || creatorNameDialogOpen) return;
    playerMenuOpen = false;
    strategyPanelOpen = !strategyPanelOpen;
    if (strategyPanelOpen) {
      racetrackOpen = false;
      statsPanelOpen = false;
    }
    playSound("tick");
    renderPlayerTable();
  });
  app.querySelector<HTMLButtonElement>("#player-racetrack")?.addEventListener("click", () => {
    if (!canOpenRacetrack || creatorNameDialogOpen) return;
    playerMenuOpen = false;
    racetrackOpen = !racetrackOpen;
    if (racetrackOpen) {
      strategyPanelOpen = false;
      statsPanelOpen = false;
    }
    playSound("tick");
    renderPlayerTable();
  });
  app.querySelector<HTMLButtonElement>("#player-stats")?.addEventListener("click", () => {
    if (!canOpenStats || creatorNameDialogOpen) return;
    playerMenuOpen = false;
    statsPanelOpen = !statsPanelOpen;
    if (statsPanelOpen) {
      strategyPanelOpen = false;
      racetrackOpen = false;
    }
    playSound("tick");
    renderPlayerTable();
  });
  bindStrategyPanel(templates);
  if (racetrackOpen && canOpenRacetrack) bindRacetrackPanel();
  if (statsPanelOpen && canOpenStats) bindStatsPanel();
  // Name dialog from Racetrack “save as strategy” (creator screen has its own mount path)
  if (creatorNameDialogOpen) {
    mountCreatorNameDialog();
  }
  app.querySelectorAll<HTMLButtonElement>("[data-chip]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!playerGame || !betting) return;
      setSelectedChip(playerGame, Number(btn.dataset.chip));
      playerChipMenuOpen = false;
      playSound("tick");
      savePlayerLocal();
      renderPlayerTable();
    });
  });
  const undoButton = app.querySelector<HTMLButtonElement>("#player-undo");
  let undoHoldTimer: number | null = null;
  let undoHoldHandled = false;
  const cancelUndoHold = () => {
    if (undoHoldTimer !== null) window.clearTimeout(undoHoldTimer);
    undoHoldTimer = null;
  };
  undoButton?.addEventListener("pointerdown", (event) => {
    if (!playerGame || !betting || event.pointerType === "mouse" && event.button !== 0) return;
    cancelUndoHold();
    undoHoldHandled = false;
    undoHoldTimer = window.setTimeout(() => {
      undoHoldHandled = true;
      if (!playerGame || !clearPlayerBets(playerGame)) return;
      playSound("close");
      persistPlayerScore();
      savePlayerLocal();
      refreshPlayerBettingUi();
    }, 550);
  });
  undoButton?.addEventListener("pointerup", cancelUndoHold);
  undoButton?.addEventListener("pointercancel", cancelUndoHold);
  undoButton?.addEventListener("pointerleave", cancelUndoHold);
  undoButton?.addEventListener("click", () => {
    cancelUndoHold();
    if (undoHoldHandled || !playerGame || !undoChip(playerGame)) return;
    playSound("tick");
    persistPlayerScore();
    savePlayerLocal();
    refreshPlayerBettingUi();
  });
  app.querySelector<HTMLButtonElement>("#player-rebet")?.addEventListener("click", () => {
    if (!playerGame || !rebetLast(playerGame)) {
      playSound("error");
      refreshPlayerBettingUi();
      return;
    }
    playerMenuOpen = false;
    playerChipMenuOpen = false;
    playSound("bet");
    persistPlayerScore();
    savePlayerLocal();
    refreshPlayerBettingUi();
  });
  app.querySelector<HTMLButtonElement>("#player-double")?.addEventListener("click", () => {
    if (!playerGame || !doubleBets(playerGame)) {
      playSound("error");
      refreshPlayerBettingUi();
      return;
    }
    playerMenuOpen = false;
    playerChipMenuOpen = false;
    playSound("bet");
    persistPlayerScore();
    savePlayerLocal();
    refreshPlayerBettingUi();
  });
  app.querySelector<HTMLButtonElement>("#player-spin")?.addEventListener("click", () => {
    if (!playerGame || playerGame.phase !== "BETTING_OPEN") return;
    strategyPanelOpen = false;
    racetrackOpen = false;
    statsPanelOpen = false;
    playerMenuOpen = false;
    playerChipMenuOpen = false;
    performPlayerSpin();
  });
  bindResultRevealDismiss();
  if (betting && !strategyPanelOpen && !racetrackOpen && !statsPanelOpen && !playerMenuOpen && !playerChipMenuOpen && !soundPanelOpen) {
    bindFeltSnapPlacement(app.querySelector<HTMLElement>(".player-felt"), playerGame.variant, {
      onPlace: (betId) => {
        if (!playerGame) return false;
        if (!placeChip(playerGame, betId)) {
          playSound("error");
          return false;
        }
        playSound("bet");
        haptic(10);
        persistPlayerScore();
        savePlayerLocal();
        refreshPlayerBettingUi();
        return true;
      },
    });
  }
  app.querySelector<HTMLButtonElement>("#player-out-menu")?.addEventListener("click", () => {
    clearStoredSession();
    playerGame = null;
    creatorDraft = null;
    creatorNameDialogOpen = false;
    creatorNameBuffer = "";
    strategyPanelOpen = false;
    racetrackOpen = false;
    statsPanelOpen = false;
    showMenu();
  });
}

// ---------------------------------------------------------------------------
// Racetrack (French call bets + neighbors + finales)
// ---------------------------------------------------------------------------

function buildRacetrackPanel(state: PlayerGameState, free: number): string {
  const unit = state.selectedChip;
  const openBets = state.bets.length;
  const openCost = totalStaked(state);
  const canSaveStrategy = openBets > 0 && loadBetTemplates().length < MAX_BET_TEMPLATES;
  const frenchOk = isFrenchSectorAvailable(state.variant);
  const sectors = listSectorPackages();
  const sectorBtns = sectors.map((pack) => {
    const cost = packageCost(pack.lines, unit);
    const disabled = !frenchOk || free < cost;
    const title = !frenchOk ? t("racetrack.euOnly") : t("racetrack.cost", { amount: format(cost) });
    return `<button type="button" class="rt-sector rt-sector-${pack.id}" data-rt-sector="${pack.id}" ${disabled ? "disabled" : ""} title="${title}" data-rt-pockets="${pack.pockets.join(",")}">
      <b>${t(pack.labelKey)}</b>
      <span>${pack.chipCount}× · ${format(cost)}</span>
    </button>`;
  }).join("");

  const radiusBtns = NEIGHBOR_RADIUS_OPTIONS.map((r) => {
    const span = neighborSpan(r);
    return `<button type="button" class="rt-span ${racetrackNeighborRadius === r ? "active" : ""}" data-rt-radius="${r}" title="${t("racetrack.span", { n: span })}">${span}</button>`;
  }).join("");

  const pockets = wheelPockets(state.variant);
  const n = pockets.length;
  // Ellipse layout (percent of track area)
  const cx = 50;
  const cy = 50;
  const rx = 42;
  const ry = 34;
  const cells = pockets.map((pocket, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    const color = pocketColor(pocket);
    const sector = state.variant === "european" ? sectorForPocket(pocket) : null;
    const neigh = getNeighborsPackage(state.variant, pocket, racetrackNeighborRadius);
    const cost = neigh ? packageCost(neigh.lines, unit) : 0;
    const disabled = !neigh || free < cost;
    return `<button type="button" class="rt-pocket color-${color}${sector ? ` sec-${sector}` : ""}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%" data-rt-pocket="${pocket}" data-rt-pockets="${neigh?.pockets.join(",") ?? pocket}" ${disabled ? "disabled" : ""} title="${t("racetrack.neighbors")} ${pocket} · ${t("racetrack.cost", { amount: format(cost) })}">${pocket}</button>`;
  }).join("");

  const finales = Array.from({ length: 10 }, (_, d) => {
    const pack = getFinalePackage(d, state.variant);
    if (!pack) return "";
    const cost = packageCost(pack.lines, unit);
    const disabled = free < cost;
    return `<button type="button" class="rt-finale" data-rt-finale="${d}" data-rt-pockets="${pack.pockets.join(",")}" ${disabled ? "disabled" : ""} title="${t("racetrack.cost", { amount: format(cost) })}"><b>${d}</b><span>${pack.chipCount}×</span></button>`;
  }).join("");

  return `<div class="racetrack-panel" role="dialog" aria-labelledby="racetrack-title">
    <div class="racetrack-card">
      <header class="racetrack-header">
        <div>
          <h2 id="racetrack-title">${t("racetrack.title")}</h2>
          <p class="racetrack-help">${t("racetrack.help")}</p>
        </div>
        <div class="racetrack-header-actions">
          <button type="button" id="racetrack-save-strategy" class="chrome-button racetrack-save-btn" ${canSaveStrategy ? "" : "disabled"} title="${canSaveStrategy ? t("racetrack.saveStrategyHelp", { n: openBets, amount: format(openCost) }) : t("racetrack.saveStrategyNeedBets")}">${t("racetrack.saveStrategy")}${openBets ? ` (${openBets})` : ""}</button>
          <button type="button" id="racetrack-close" class="chrome-button">${t("racetrack.close")}</button>
        </div>
      </header>
      <div class="racetrack-meta">
        <span>${t("racetrack.unit", { chip: unit })}</span>
        <span>${t("racetrack.free", { amount: format(free) })}</span>
        <span class="rt-variant">${state.variant === "european" ? "EU" : "US"}</span>
      </div>
      ${!frenchOk ? `<p class="racetrack-eu-note">${t("racetrack.euOnly")}</p>` : ""}
      <section class="racetrack-sectors" aria-label="${t("racetrack.sectors")}">
        <span class="rt-label">${t("racetrack.sectors")}</span>
        <div class="rt-sector-row">${sectorBtns}</div>
      </section>
      <section class="racetrack-neighbors-bar">
        <span class="rt-label">${t("racetrack.neighbors")}</span>
        <div class="rt-span-row" role="group" aria-label="${t("racetrack.neighbors")}">${radiusBtns}</div>
        <small>${t("racetrack.neighborsHelp")}</small>
      </section>
      <div class="racetrack-track-wrap">
        <div class="racetrack-track" aria-label="${t("racetrack.title")}">
          <div class="racetrack-inner">
            <span class="rt-inner-label">${t("racetrack.neighbors")}</span>
            <span class="rt-inner-span">${t("racetrack.span", { n: neighborSpan(racetrackNeighborRadius) })}</span>
          </div>
          ${cells}
        </div>
        <p class="racetrack-preview" id="racetrack-preview" aria-live="polite">${t("racetrack.previewNone")}</p>
      </div>
      <section class="racetrack-finales" aria-label="${t("racetrack.finales")}">
        <span class="rt-label">${t("racetrack.finales")}</span>
        <div class="rt-finale-row">${finales}</div>
      </section>
    </div>
  </div>`;
}

function setRacetrackHighlight(pockets: string[] | null): void {
  const list = pockets?.filter(Boolean) ?? [];
  const set = new Set(list);
  app.querySelectorAll<HTMLElement>("[data-rt-pocket]").forEach((el) => {
    const p = el.dataset.rtPocket ?? "";
    el.classList.toggle("rt-hi", set.has(p));
  });
  const preview = app.querySelector<HTMLElement>("#racetrack-preview");
  if (!preview) return;
  // Always visible fixed line — never hide (avoids layout jump / hover flicker)
  preview.textContent = list.length
    ? t("racetrack.preview", { pockets: list.join(" · ") })
    : t("racetrack.previewNone");
  preview.classList.toggle("has-selection", list.length > 0);
}

function applyRacetrackPackage(bets: PlacedBet[]): void {
  if (!playerGame) return;
  if (creatorNameDialogOpen) return;
  if (!placeBetsPackage(playerGame, bets)) {
    playSound("error");
    renderPlayerTable();
    return;
  }
  playSound("bet");
  persistPlayerScore();
  savePlayerLocal();
  // Keep racetrack open so the player can stack more call bets
  renderPlayerTable();
}

/** Snapshot open table bets into a draft and open the shared name dialog. */
function openRacetrackStrategySave(): void {
  if (!playerGame || playerGame.phase !== "BETTING_OPEN") return;
  if (!playerGame.bets.length) {
    playSound("error");
    return;
  }
  if (loadBetTemplates().length >= MAX_BET_TEMPLATES) {
    playSound("error");
    showAppNotice(t("player.strategyFull", { max: MAX_BET_TEMPLATES }), "error");
    return;
  }
  creatorDraft = createBetCreatorDraft(playerGame.variant, {
    bets: structuredClone(playerGame.bets),
    selectedChip: playerGame.selectedChip,
  });
  creatorNameBuffer = "";
  creatorNameDialogOpen = true;
  playSound("tick");
  mountCreatorNameDialog();
}

function bindRacetrackPanel(): void {
  if (!playerGame) return;
  const state = playerGame;
  const unit = state.selectedChip;

  app.querySelector<HTMLButtonElement>("#racetrack-close")?.addEventListener("click", () => {
    if (creatorNameDialogOpen) return;
    racetrackOpen = false;
    playSound("tick");
    renderPlayerTable();
  });

  app.querySelector<HTMLButtonElement>("#racetrack-save-strategy")?.addEventListener("click", () => {
    openRacetrackStrategySave();
  });

  app.querySelectorAll<HTMLButtonElement>("[data-rt-radius]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = Number(btn.dataset.rtRadius) as NeighborRadius;
      if (!NEIGHBOR_RADIUS_OPTIONS.includes(r)) return;
      racetrackNeighborRadius = r;
      playSound("tick");
      renderPlayerTable();
    });
  });

  const bindHover = (el: HTMLElement) => {
    el.addEventListener("pointerenter", () => {
      const raw = el.dataset.rtPockets ?? "";
      setRacetrackHighlight(raw ? raw.split(",").filter(Boolean) : null);
    });
    el.addEventListener("pointerleave", (event) => {
      // Don't flash "none" while moving to another racetrack control
      const next = event.relatedTarget;
      if (next instanceof Element && next.closest("[data-rt-pockets], [data-rt-pocket], [data-rt-sector], [data-rt-finale]")) {
        return;
      }
      setRacetrackHighlight(null);
    });
  };

  app.querySelectorAll<HTMLButtonElement>("[data-rt-sector]").forEach((btn) => {
    bindHover(btn);
    btn.addEventListener("click", () => {
      if (!playerGame || !isFrenchSectorAvailable(playerGame.variant)) return;
      const id = btn.dataset.rtSector as CallSectorId;
      const pack = getSectorPackage(id);
      applyRacetrackPackage(expandRecipe(pack.lines, unit));
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-rt-pocket]").forEach((btn) => {
    bindHover(btn);
    btn.addEventListener("click", () => {
      if (!playerGame) return;
      const pocket = btn.dataset.rtPocket ?? "";
      const pack = getNeighborsPackage(playerGame.variant, pocket, racetrackNeighborRadius);
      if (!pack) return;
      applyRacetrackPackage(expandRecipe(pack.lines, unit));
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-rt-finale]").forEach((btn) => {
    bindHover(btn);
    btn.addEventListener("click", () => {
      if (!playerGame) return;
      const d = Number(btn.dataset.rtFinale);
      const pack = getFinalePackage(d, playerGame.variant);
      if (!pack) return;
      applyRacetrackPackage(expandRecipe(pack.lines, unit));
    });
  });
}

/** freeScore only — strategy apply stacks (does not free staked chips first). */
function buildStrategyPanel(templates: BetTemplate[], freeScore: number): string {
  const listFull = templates.length >= MAX_BET_TEMPLATES;
  const rows = templates.length
    ? templates.map((item) => {
      const cost = templateTotal(item.bets);
      const canApply = freeScore >= cost;
      return `<li class="strategy-row" data-strategy-id="${item.id}">
        <div class="strategy-meta">
          <button type="button" class="strategy-name-btn" data-strategy-apply="${item.id}" ${canApply ? "" : "disabled"} title="${t("player.strategyApplyHelp")}">${escapeHtml(item.name)}</button>
          <span>${t("player.strategyCost", { amount: format(cost) })} · ${item.bets.length} · ${item.variant === "european" ? "EU" : "US"}</span>
        </div>
        <div class="strategy-row-actions">
          <button type="button" class="chrome-button" data-strategy-apply="${item.id}" ${canApply ? "" : "disabled"} title="${t("player.strategyApplyHelp")}">${t("player.strategyApply")}</button>
          <button type="button" class="chrome-button" data-strategy-copy="${item.id}" ${listFull ? "disabled" : ""} title="${t("player.strategyCopyHelp")}">${t("player.strategyCopy")}</button>
          <button type="button" class="chrome-button" data-strategy-edit="${item.id}">${t("player.strategyEdit")}</button>
          <button type="button" class="chrome-button danger" data-strategy-delete="${item.id}">${t("player.strategyDelete")}</button>
        </div>
      </li>`;
    }).join("")
    : `<li class="strategy-empty">${t("player.strategyEmpty")}</li>`;

  return `<div class="strategy-panel" role="dialog" aria-labelledby="strategy-title">
    <div class="strategy-card">
      <header class="strategy-card-header">
        <h2 id="strategy-title">${t("player.strategyListTitle")}</h2>
        <div class="strategy-header-actions">
          <button type="button" id="strategy-open-creator" class="chrome-button strategy-create-btn">${t("player.strategyCreate")}</button>
          <button type="button" id="strategy-close" class="chrome-button">${t("player.strategyClose")}</button>
        </div>
      </header>
      <ul class="strategy-list">${rows}</ul>
    </div>
  </div>`;
}

function buildStatsPanel(state: PlayerGameState): string {
  const profit = playerProfit(state);
  const { wins, losses, startingScore, bankrollHistory } = state.stats;
  const current = state.tableScore + totalStaked(state);
  const hands = wins + losses;
  // Live point for the curve (open bets already count toward total)
  const curve = bankrollHistory.length
    ? (bankrollHistory[bankrollHistory.length - 1] === current
      ? bankrollHistory
      : [...bankrollHistory, current])
    : [startingScore, current];
  const profitClass = profit > 0 ? "up" : profit < 0 ? "down" : "flat";
  const profitLabel = profit > 0
    ? `+${format(profit)}`
    : profit < 0
      ? `−${format(Math.abs(profit))}`
      : format(0);

  return `<div class="stats-panel" role="dialog" aria-labelledby="stats-title">
    <div class="stats-card">
      <header class="stats-card-header">
        <h2 id="stats-title">${t("player.statsTitle")}</h2>
        <button type="button" id="stats-close" class="chrome-button">${t("player.statsClose")}</button>
      </header>
      <div class="stats-metrics" role="group" aria-label="${t("player.statsTitle")}">
        <div class="stats-metric profit ${profitClass}">
          <span>${t("player.statsProfit")}</span>
          <strong>${profitLabel}</strong>
        </div>
        <div class="stats-metric wins">
          <span>${t("player.statsWins")}</span>
          <strong>${format(wins)}</strong>
        </div>
        <div class="stats-metric losses">
          <span>${t("player.statsLosses")}</span>
          <strong>${format(losses)}</strong>
        </div>
      </div>
      <div class="stats-chart-wrap">
        <div class="stats-chart-head">
          <span>${t("player.statsBankroll")}</span>
          <small>${t("player.statsHands", { n: hands })} · ${t("player.statsStart", { amount: format(startingScore) })}</small>
        </div>
        ${buildBankrollChartSvg(curve)}
        <div class="stats-chart-foot">
          <span>${t("player.statsCurrent", { amount: format(current) })}</span>
        </div>
      </div>
    </div>
  </div>`;
}

/** Pixel-friendly SVG line chart of bankroll over hands. */
function buildBankrollChartSvg(values: number[]): string {
  const w = 320;
  const h = 140;
  const series = values.length ? values : [0];
  let minV = Math.min(...series);
  let maxV = Math.max(...series);
  if (minV === maxV) {
    minV = Math.max(0, minV - 10);
    maxV = maxV + 10;
  }
  const range = maxV - minV || 1;
  const mid = minV + range / 2;
  const yValues = [maxV, mid, minV];
  const longestAxisLabel = Math.max(...yValues.map((value) => format(Math.round(value)).length));
  const padL = Math.min(92, Math.max(44, Math.ceil(longestAxisLabel * 6 + 12)));
  const padR = 10;
  const padT = 12;
  const padB = 22;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const n = series.length;
  const xAt = (i: number): number => (n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const yAt = (v: number): number => padT + plotH - ((v - minV) / range) * plotH;

  const points = series.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
  const areaPoints = n === 1
    ? `${padL},${(padT + plotH).toFixed(1)} ${xAt(0).toFixed(1)},${yAt(series[0]!).toFixed(1)} ${(padL + plotW).toFixed(1)},${(padT + plotH).toFixed(1)}`
    : `${padL},${(padT + plotH).toFixed(1)} ${points} ${(padL + plotW).toFixed(1)},${(padT + plotH).toFixed(1)}`;

  const last = series[n - 1]!;
  const first = series[0]!;
  const stroke = last > first ? "#5fd08a" : last < first ? "#e07070" : "#c69e45";
  const yLabels = [
    { v: maxV, y: yAt(maxV) },
    { v: mid, y: yAt(mid) },
    { v: minV, y: yAt(minV) },
  ];

  const grid = yLabels.map(({ y }) =>
    `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${padL + plotW}" y2="${y.toFixed(1)}" class="stats-grid"/>`
  ).join("");
  const labels = yLabels.map(({ v, y }) =>
    `<text x="${padL - 4}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="stats-axis">${format(Math.round(v))}</text>`
  ).join("");
  const dots = series.map((v, i) =>
    `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(v).toFixed(1)}" r="${i === n - 1 ? 3.5 : 2.2}" class="stats-dot${i === n - 1 ? " last" : ""}"/>`
  ).join("");

  const emptyNote = n <= 1
    ? `<text x="${(w / 2).toFixed(1)}" y="${(h / 2 + 4).toFixed(1)}" text-anchor="middle" class="stats-empty">${t("player.statsChartEmpty")}</text>`
    : "";

  return `<svg class="stats-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${t("player.statsBankroll")}">
    <rect x="0" y="0" width="${w}" height="${h}" class="stats-chart-bg"/>
    ${grid}
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" class="stats-axis-line"/>
    <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" class="stats-axis-line"/>
    ${labels}
    <polygon points="${areaPoints}" class="stats-area" style="fill:${stroke}"/>
    <polyline points="${points}" class="stats-line" style="stroke:${stroke}"/>
    ${dots}
    ${emptyNote}
  </svg>`;
}

function bindStatsPanel(): void {
  app.querySelector<HTMLButtonElement>("#stats-close")?.addEventListener("click", () => {
    statsPanelOpen = false;
    playSound("tick");
    renderPlayerTable();
  });
  // Click backdrop to close
  app.querySelector<HTMLElement>(".stats-panel")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      statsPanelOpen = false;
      playSound("tick");
      renderPlayerTable();
    }
  });
}

function bindStrategyPanel(templates: BetTemplate[]): void {
  app.querySelector<HTMLButtonElement>("#strategy-close")?.addEventListener("click", () => {
    strategyPanelOpen = false;
    playSound("tick");
    renderPlayerTable();
  });
  app.querySelector<HTMLButtonElement>("#strategy-open-creator")?.addEventListener("click", () => {
    if (!playerGame) return;
    openBetCreatorFromTable();
    playSound("level");
    renderPlayerTable();
  });
  const applyStrategyById = (id: string): void => {
    if (!playerGame) return;
    const item = templates.find((t) => t.id === id);
    if (!item) return;
    if (item.variant !== playerGame.variant) {
      playSound("error");
      showAppNotice(t("player.strategyWrongVariant", { variant: item.variant === "european" ? "EU" : "US" }), "error");
      return;
    }
    if (!applySavedBets(playerGame, item.bets, "strategy")) {
      playSound("error");
      renderPlayerTable();
      return;
    }
    // Keep list open so the player can stack the same strategy (click name 3× → 3× layout)
    playSound("bet");
    persistPlayerScore();
    savePlayerLocal();
    renderPlayerTable();
  };

  app.querySelectorAll<HTMLButtonElement>("[data-strategy-apply]").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyStrategyById(btn.dataset.strategyApply ?? "");
    });
  });
  app.querySelectorAll<HTMLButtonElement>("[data-strategy-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.strategyCopy ?? "";
      const item = templates.find((t) => t.id === id) ?? loadBetTemplates().find((t) => t.id === id);
      if (!item) return;
      if (loadBetTemplates().length >= MAX_BET_TEMPLATES) {
        playSound("error");
        showAppNotice(t("player.strategyFull", { max: MAX_BET_TEMPLATES }), "error");
        return;
      }
      const copied = duplicateBetTemplate(item.id, uniqueStrategyCopyName(item.name));
      if (!copied) {
        playSound("error");
        return;
      }
      playSound("tick");
      renderPlayerTable();
    });
  });
  app.querySelectorAll<HTMLButtonElement>("[data-strategy-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!playerGame) return;
      const id = btn.dataset.strategyEdit ?? "";
      const item = templates.find((t) => t.id === id) ?? loadBetTemplates().find((t) => t.id === id);
      if (!item) return;
      strategyPanelOpen = false;
      creatorNameDialogOpen = false;
      playerChipMenuOpen = false;
      creatorDraft = createBetCreatorDraft(playerGame.variant, {
        editingId: item.id,
        name: item.name,
        bets: item.bets,
        selectedChip: playerGame.selectedChip,
      });
      playSound("tick");
      renderPlayerTable();
    });
  });
  app.querySelectorAll<HTMLButtonElement>("[data-strategy-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.strategyDelete ?? "";
      const item = loadBetTemplates().find((t) => t.id === id);
      if (!item) return;
      deleteBetTemplate(id);
      playSound("close");
      renderPlayerTable();
    });
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Full-felt Bet Creator — wheel hidden; no score deduction. */
function renderBetCreator(): void {
  if (!playerGame || !creatorDraft) return;
  if (!creatorNameDialogOpen) removeCreatorNameDialogLayer();
  wheelAnimation?.cancel();
  wheelAnimation = null;
  const cfg = getPlayerModeConfig();
  const draft = creatorDraft;
  const cost = draftTotal(draft);
  const free = playerGame.tableScore + totalStaked(playerGame);
  const selectedChipDigits = String(draft.selectedChip).length;
  const historyHtml = `<div class="history history-bar"><span>${t("table.lastNumbers")}</span><div>${playerGame.history.length ? playerGame.history.slice(0, 12).map(numberChip).join("") : `<i>${t("table.firstSpin")}</i>`}</div></div>`;

  app.innerHTML = `
    <main class="game-shell player-mode mobile-first-player player-nowheel is-betting creator-standard-table">
      <header class="player-hud">
        <div class="player-hud-brand" aria-hidden="true"><i></i><span>R</span></div>
        <div class="player-hud-metric player-hud-score"><span>${t("player.creatorTotal")}</span><strong>${format(cost)}</strong></div>
        <div class="player-hud-metric player-hud-bet"><span>${t("player.score")}</span><strong>${format(free)}</strong></div>
        <nav class="player-hud-actions">
          <button type="button" id="creator-back" class="player-hud-button hud-exit" aria-label="${t("player.creatorBack")}" title="${t("player.creatorBack")}"><i aria-hidden="true"></i></button>
        </nav>
      </header>
      <section class="phase-row player-phase-row">
        <span>${t("player.creatorTitle")}</span>
        <b>${!draft.editingId && draft.bets.length ? t("player.strategyPrefillHelp") : t("player.creatorHelp")}</b>
      </section>
      <section class="table-grid player-stage table-grid-nowheel">
        <section class="felt-panel player-felt casino-felt interactive snap-felt">
          ${historyHtml}
          <div class="felt-heading">
            <span>${t("table.live")} / ${draft.variant.toUpperCase()}</span>
            <small>${t("player.placeHint")}</small>
          </div>
          <div class="felt-grid">${buildPlayerFelt(draft.variant, null, draft.bets, true, draft.chipHistory)}</div>
          <div class="felt-snap-guide" hidden aria-live="polite"></div>
          <section class="player-controls player-bet-dock" aria-label="${t("player.chipTray")}">
            ${playerChipMenuOpen ? `<button type="button" id="chip-picker-dismiss" class="chip-picker-dismiss" aria-label="${t("player.statsClose")}"></button>` : ""}
            <div class="chip-tray chip-selector">
              <span class="tray-label">${t("player.chipTray")}</span>
              <button
                type="button"
                id="player-chip-trigger"
                class="chip-btn casino-chip chip-${draft.selectedChip} digits-${selectedChipDigits} active"
                aria-haspopup="menu"
                aria-expanded="${playerChipMenuOpen}"
                aria-label="${t("player.chipTray")}: ${draft.selectedChip}"
              ><span>${draft.selectedChip}</span></button>
              ${playerChipMenuOpen ? `<div class="chip-picker-menu" role="menu" aria-label="${t("player.chipTray")}">
                ${cfg.chipDenominations.map((d) => {
                  const digits = String(d).length;
                  return `<button type="button" class="chip-btn casino-chip chip-${d} digits-${digits} ${draft.selectedChip === d ? "active" : ""}" data-chip="${d}" role="menuitemradio" aria-checked="${draft.selectedChip === d}"><span>${d}</span></button>`;
                }).join("")}
              </div>` : ""}
            </div>
            <div class="spin-cluster creator-standard-actions">
              <button type="button" id="creator-undo" class="quick-action action-clear" ${!draft.chipHistory.length && !draft.bets.length ? "disabled" : ""} aria-label="${t("player.undoClearHelp")}" title="${t("player.undoClearHelp")}"><i aria-hidden="true"></i></button>
              <button type="button" id="creator-save" class="player-spin-btn creator-save-action" ${cost > 0 ? "" : "disabled"} aria-label="${t("player.creatorSave")}"><span class="spin-label">${t("player.creatorSaveShort")}</span></button>
            </div>
          </section>
        </section>
      </section>
    </main>`;

  // Re-attach name dialog after a full re-render without wiping the typed buffer.
  if (creatorNameDialogOpen) {
    mountCreatorNameDialog();
  }

  app.querySelector<HTMLButtonElement>("#creator-back")?.addEventListener("click", () => {
    creatorDraft = null;
    creatorNameDialogOpen = false;
    creatorNameBuffer = "";
    playerChipMenuOpen = false;
    playSound("tick");
    renderPlayerTable();
  });
  app.querySelector<HTMLButtonElement>("#player-chip-trigger")?.addEventListener("click", () => {
    if (creatorNameDialogOpen) return;
    playerChipMenuOpen = !playerChipMenuOpen;
    playSound("tick");
    renderBetCreator();
  });
  app.querySelector<HTMLButtonElement>("#chip-picker-dismiss")?.addEventListener("click", () => {
    playerChipMenuOpen = false;
    renderBetCreator();
  });
  app.querySelectorAll<HTMLButtonElement>("[data-chip]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!creatorDraft || creatorNameDialogOpen) return;
      setDraftChip(creatorDraft, Number(btn.dataset.chip));
      playerChipMenuOpen = false;
      playSound("tick");
      renderBetCreator();
    });
  });
  const undoButton = app.querySelector<HTMLButtonElement>("#creator-undo");
  let undoHoldTimer: number | null = null;
  let undoHoldHandled = false;
  const cancelUndoHold = () => {
    if (undoHoldTimer !== null) window.clearTimeout(undoHoldTimer);
    undoHoldTimer = null;
  };
  undoButton?.addEventListener("pointerdown", (event) => {
    if (!creatorDraft || creatorNameDialogOpen || event.pointerType === "mouse" && event.button !== 0) return;
    cancelUndoHold();
    undoHoldHandled = false;
    undoHoldTimer = window.setTimeout(() => {
      undoHoldHandled = true;
      if (!creatorDraft || !clearDraftBets(creatorDraft)) return;
      playSound("close");
      renderBetCreator();
    }, 550);
  });
  undoButton?.addEventListener("pointerup", cancelUndoHold);
  undoButton?.addEventListener("pointercancel", cancelUndoHold);
  undoButton?.addEventListener("pointerleave", cancelUndoHold);
  undoButton?.addEventListener("click", () => {
    cancelUndoHold();
    if (undoHoldHandled || !creatorDraft || creatorNameDialogOpen || !undoDraftChip(creatorDraft)) return;
    playSound("tick");
    renderBetCreator();
  });
  app.querySelector<HTMLButtonElement>("#creator-save")?.addEventListener("click", () => {
    if (!creatorDraft) return;
    if (!creatorDraft.bets.length) {
      playSound("error");
      showAppNotice(t("player.creatorNeedBets"), "error");
      return;
    }
    if (!creatorDraft.editingId && loadBetTemplates().length >= MAX_BET_TEMPLATES) {
      playSound("error");
      showAppNotice(t("player.strategyFull", { max: MAX_BET_TEMPLATES }), "error");
      return;
    }
    // Open dialog in-place (no full re-render) so typing is never wiped by DOM rebuild.
    playerChipMenuOpen = false;
    creatorNameBuffer = creatorDraft.name ?? "";
    creatorNameDialogOpen = true;
    playSound("tick");
    mountCreatorNameDialog();
  });
  if (!creatorNameDialogOpen) {
    bindFeltSnapPlacement(app.querySelector<HTMLElement>(".player-felt"), draft.variant, {
      onPlace: (betId) => {
        if (!creatorDraft) return false;
        if (!placeDraftChip(creatorDraft, betId)) {
          playSound("error");
          return false;
        }
        playSound("bet");
        renderBetCreator();
        return true;
      },
    });
  }
}

interface FeltSnapHandlers {
  onPlace: (betId: string) => boolean;
}

/** Magnetic snap placement: pointer → nearest bet (straight/split/corner/…). */
function bindFeltSnapPlacement(
  felt: HTMLElement | null,
  variant: TableVariant,
  handlers: FeltSnapHandlers,
): void {
  if (!felt || !felt.classList.contains("interactive")) return;
  const { onPlace } = handlers;
  const guide = felt.querySelector<HTMLElement>(".felt-snap-guide");
  let activeSnap: FeltSnapResult | null = null;
  let activeCell: HTMLElement | null = null;
  let dragging = false;
  const snapBetPockets = new Map(
    ((variant === "european" ? europeanBets.bets : americanBets.bets) as BetDefinition[])
      .map((bet) => [bet.id, bet.pockets] as const),
  );

  const clearGuide = () => {
    activeSnap = null;
    if (activeCell) activeCell.classList.remove("snap-target");
    activeCell = null;
    felt.querySelectorAll(".snap-target").forEach((el) => el.classList.remove("snap-target"));
    felt.querySelectorAll(".snap-pocket").forEach((el) => el.classList.remove("snap-pocket"));
    if (guide) {
      guide.hidden = true;
      guide.textContent = "";
    }
  };

  const showGuide = (cell: HTMLElement, snap: FeltSnapResult, clientX: number, clientY: number) => {
    activeSnap = snap;
    if (activeCell !== cell) {
      activeCell?.classList.remove("snap-target");
      activeCell = cell;
      cell.classList.add("snap-target");
    }
    // Illuminate every pocket covered by the snapped bet (split, street,
    // corner, six-line and zero families), not only the cell under the pointer.
    felt.querySelectorAll(".snap-pocket").forEach((el) => el.classList.remove("snap-pocket"));
    for (const pocket of snapBetPockets.get(snap.betId) ?? []) {
      const selector = pocket === "0" || pocket === "00"
        ? `.zero-zone [data-zero="${CSS.escape(pocket)}"]`
        : `.felt-cell[data-pocket="${CSS.escape(pocket)}"]`;
      felt.querySelector<HTMLElement>(selector)?.classList.add("snap-pocket");
    }
    // Mark matching hit marker if present (chip stack host)
    felt.querySelectorAll(".inside-hit.snap-target").forEach((el) => el.classList.remove("snap-target"));
    const hit = cell.querySelector<HTMLElement>(`[data-bet="${CSS.escape(snap.betId)}"], [data-preview="${CSS.escape(snap.betId)}"]`);
    hit?.classList.add("snap-target");

    if (guide) {
      const kind = t(snapKindLabelKey(snap.kind));
      const betLabel = snap.betId.replace(/_/g, " ");
      guide.hidden = false;
      guide.textContent = t("player.snap.guide", { kind, bet: betLabel });
      const feltRect = felt.getBoundingClientRect();
      const gx = clientX - feltRect.left;
      const gy = clientY - feltRect.top;
      guide.style.left = `${Math.min(feltRect.width - 8, Math.max(8, gx))}px`;
      guide.style.top = `${Math.min(feltRect.height - 8, Math.max(8, gy - 36))}px`;
    }
  };

  const resolveFromEvent = (event: PointerEvent | MouseEvent): { cell: HTMLElement; snap: FeltSnapResult } | null => {
    // elementFromPoint lets placement resolve through visual chip stacks.
    const el = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const target = el && felt.contains(el) ? el : (event.target as HTMLElement | null);
    if (!target) return null;

    const portraitFelt = window.matchMedia("(orientation: portrait)").matches
      && felt.closest(".mobile-first-player") !== null;

    // Portrait uses one explicit 0-1-2-3 target. It is intentionally resolved
    // before the generic magnetic geometry so preview and placement cannot
    // jump to the opposite edge of the rotated zero cell.
    if (portraitFelt && variant === "european") {
      const firstFourTarget = target.closest<HTMLElement>(".portrait-first-four-target");
      const zeroCell = firstFourTarget?.closest<HTMLElement>(".zero-zone b[data-zero=\"0\"]");
      if (firstFourTarget && zeroCell && felt.contains(firstFourTarget)) {
        return {
          cell: zeroCell,
          snap: {
            betId: "first_four_0_1_2_3",
            kind: "firstFour",
            anchorX: 0.1,
            anchorY: 1,
          },
        };
      }
    }

    // Outside bets: direct data-bet, no magnetic snap needed.
    const outside = target.closest<HTMLElement>(".column-pays [data-bet], .dozens [data-bet], .even-money [data-bet], .column-pays [data-preview], .dozens [data-preview], .even-money [data-preview]");
    if (outside?.dataset.bet || outside?.dataset.preview) {
      const betId = outside.dataset.bet ?? outside.dataset.preview ?? "";
      return {
        cell: outside,
        snap: { betId, kind: "outside", anchorX: 0.5, anchorY: 0.5 },
      };
    }

    const cell = target.closest<HTMLElement>(".felt-cell, .zero-zone b");
    if (!cell || !felt.contains(cell)) return null;
    const rect = cell.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const lx = (event.clientX - rect.left) / rect.width;
    const ly = (event.clientY - rect.top) / rect.height;
    // Portrait felt is the physical table rotated into 3 columns × 12 rows.
    // Convert screen coordinates back to the canonical horizontal felt used by the rules engine.
    const logicalX = portraitFelt ? ly : lx;
    const logicalY = portraitFelt ? 1 - lx : ly;

    if (cell.dataset.zero === "0" || cell.dataset.zero === "00") {
      const snap = resolveZeroSnap(
        variant,
        cell.dataset.zero as "0" | "00",
        logicalX,
        logicalY,
        !portraitFelt,
      );
      return { cell, snap };
    }
    const col = Number(cell.dataset.col);
    const row = Number(cell.dataset.row);
    if (!Number.isFinite(col) || !Number.isFinite(row)) {
      // Fallback legacy: data-bet only
      const betId = cell.dataset.bet ?? cell.dataset.preview ?? "";
      if (!betId) return null;
      return { cell, snap: { betId, kind: "straight", anchorX: 0.5, anchorY: 0.5 } };
    }
    return {
      cell,
      snap: resolveNumberCellSnap(col, row, logicalX, logicalY, variant, !portraitFelt),
    };
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging && event.pointerType === "mouse" && event.buttons === 0) {
      const resolved = resolveFromEvent(event);
      if (!resolved) {
        clearGuide();
        return;
      }
      showGuide(resolved.cell, resolved.snap, event.clientX, event.clientY);
      return;
    }
    if (!dragging) return;
    event.preventDefault();

    const resolved = resolveFromEvent(event);
    if (!resolved) {
      clearGuide();
      return;
    }
    showGuide(resolved.cell, resolved.snap, event.clientX, event.clientY);
  };

  const onDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const resolved = resolveFromEvent(event);
    if (!resolved) return;

    dragging = true;
    felt.classList.add("is-snapping");
    try {
      felt.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    if (resolved) showGuide(resolved.cell, resolved.snap, event.clientX, event.clientY);
  };

  const onUp = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    felt.classList.remove("is-snapping");
    try {
      felt.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }

    const resolved = resolveFromEvent(event) ?? (activeSnap && activeCell ? { cell: activeCell, snap: activeSnap } : null);
    clearGuide();
    if (!resolved?.snap.betId) return;
    onPlace(resolved.snap.betId);
  };

  const onCancel = () => {
    dragging = false;
    felt.classList.remove("is-snapping");
    clearGuide();
  };

  felt.addEventListener("pointerdown", onDown);
  felt.addEventListener("pointermove", onPointerMove);
  felt.addEventListener("pointerup", onUp);
  felt.addEventListener("pointercancel", onCancel);
  felt.addEventListener("pointerleave", () => {
    if (!dragging) clearGuide();
  });
  felt.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-bet]");
    const betId = target?.dataset.bet;
    if (!betId || !felt.contains(target)) return;
    event.preventDefault();
    onPlace(betId);
  });
}

function buildCreatorNameDialogHtml(): string {
  return `<div class="creator-name-dialog" role="dialog" aria-modal="true" aria-labelledby="creator-name-title">
    <div class="creator-name-card">
      <h2 id="creator-name-title">${t("player.creatorNameTitle")}</h2>
      <p class="creator-name-help" id="creator-name-help">${t("player.creatorNameHelp")}</p>
      <label class="creator-name-label" for="creator-name">${t("player.creatorName")}</label>
      <input id="creator-name" class="creator-name-input" type="text" maxlength="40" value="${escapeHtml(creatorNameBuffer)}" placeholder="${t("player.creatorNamePlaceholder")}" aria-describedby="creator-name-help creator-name-error" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
      <p class="creator-name-error" id="creator-name-error" role="alert" hidden></p>
      <div class="creator-name-actions">
        <button type="button" id="creator-name-cancel" class="chrome-button">${t("player.creatorCancel")}</button>
        <button type="button" id="creator-name-confirm" class="creator-confirm-btn">${t("player.creatorConfirm")}</button>
      </div>
    </div>
  </div>`;
}

function clearCreatorNameError(): void {
  const dialog = document.querySelector<HTMLElement>(".creator-name-dialog");
  const input = dialog?.querySelector<HTMLInputElement>("#creator-name");
  const error = dialog?.querySelector<HTMLElement>("#creator-name-error");
  input?.removeAttribute("aria-invalid");
  if (!error) return;
  error.hidden = true;
  error.textContent = "";
}

function showCreatorNameError(message: string): void {
  const dialog = document.querySelector<HTMLElement>(".creator-name-dialog");
  const input = dialog?.querySelector<HTMLInputElement>("#creator-name");
  const error = dialog?.querySelector<HTMLElement>("#creator-name-error");
  input?.setAttribute("aria-invalid", "true");
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
  input?.focus({ preventScroll: true });
}

/** Inject / refresh name dialog without rebuilding the whole creator (protects typed text). */
function mountCreatorNameDialog(): void {
  if (!creatorNameDialogOpen) return;

  let dialog = document.querySelector<HTMLElement>(".creator-name-dialog");
  if (!dialog) {
    const wrap = document.createElement("div");
    wrap.innerHTML = buildCreatorNameDialogHtml();
    dialog = wrap.firstElementChild as HTMLElement;
    // Body-level portal: the table grid applies position: relative to its direct
    // children, which would otherwise turn this full-screen dialog into a row.
    document.body.append(dialog);
  }
  document.documentElement.classList.add("creator-dialog-open");
  app.setAttribute("inert", "");

  const nameInput = dialog.querySelector<HTMLInputElement>("#creator-name");
  if (nameInput && nameInput.value !== creatorNameBuffer) {
    nameInput.value = creatorNameBuffer;
  }

  // Avoid double-binding if already mounted.
  if (dialog.dataset.bound === "1") {
    nameInput?.focus();
    return;
  }
  dialog.dataset.bound = "1";

  const syncBuffer = () => {
    if (nameInput) creatorNameBuffer = nameInput.value;
    clearCreatorNameError();
  };

  nameInput?.addEventListener("input", syncBuffer);
  nameInput?.addEventListener("change", syncBuffer);
  // Stop global hotkeys (M = mute, Escape = exit) from eating keystrokes while typing.
  nameInput?.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commitCreatorName();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeCreatorNameDialog();
    }
  });

  dialog.querySelector<HTMLButtonElement>("#creator-name-cancel")?.addEventListener("click", () => {
    closeCreatorNameDialog();
  });
  dialog.querySelector<HTMLButtonElement>("#creator-name-confirm")?.addEventListener("click", () => {
    commitCreatorName();
  });

  // Focus without select() — select() on mobile often fights the keyboard and clips input.
  window.setTimeout(() => {
    nameInput?.focus({ preventScroll: true });
  }, 30);
}

function closeCreatorNameDialog(): void {
  creatorNameDialogOpen = false;
  removeCreatorNameDialogLayer();
  // Ephemeral draft from Racetrack “save as strategy” (not the full Bet Creator screen)
  if (creatorDraft && !app.querySelector("#creator-save")) {
    creatorDraft = null;
  }
  playSound("tick");
}

function removeCreatorNameDialogLayer(): void {
  document.querySelector(".creator-name-dialog")?.remove();
  document.documentElement.classList.remove("creator-dialog-open");
  app.removeAttribute("inert");
}

function commitCreatorName(): void {
  if (!playerGame || !creatorDraft) return;
  const nameInput = document.querySelector<HTMLInputElement>(".creator-name-dialog #creator-name");
  const name = (nameInput?.value ?? creatorNameBuffer).trim();
  creatorNameBuffer = name;
  if (creatorDraft) creatorDraft.name = name;
  if (!name) {
    playSound("error");
    showCreatorNameError(t("player.creatorNeedName"));
    return;
  }
  if (!creatorDraft.bets.length) {
    playSound("error");
    showCreatorNameError(t("player.creatorNeedBets"));
    return;
  }
  if (!creatorDraft.editingId && loadBetTemplates().length >= MAX_BET_TEMPLATES) {
    playSound("error");
    showCreatorNameError(t("player.strategyFull", { max: MAX_BET_TEMPLATES }));
    return;
  }
  const saved = upsertBetTemplate({
    id: creatorDraft.editingId,
    name,
    variant: playerGame.variant,
    bets: creatorDraft.bets,
  });
  if (!saved) {
    playSound("error");
    return;
  }
  const fromRacetrack = racetrackOpen;
  creatorDraft = null;
  creatorNameDialogOpen = false;
  creatorNameBuffer = "";
  removeCreatorNameDialogLayer();
  if (fromRacetrack) {
    racetrackOpen = false;
  }
  strategyPanelOpen = true;
  playSound("settle");
  renderPlayerTable();
}

function buildPlayerOutPanel(): string {
  return `<div class="game-over-panel player-out">
    <section>
      <small>${t("player.badge")}</small>
      <h2>${t("player.outTitle")}</h2>
      <div class="game-over-actions">
        <button type="button" id="player-out-menu">${t("player.outMenu")}</button>
      </div>
    </section>
  </div>`;
}

/**
 * Bets to draw on the felt.
 * - BETTING_OPEN / SPINNING: live `bets` only (free spin = empty felt, never ghost last hand).
 * - PAYOUT: after settle, `bets` is cleared — show lastBets only if this hand actually staked.
 */
function feltDisplayBets(state: PlayerGameState): PlacedBet[] {
  if (state.bets.length) return state.bets;
  if (
    state.phase === "PAYOUT"
    && state.lastBets.length
    && (state.lastSettle?.totalStaked ?? 0) > 0
  ) {
    return state.lastBets;
  }
  return [];
}

interface FeltChipMap {
  stakes: Map<string, number>;
  denominations: Map<string, number>;
}

function playerChipMap(bets: PlacedBet[], actions: PlayerChipAction[]): FeltChipMap {
  const stakes = new Map<string, number>();
  for (const bet of bets) {
    stakes.set(bet.betId, (stakes.get(bet.betId) ?? 0) + bet.stake);
  }
  const denominations = new Map<string, number>();
  for (const action of actions) denominations.set(action.betId, action.denomination);
  return { stakes, denominations };
}

/** Digit / label length → chip shell class (circle for 1–500, pill only for huge totals). */
function playerChipSizeClass(label: string): string {
  const n = label.length;
  if (n <= 3) return "chip-sz-s";
  if (n === 4) return "chip-sz-l";
  return "chip-sz-xl";
}

function playerChipAt(betId: string, chips: FeltChipMap): string {
  const stake = chips.stakes.get(betId) ?? 0;
  if (stake <= 0) return "";
  const label = String(stake);
  const size = playerChipSizeClass(label);
  const denomination = chips.denominations.get(betId);
  const denominationClass = denomination ? ` chip-${denomination}` : "";
  return `<span class="chip-stack player-stack" data-stack-bet="${betId}" title="${stake}"><i class="felt-chip player-chip casino-chip ${size}${denominationClass}" title="${stake}">${label}</i></span>`;
}

/** Roulette pocket at player felt grid (col 0..11 left→right, row 0..2 top→bottom). */
function pocketAtColRow(col: number, row: number): number {
  return (col + 1) * 3 - row;
}

function splitBetId(a: number, b: number): string {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return `split_${lo}_${hi}`;
}

/** Catalog corner id for the 2×2 block whose SE hit sits on cell (col,row). */
function cornerBetId(col: number, row: number): string {
  // Value-space street index r and lower street-column c (matches config/_generate-bets.js).
  const r = col + 1;
  const c = 2 - row;
  const cell = (rr: number, cc: number) => (rr - 1) * 3 + cc;
  const p = [cell(r, c), cell(r, c + 1), cell(r + 1, c), cell(r + 1, c + 1)];
  return `corner_${p.join("_")}`;
}

function streetBetId(col: number): string {
  const a = col * 3 + 1;
  return `street_${a}_${a + 1}_${a + 2}`;
}

function sixlineBetId(col: number): string {
  // Between street col and col+1 (col 0..10): sixline_1_6, sixline_4_9, …
  const start = col * 3 + 1;
  const end = (col + 1) * 3 + 3;
  return `sixline_${start}_${end}`;
}

function insideHit(
  betId: string,
  className: string,
  clickAttr: string,
  chips: FeltChipMap,
  title: string,
  options?: { showChip?: boolean },
): string {
  // showChip false: secondary snap/display host for the same betId (avoid duplicate chip stacks).
  const showChip = options?.showChip !== false;
  const chip = showChip ? playerChipAt(betId, chips) : "";
  return `<i class="inside-hit ${className}" ${clickAttr}="${betId}" ${showChip ? `data-chip-host="${betId}"` : ""} role="button" title="${title}" aria-label="${title}">${chip}</i>`;
}

function buildPlayerFelt(variant: TableVariant, result: string | null, bets: PlacedBet[], interactive: boolean, actions: PlayerChipAction[] = []): string {
  const chips = playerChipMap(bets, actions);
  const click = interactive ? "data-bet" : "data-preview";
  // Inside-hit markers remain for chip stacks; pointer-events off in snap mode — placement uses magnetic resolve.
  const numberCells: string[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 12; col += 1) {
      const number = String(pocketAtColRow(col, row));
      const betId = `straight_${number}`;
      const hits: string[] = [];
      if (col < 11) {
        const right = pocketAtColRow(col + 1, row);
        hits.push(insideHit(splitBetId(Number(number), right), "hit-e", click, chips, `split ${number}/${right}`));
      }
      if (row < 2) {
        const down = pocketAtColRow(col, row + 1);
        hits.push(insideHit(splitBetId(Number(number), down), "hit-s", click, chips, `split ${number}/${down}`));
      }
      if (col < 11 && row < 2) {
        hits.push(insideHit(cornerBetId(col, row), "hit-se", click, chips, "corner"));
      }
      if (row === 2) {
        hits.push(insideHit(streetBetId(col), "hit-street", click, chips, `street ${streetBetId(col)}`));
        if (col < 11) {
          hits.push(insideHit(sixlineBetId(col), "hit-six", click, chips, "six line"));
        }
      }
      numberCells.push(
        `<b class="felt-cell ${isRed(number) ? "red" : "black"} ${result === number ? "hit" : ""}" style="--mobile-row:${col + 1};--mobile-col:${3 - row}" ${click}="${betId}" data-chip-host="${betId}" data-col="${col}" data-row="${row}" data-pocket="${number}" role="button" tabindex="0"><span>${number}</span>${playerChipAt(betId, chips)}${hits.join("")}</b>`,
      );
    }
  }
  const zeroHits = (pocket: string) => {
    // Catalog zero-edge splits (see config/_generate-bets.js) — always rendered for chip display.
    if (pocket === "0" && variant === "european") {
      // First four: one chip host only (bottom outer = classic). Top is snap-only ghost.
      return [
        insideHit("split_0_3", "hit-zero hit-zero-top", click, chips, "split 0/3"),
        insideHit("split_0_2", "hit-zero hit-zero-mid", click, chips, "split 0/2"),
        insideHit("split_0_1", "hit-zero hit-zero-bot", click, chips, "split 0/1"),
        insideHit("trio_0_2_3", "hit-zero hit-zero-trio-top", click, chips, "trio 0/2/3"),
        insideHit("trio_0_1_2", "hit-zero hit-zero-trio-bot", click, chips, "trio 0/1/2"),
        insideHit("first_four_0_1_2_3", "hit-zero hit-zero-four hit-zero-four-bot portrait-first-four-target", click, chips, "0-1-2-3"),
        insideHit("first_four_0_1_2_3", "hit-zero hit-zero-four hit-zero-four-top", click, chips, "0-1-2-3", { showChip: false }),
      ].join("");
    }
    if (pocket === "0" && variant === "american") {
      return [
        insideHit("split_0_2", "hit-zero hit-zero-top", click, chips, "split 0/2"),
        insideHit("split_0_1", "hit-zero hit-zero-bot", click, chips, "split 0/1"),
        insideHit("split_0_00", "hit-zero hit-zero-mid", click, chips, "split 0/00"),
        insideHit("trio_0_1_2", "hit-zero hit-zero-trio-bot", click, chips, "trio 0/1/2"),
        insideHit("five_number_0_00_1_2_3", "hit-zero hit-zero-four hit-zero-four-bot", click, chips, "0-00-1-2-3"),
        insideHit("five_number_0_00_1_2_3", "hit-zero hit-zero-four hit-zero-four-top", click, chips, "0-00-1-2-3", { showChip: false }),
      ].join("");
    }
    if (pocket === "00" && variant === "american") {
      // Chip host only on 0 cell for five-number; 00 keeps snap ghost only.
      return [
        insideHit("split_00_3", "hit-zero hit-zero-top", click, chips, "split 00/3"),
        insideHit("split_00_2", "hit-zero hit-zero-mid", click, chips, "split 00/2"),
        insideHit("trio_00_2_3", "hit-zero hit-zero-trio-top", click, chips, "trio 00/2/3"),
        insideHit("five_number_0_00_1_2_3", "hit-zero hit-zero-four hit-zero-four-bot", click, chips, "0-00-1-2-3", { showChip: false }),
      ].join("");
    }
    return "";
  };
  const zeroCells = variant === "american"
    ? `<b class="green ${result === "0" ? "hit" : ""}" ${click}="straight_0" data-chip-host="straight_0" data-zero="0" role="button" tabindex="0"><span>0</span>${playerChipAt("straight_0", chips)}${zeroHits("0")}</b><b class="green ${result === "00" ? "hit" : ""}" ${click}="straight_00" data-chip-host="straight_00" data-zero="00" role="button" tabindex="0"><span>00</span>${playerChipAt("straight_00", chips)}${zeroHits("00")}</b>`
    : `<b class="green ${result === "0" ? "hit" : ""}" ${click}="straight_0" data-chip-host="straight_0" data-zero="0" role="button" tabindex="0"><span>0</span>${playerChipAt("straight_0", chips)}${zeroHits("0")}</b>`;
  const outside = (id: string, label: string, extraClass = "") =>
    `<span class="${extraClass}" ${click}="${id}" data-chip-host="${id}" role="button" tabindex="0">${label}${playerChipAt(id, chips)}</span>`;
  return `<div class="zero-zone">${zeroCells}</div>
    <div class="numbers player-numbers">${numberCells.join("")}</div>
    <div class="column-pays">${outside("column3", "2 TO 1")}${outside("column2", "2 TO 1")}${outside("column1", "2 TO 1")}</div>
    <div class="dozens">${outside("dozen1", "1ST 12")}${outside("dozen2", "2ND 12")}${outside("dozen3", "3RD 12")}</div>
    <div class="even-money">${outside("low", "1 TO 18")}${outside("even", "EVEN")}${outside("red", "RED", "red-label")}${outside("black", "BLACK", "black-label")}${outside("odd", "ODD")}${outside("high", "19 TO 36")}</div>`;
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
  const target = event.target as HTMLElement | null;
  const typing =
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target?.isContentEditable;
  if (typing) return;
  if (creatorNameDialogOpen) return;
  if (event.code === "Escape") {
    if (soundPanelOpen && playerGame) {
      soundPanelOpen = false;
      renderPlayerTable();
      return;
    }
    if (playerChipMenuOpen && playerGame) {
      playerChipMenuOpen = false;
      renderPlayerTable();
      return;
    }
    if (playerMenuOpen && playerGame) {
      playerMenuOpen = false;
      playSound("tick");
      renderPlayerTable();
      return;
    }
    if (statsPanelOpen && playerGame) {
      statsPanelOpen = false;
      playSound("tick");
      renderPlayerTable();
      return;
    }
    if (racetrackOpen && playerGame) {
      racetrackOpen = false;
      playSound("tick");
      renderPlayerTable();
      return;
    }
    if (strategyPanelOpen && playerGame) {
      strategyPanelOpen = false;
      playSound("tick");
      renderPlayerTable();
      return;
    }
    if (playerGame) showPlayerExitConfirm();
    return;
  }
  if (event.code === "KeyM") {
    toggleMute();
    if (playerGame) renderPlayerTable();
  }
});

// Skip service worker on third-party hosts (itch.io embed) — avoids bad cache / path issues.
if (
  "serviceWorker" in navigator
  && import.meta.env.PROD
  && !/\.itch\.(io|zone)$/i.test(location.hostname)
  && !/itch\.zone$/i.test(location.hostname)
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL("./sw.js", document.baseURI || document.URL)).catch(() => {});
  });
}

showMenu();
