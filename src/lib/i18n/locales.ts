/** Языки интерфейса. Подпись — на самом языке, чтобы её мог найти человек, не понимающий текущий. */
export const LOCALES = [
  { value: "pl", label: "Polski" },
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
  { value: "uk", label: "Українська" },
] as const;

export type Locale = (typeof LOCALES)[number]["value"];

export const DEFAULT_LOCALE: Locale = "pl";
export const LOCALE_STORAGE_KEY = "pozna_locale";

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale.value === value);
}

/** Первый язык браузера, который мы поддерживаем («ru-RU» → «ru»); иначе — польский. */
export function detectLocale(browserLanguages: readonly string[]): Locale {
  for (const language of browserLanguages) {
    const primary = language.toLowerCase().split("-")[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}
