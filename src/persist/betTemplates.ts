import type { PlacedBet, TableVariant } from "../core/types.ts";

/** Saved bet layout / strategy (live-roulette style favourite bets). */
export interface BetTemplate {
  id: string;
  name: string;
  variant: TableVariant;
  bets: PlacedBet[];
  createdAt: string;
  updatedAt: string;
}

export const BET_TEMPLATES_STORAGE_KEY = "bitcroupier.betTemplates.v1";
export const MAX_BET_TEMPLATES = 24;

export function templateTotal(bets: PlacedBet[]): number {
  return bets.reduce((sum, bet) => sum + Math.max(0, Math.floor(bet.stake)), 0);
}

export function loadBetTemplates(): BetTemplate[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(BET_TEMPLATES_STORAGE_KEY) ?? "null") as unknown;
    if (!raw || typeof raw !== "object") return [];
    const list = (raw as { templates?: unknown }).templates;
    if (!Array.isArray(list)) return [];
    return list
      .map(normalizeTemplate)
      .filter((item): item is BetTemplate => item !== null)
      .slice(0, MAX_BET_TEMPLATES);
  } catch {
    return [];
  }
}

export function saveBetTemplates(templates: BetTemplate[]): void {
  if (typeof localStorage === "undefined") return;
  const clean = templates
    .map(normalizeTemplate)
    .filter((item): item is BetTemplate => item !== null)
    .slice(0, MAX_BET_TEMPLATES);
  localStorage.setItem(BET_TEMPLATES_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, templates: clean }));
}

export function upsertBetTemplate(input: {
  id?: string | null;
  name: string;
  variant: TableVariant;
  bets: PlacedBet[];
}): BetTemplate | null {
  const name = input.name.trim().slice(0, 40);
  const bets = sanitizeBets(input.bets);
  if (!name || !bets.length) return null;
  const now = new Date().toISOString();
  const all = loadBetTemplates();
  const existingIndex = input.id ? all.findIndex((t) => t.id === input.id) : -1;
  if (existingIndex >= 0) {
    const next: BetTemplate = {
      ...all[existingIndex],
      name,
      variant: input.variant === "american" ? "american" : "european",
      bets,
      updatedAt: now,
    };
    all[existingIndex] = next;
    saveBetTemplates(all);
    return next;
  }
  if (all.length >= MAX_BET_TEMPLATES) return null;
  const created: BetTemplate = {
    id: `bt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    variant: input.variant === "american" ? "american" : "european",
    bets,
    createdAt: now,
    updatedAt: now,
  };
  saveBetTemplates([created, ...all]);
  return created;
}

export function deleteBetTemplate(id: string): boolean {
  const all = loadBetTemplates();
  const next = all.filter((t) => t.id !== id);
  if (next.length === all.length) return false;
  saveBetTemplates(next);
  return true;
}

export function getBetTemplate(id: string): BetTemplate | null {
  return loadBetTemplates().find((t) => t.id === id) ?? null;
}

function sanitizeBets(bets: PlacedBet[]): PlacedBet[] {
  const merged = new Map<string, number>();
  for (const bet of bets) {
    if (!bet || typeof bet.betId !== "string" || !bet.betId) continue;
    const stake = Math.floor(Number(bet.stake));
    if (stake <= 0) continue;
    merged.set(bet.betId, (merged.get(bet.betId) ?? 0) + stake);
  }
  return [...merged.entries()].map(([betId, stake]) => ({ betId, stake }));
}

function normalizeTemplate(raw: unknown): BetTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Partial<BetTemplate>;
  if (typeof t.id !== "string" || !t.id) return null;
  if (typeof t.name !== "string" || !t.name.trim()) return null;
  const bets = sanitizeBets(Array.isArray(t.bets) ? t.bets : []);
  if (!bets.length) return null;
  return {
    id: t.id,
    name: t.name.trim().slice(0, 40),
    variant: t.variant === "american" ? "american" : "european",
    bets,
    createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
    updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : new Date().toISOString(),
  };
}
