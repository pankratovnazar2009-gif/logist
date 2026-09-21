import type { AsyncState } from "@/lib/use-async";

interface AsyncViewProps<T> {
  state: AsyncState<T>;
  /** Когда данные загружены, но показывать нечего. */
  isEmpty?: (data: T) => boolean;
  empty: React.ReactNode;
  children: (data: T) => React.ReactNode;
  onRetry?: () => void;
}

/** Единое место для четырёх состояний экрана: загрузка, ошибка (с повтором), пусто, данные. */
export function AsyncView<T>({ state, isEmpty, empty, children, onRetry }: AsyncViewProps<T>) {
  if (state.status === "loading") {
    return (
      <p role="status" className="text-[var(--color-text-muted)]">
        Ładowanie…
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="card flex flex-col items-start gap-3" style={{ borderColor: "var(--color-danger)" }}>
        <p style={{ color: "var(--color-danger)" }}>{state.message}</p>
        {onRetry && (
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            Spróbuj ponownie
          </button>
        )}
      </div>
    );
  }
  if (isEmpty?.(state.data)) return <div className="card text-[var(--color-text-muted)]">{empty}</div>;
  return <>{children(state.data)}</>;
}
