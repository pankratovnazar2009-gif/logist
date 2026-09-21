"use client";

import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { MatchAction } from "@/lib/match-state";
import type { MatchView } from "@/lib/types";

const ERROR_TEXT: Record<string, string> = {
  closed: "Ta para jest już zamknięta — ktoś był szybszy albo ogłoszenie wygasło.",
  invalid_state: "Stan się zmienił. Odświeżyłem widok.",
  forbidden: "Brak dostępu do tego dopasowania.",
};

function labelFor(action: MatchAction, match: MatchView): string {
  if (action === "request") return "Poproś o kontakt";
  if (action === "confirm") return "Potwierdź i odblokuj kontakt";
  if (match.state.status === "requested" && match.state.by === match.viewer) return "Wycofaj prośbę";
  return match.state.status === "requested" ? "Odrzuć" : "Nie pasuje";
}

interface Props {
  match: MatchView;
  /** Вызывается с обновлённым состоянием пары после успешного действия. */
  onChange: (match: MatchView) => void;
  /** Вызывается, когда сервер сообщил, что состояние устарело — родитель должен перечитать пару. */
  onStale: () => void;
}

/** Кнопки действий. Пока запрос идёт, все кнопки заблокированы — двойной клик не отправит действие дважды. */
export function MatchActions({ match, onChange, onStale }: Props) {
  const [pending, setPending] = useState<MatchAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (match.actions.length === 0) return null;

  async function run(action: MatchAction) {
    setPending(action);
    setError(null);
    try {
      onChange((await api.matchAction(match.id, action)).match);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "unknown";
      setError(ERROR_TEXT[code] ?? "Nie udało się wykonać akcji. Spróbuj ponownie.");
      if (code === "closed" || code === "invalid_state") onStale();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {match.actions.map((action) => (
          <button
            key={action}
            type="button"
            className={action === "decline" ? "btn btn-ghost" : "btn btn-primary"}
            disabled={pending !== null}
            onClick={() => run(action)}
          >
            {pending === action ? "Chwila…" : labelFor(action, match)}
          </button>
        ))}
      </div>
      <p role="alert" className="text-sm min-h-5" style={{ color: "var(--color-danger)" }}>
        {error}
      </p>
    </div>
  );
}
