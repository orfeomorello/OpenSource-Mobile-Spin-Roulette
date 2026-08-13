import type { SessionSnapshot } from "../core/types.ts";
import { LEGACY_APP_PREFIX, readMigratedStorage } from "./storageMigration.ts";

export const SESSION_STORAGE_KEY = "mobilespinroulette.session.v3";

export function readStoredSession(): SessionSnapshot | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const stored = readMigratedStorage(SESSION_STORAGE_KEY, [`${LEGACY_APP_PREFIX}.session.v3`]);
    const raw = JSON.parse(stored ?? "null") as unknown;
    if (!raw || typeof raw !== "object") return null;
    const data = raw as Partial<SessionSnapshot>;
    if (data.schemaVersion !== 5 || data.mode !== "player") return null;
    if (typeof data.runId !== "string") return null;
    return data as SessionSnapshot;
  } catch {
    return null;
  }
}

export function writeStoredSession(snapshot: SessionSnapshot): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearStoredSession(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(SESSION_STORAGE_KEY);
}
