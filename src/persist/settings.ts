import type { Locale, TableVariant } from "../core/types.ts";
import controlsConfig from "../../config/controls.json" with { type: "json" };
import { LEGACY_APP_PREFIX, readMigratedStorage } from "./storageMigration.ts";

export type DifficultyPresetId = "training" | "standard" | "busy" | "rush";
export type PlayerMusicMode =
  | "random"
  | "bossa-nova-jazz"
  | "bossa-nova-lounge"
  | "bossa-nova-restaurant"
  | "cooking-music"
  | "elevator-jazz"
  | "hotel-cafe-restaurant";

/**
 * Home background animation id — must match
 * `config/controls.json` → `homePresentation.backgroundAnimationOptions`.
 */
export type BackgroundAnimationId =
  | "none"
  | "recommended"
  | "c64_parallax";

/** Global prefs (home Settings). Locale stays in i18n storage; mirrored on change. */
export interface AppSettings {
  schemaVersion: 1;
  defaultTableVariant: TableVariant;
  animationEnabled: boolean;
  muted: boolean;
  /** Music BGM level 0–1 (independent of master mute). */
  musicVolume: number;
  /** Player table music: shuffle bundled tracks or loop one selection. */
  playerMusicMode: PlayerMusicMode;
  /** Home screen motion (see controls.json homePresentation). */
  backgroundAnimation: BackgroundAnimationId;
  defaultPresetId: DifficultyPresetId;
}

export const SETTINGS_STORAGE_KEY = "mobilespinroulette.settings.v1";

const PRESET_IDS: DifficultyPresetId[] = ["training", "standard", "busy", "rush"];
const PLAYER_MUSIC_MODES: PlayerMusicMode[] = [
  "random",
  "bossa-nova-jazz",
  "bossa-nova-lounge",
  "bossa-nova-restaurant",
  "cooking-music",
  "elevator-jazz",
  "hotel-cafe-restaurant",
];

/** Default music slider position (50%). */
export const DEFAULT_MUSIC_VOLUME = 0.5;

const homePresentation = (controlsConfig as {
  homePresentation?: {
    backgroundAnimationDefault?: string;
    backgroundAnimationOptions?: string[];
  };
}).homePresentation;

export const BACKGROUND_ANIMATION_OPTIONS: readonly BackgroundAnimationId[] = (
  homePresentation?.backgroundAnimationOptions ?? ["none"]
).filter((id): id is BackgroundAnimationId => typeof id === "string") as BackgroundAnimationId[];

export const DEFAULT_BACKGROUND_ANIMATION: BackgroundAnimationId = asBackgroundAnimation(
  homePresentation?.backgroundAnimationDefault,
);

export function createDefaultSettings(): AppSettings {
  return {
    schemaVersion: 1,
    defaultTableVariant: "european",
    animationEnabled: true,
    muted: false,
    musicVolume: DEFAULT_MUSIC_VOLUME,
    playerMusicMode: "random",
    backgroundAnimation: DEFAULT_BACKGROUND_ANIMATION,
    defaultPresetId: "standard",
  };
}

function asMusicVolume(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_MUSIC_VOLUME;
  return Math.min(1, Math.max(0, value));
}

function asPlayerMusicMode(value: unknown): PlayerMusicMode {
  return PLAYER_MUSIC_MODES.includes(value as PlayerMusicMode) ? (value as PlayerMusicMode) : "random";
}

function asVariant(value: unknown): TableVariant {
  return value === "american" ? "american" : "european";
}

function asPreset(value: unknown): DifficultyPresetId {
  return PRESET_IDS.includes(value as DifficultyPresetId) ? (value as DifficultyPresetId) : "standard";
}

export function asBackgroundAnimation(value: unknown): BackgroundAnimationId {
  const fallback: BackgroundAnimationId =
    BACKGROUND_ANIMATION_OPTIONS.includes("none") ? "none" : (BACKGROUND_ANIMATION_OPTIONS[0] ?? "none");
  if (typeof value !== "string") return fallback;
  return BACKGROUND_ANIMATION_OPTIONS.includes(value as BackgroundAnimationId)
    ? (value as BackgroundAnimationId)
    : fallback;
}

export function loadSettings(): AppSettings {
  if (typeof localStorage === "undefined") return createDefaultSettings();
  try {
    const stored = readMigratedStorage(SETTINGS_STORAGE_KEY, [`${LEGACY_APP_PREFIX}.settings.v1`]);
    const raw = JSON.parse(stored ?? "null") as Partial<AppSettings> | null;
    if (!raw || raw.schemaVersion !== 1) return createDefaultSettings();
    return {
      schemaVersion: 1,
      defaultTableVariant: asVariant(raw.defaultTableVariant),
      animationEnabled: raw.animationEnabled !== false,
      muted: raw.muted === true,
      musicVolume: asMusicVolume(raw.musicVolume),
      playerMusicMode: asPlayerMusicMode(raw.playerMusicMode),
      backgroundAnimation: asBackgroundAnimation(raw.backgroundAnimation),
      defaultPresetId: asPreset(raw.defaultPresetId),
    };
  } catch {
    return createDefaultSettings();
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function updateSettings(patch: Partial<Omit<AppSettings, "schemaVersion">>): AppSettings {
  const next: AppSettings = { ...loadSettings(), ...patch, schemaVersion: 1 };
  saveSettings(next);
  return next;
}

/** Full local backup (profile + settings + optional session + locale). */
export interface DataExportBundle {
  schemaVersion: 1;
  exportedAt: string;
  locale: Locale | null;
  settings: AppSettings;
  profile: unknown;
  session: unknown;
}

export function buildDataExport(locale: Locale | null, profile: unknown, session: unknown): DataExportBundle {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    locale,
    settings: loadSettings(),
    profile,
    session,
  };
}
