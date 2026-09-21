"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "pozna_theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const isPreference = (value: unknown): value is ThemePreference => value === "system" || value === "light" || value === "dark";

/**
 * Ставит тему до первой отрисовки, чтобы тёмная тема не мигала белым. Выполняется инлайн в <head>, поэтому
 * не использует ничего, кроме браузера. Логика та же, что в ThemeProvider: выбор пользователя, иначе системная тема.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var d=p==='dark'||(p!=='light'&&window.matchMedia('${DARK_QUERY}').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;

const listeners = new Set<() => void>();

function subscribePreference(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isPreference(stored)) return stored;
  } catch {
    // localStorage закрыт — остаёмся на системной теме
  }
  return "system";
}

function subscribeSystem(callback: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

interface ThemeValue {
  preference: ThemePreference;
  effective: EffectiveTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useSyncExternalStore(subscribePreference, readPreference, () => "system" as const);
  const systemDark = useSyncExternalStore(subscribeSystem, () => window.matchMedia(DARK_QUERY).matches, () => false);
  const effective: EffectiveTheme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // без localStorage выбор действует до перезагрузки
    }
    listeners.forEach((listener) => listener());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = effective;
  }, [effective]);

  const value = useMemo<ThemeValue>(() => ({ preference, effective, setPreference }), [preference, effective, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
