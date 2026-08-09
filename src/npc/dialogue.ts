import type { Locale } from "../core/types.ts";
import type { NpcIntentKey } from "./behavior.ts";

export interface NpcDialogueContext {
  name: string;
}

export interface NpcDialogueProvider {
  resolve(intent: NpcIntentKey, locale: Locale, context: NpcDialogueContext): string | null | Promise<string | null>;
}

export class AuthoredNpcDialogueProvider implements NpcDialogueProvider {
  constructor(private readonly translate: (key: string, variables?: Record<string, string | number>) => string) {}

  resolve(intent: NpcIntentKey, _locale: Locale, context: NpcDialogueContext): string {
    return this.translate(`npc.${intent}`, { name: context.name });
  }
}
