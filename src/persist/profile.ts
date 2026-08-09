import type { GameMode } from "../core/types.ts";
import balanceConfig from "../../config/game-balance.json" with { type: "json" };

export const STARTER_SCORE = Math.max(0, Math.floor(balanceConfig.playerMode.starterScore));

export interface UserProfile {
  schemaVersion: 2;
  walletUnits: number;
  committedDealerRuns: string[];
  /** Best Dealer Service Score ever added to Accumulated Score or reached at Game Over. */
  bestServiceScore: number;
  /** Prevents the onboarding grant from becoming a repeatable refill after Player losses. */
  starterScoreGranted: true;
}

export interface DealerRunCredit {
  runId: string;
  mode: GameMode;
  serviceScore: number;
}

export interface WalletCommitResult {
  profile: UserProfile;
  earnedUnits: number;
  committed: boolean;
}

export function createEmptyProfile(): UserProfile {
  return {
    schemaVersion: 2,
    walletUnits: STARTER_SCORE,
    committedDealerRuns: [],
    bestServiceScore: 0,
    starterScoreGranted: true,
  };
}

export const PROFILE_STORAGE_KEY = "bitcroupier.profile.v1";

export function normalizeUserProfile(raw: unknown): UserProfile {
  const value = raw as {
    schemaVersion?: number;
    walletUnits?: unknown;
    committedDealerRuns?: unknown;
    bestServiceScore?: unknown;
    starterScoreGranted?: unknown;
  } | null;
  if (
    !value
    || (value.schemaVersion !== 1 && value.schemaVersion !== 2)
    || typeof value.walletUnits !== "number"
    || !Array.isArray(value.committedDealerRuns)
  ) {
    return createEmptyProfile();
  }
  const savedScore = Math.max(0, Math.floor(value.walletUnits));
  const alreadyGranted = value.schemaVersion === 2 && value.starterScoreGranted === true;
  return {
    schemaVersion: 2,
    walletUnits: !alreadyGranted && savedScore === 0 ? STARTER_SCORE : savedScore,
    committedDealerRuns: value.committedDealerRuns.filter((item): item is string => typeof item === "string"),
    bestServiceScore: Math.max(0, Math.floor(typeof value.bestServiceScore === "number" ? value.bestServiceScore : 0)),
    starterScoreGranted: true,
  };
}

export function loadUserProfile(): UserProfile {
  if (typeof localStorage === "undefined") return createEmptyProfile();
  try {
    const profile = normalizeUserProfile(JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) ?? "null"));
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    return profile;
  } catch {
    return createEmptyProfile();
  }
}

export function saveUserProfile(profile: UserProfile): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export function commitDealerRun(profile: UserProfile, run: DealerRunCredit, unitsPerPoint = 1): WalletCommitResult {
  if (run.mode !== "dealer" || profile.committedDealerRuns.includes(run.runId)) {
    return { profile, earnedUnits: 0, committed: false };
  }
  const earnedUnits = Math.max(0, Math.floor(run.serviceScore * unitsPerPoint));
  const score = Math.max(0, Math.floor(run.serviceScore));
  return {
    profile: {
      ...profile,
      walletUnits: profile.walletUnits + earnedUnits,
      committedDealerRuns: [...profile.committedDealerRuns, run.runId],
      bestServiceScore: Math.max(profile.bestServiceScore, score),
    },
    earnedUnits,
    committed: true,
  };
}

/** Update local high score without changing Accumulated Score (e.g. mid-run peak optional). */
export function noteBestScore(profile: UserProfile, serviceScore: number): UserProfile {
  const score = Math.max(0, Math.floor(serviceScore));
  if (score <= profile.bestServiceScore) return profile;
  return { ...profile, bestServiceScore: score };
}

/** Debit Accumulated Score (Player Porta punti). Returns null if insufficient. */
export function spendFromAccumulated(profile: UserProfile, amount: number): UserProfile | null {
  const value = Math.max(0, Math.floor(amount));
  if (value <= 0 || profile.walletUnits < value) return null;
  return { ...profile, walletUnits: profile.walletUnits - value };
}

/** Credit Accumulated Score (Player Ritira punti). */
export function creditAccumulated(profile: UserProfile, amount: number): UserProfile {
  const value = Math.max(0, Math.floor(amount));
  if (value === 0) return profile;
  return { ...profile, walletUnits: profile.walletUnits + value };
}
