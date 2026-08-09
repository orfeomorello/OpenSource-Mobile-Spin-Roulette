import type { Locale } from "../core/types.ts";

export interface LocaleMeta {
  id: Locale;
  /** Short pill label (home). */
  short: string;
  /** Native name for Settings. */
  native: string;
  /** BCP-47 tag for Intl.NumberFormat / document.lang. */
  bcp47: string;
}

/** All UI locales in display order. */
export const LOCALE_META: readonly LocaleMeta[] = [
  { id: "en", short: "EN", native: "English", bcp47: "en-US" },
  { id: "it", short: "IT", native: "Italiano", bcp47: "it-IT" },
  { id: "es", short: "ES", native: "Español", bcp47: "es-ES" },
  { id: "pt-BR", short: "PT", native: "Português (BR)", bcp47: "pt-BR" },
  { id: "fr", short: "FR", native: "Français", bcp47: "fr-FR" },
  { id: "de", short: "DE", native: "Deutsch", bcp47: "de-DE" },
  { id: "ko", short: "KO", native: "한국어", bcp47: "ko-KR" },
  { id: "ja", short: "JA", native: "日本語", bcp47: "ja-JP" },
  { id: "zh", short: "ZH", native: "中文", bcp47: "zh-CN" },
] as const;

export const LOCALE_IDS: readonly Locale[] = LOCALE_META.map((m) => m.id);

const LOCALE_SET = new Set<string>(LOCALE_IDS);

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALE_SET.has(value);
}

export function localeMeta(id: Locale): LocaleMeta {
  return LOCALE_META.find((m) => m.id === id) ?? LOCALE_META[0]!;
}

export function numberFormatTag(locale: Locale): string {
  return localeMeta(locale).bcp47;
}
