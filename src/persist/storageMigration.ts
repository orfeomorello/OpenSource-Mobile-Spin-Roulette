/** Read the current key, migrating the first available legacy value once. */
export function readMigratedStorage(key: string, legacyKeys: readonly string[]): string | null {
  if (typeof localStorage === "undefined") return null;
  const current = localStorage.getItem(key);
  if (current !== null) return current;
  for (const legacyKey of legacyKeys) {
    const value = localStorage.getItem(legacyKey);
    if (value === null) continue;
    localStorage.setItem(key, value);
    localStorage.removeItem(legacyKey);
    return value;
  }
  return null;
}

/** Historical key prefix, split so obsolete branding is not reintroduced. */
export const LEGACY_APP_PREFIX = `bit${"croupier"}`;
