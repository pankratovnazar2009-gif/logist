"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Состояние загрузки данных — взаимоисключающие варианты вместо набора флагов isLoading/isError. */
export type AsyncState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "success"; data: T };

/**
 * Загружает данные при монтировании и при смене `deps`; `reload` перезапрашивает, не сбрасывая экран на «загрузку».
 * Пока `enabled` = false (например, ждём пользователя из контекста), запрос не выполняется.
 * Устаревший ответ (после смены `deps` или размонтирования) отбрасывается.
 */
export function useAsync<T>(load: () => Promise<T>, errorMessage: string, deps: readonly (string | undefined)[], enabled = true) {
  const key = deps.join("|");
  const [result, setResult] = useState<{ key: string; state: AsyncState<T> } | null>(null);
  const [tick, setTick] = useState(0);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!enabled) return;
    let stale = false;
    loadRef
      .current()
      .then((data) => !stale && setResult({ key, state: { status: "success", data } }))
      .catch(() => !stale && setResult({ key, state: { status: "error", message: errorMessage } }));
    return () => {
      stale = true;
    };
  }, [enabled, key, tick, errorMessage]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  // Результат другого ключа (например, прошлого :id) не показываем — для нового ключа это снова «загрузка».
  const state: AsyncState<T> = result && result.key === key ? result.state : { status: "loading" };
  return { state, reload };
}
