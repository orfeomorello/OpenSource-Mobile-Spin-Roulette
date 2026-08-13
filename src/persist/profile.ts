import balanceConfig from "../../config/game-balance.json" with { type: "json" };
import { LEGACY_APP_PREFIX, readMigratedStorage } from "./storageMigration.ts";

export const STARTER_SCORE = Math.max(0, Math.floor(balanceConfig.playerMode.starterScore));

export interface UserProfile {
  schemaVersion: 2;
  walletUnits: number;
  /** Prevents the onboarding grant from becoming a repeatable refill after Player losses. */
  starterScoreGranted: true;
}

export function createEmptyProfile(): UserProfile {
  return {
    schemaVersion: 2,
    walletUnits: STARTER_SCORE,
    starterScoreGranted: true,
  };
}

export const PROFILE_STORAGE_KEY = "mobilespinroulette.profile.v1";

export function normalizeUserProfile(raw: unknown): UserProfile {
  const value = raw as {
    schemaVersion?: number;
    walletUnits?: unknown;
    starterScoreGranted?: unknown;
  } | null;
  if (
    !value
    || (value.schemaVersion !== 1 && value.schemaVersion !== 2)
    || typeof value.walletUnits !== "number"
  ) {
    return createEmptyProfile();
  }
  const savedScore = Math.max(0, Math.floor(value.walletUnits));
  const alreadyGranted = value.schemaVersion === 2 && value.starterScoreGranted === true;
  return {
    schemaVersion: 2,
    walletUnits: !alreadyGranted && savedScore === 0 ? STARTER_SCORE : savedScore,
    starterScoreGranted: true,
  };
}

export function loadUserProfile(): UserProfile {
  if (typeof localStorage === "undefined") return createEmptyProfile();
  try {
    const stored = readMigratedStorage(PROFILE_STORAGE_KEY, [
      `open-source-mobile-${"spin-roulette"}.profile.v1`,
      `${LEGACY_APP_PREFIX}.profile.v1`,
    ]);
    const profile = normalizeUserProfile(JSON.parse(stored ?? "null"));
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    return profile;
  } catch {
    return createEmptyProfile();
  }
}

export function saveUserProfile(profile: UserProfile): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

/** Start-button safety net: a fully depleted score begins a fresh starter bankroll. */
export function refillEmptyProfile(profile: UserProfile): UserProfile {
  if (profile.walletUnits > 0) return profile;
  return { ...profile, walletUnits: STARTER_SCORE };
}

/** Explicit restart: restore the configured starter score. Strategies and settings are unrelated. */
export function restoreStarterBankroll(profile: UserProfile): UserProfile {
  return { ...profile, walletUnits: STARTER_SCORE, starterScoreGranted: true };
}
