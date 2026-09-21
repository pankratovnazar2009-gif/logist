"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, detectLocale, isLocale, type Locale } from "./locales";
import { getMessages, type Messages } from "./messages";

const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback); // выбор в другой вкладке
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

/** Сохранённый выбор → язык браузера → польский. Вне браузера (сервер, первая отрисовка гидратации) — польский. */
function readLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // localStorage может быть закрыт (приватный режим) — тогда идём по языку браузера
  }
  return detectLocale(window.navigator.languages ?? [window.navigator.language]);
}

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  m: Messages;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, readLocale, () => DEFAULT_LOCALE);

  const setLocale = useCallback((next: Locale) => {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // без localStorage выбор действует до перезагрузки
    }
    listeners.forEach((listener) => listener());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nValue>(() => ({ locale, setLocale, m: getMessages(locale) }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
