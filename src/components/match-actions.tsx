"use client";

import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/provider";
import type { Messages } from "@/lib/i18n/messages";
import type { MatchAction } from "@/lib/match-state";
import type { MatchView } from "@/lib/types";

function labelFor(action: MatchAction, match: MatchView, m: Messages): string {
  if (action === "request") return m.match.actions.request;
  if (action === "confirm") return m.match.actions.confirm;
  if (action === "take") return m.match.actions.take;
  if (match.state.status === "requested" && match.state.by === match.viewer) return m.match.actions.withdraw;
  return match.state.status === "requested" ? m.match.actions.reject : m.match.actions.notFit;
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
  const { m } = useI18n();
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
      const known = m.match.actionErrors;
      setError(code === "closed" || code === "invalid_state" || code === "forbidden" ? known[code] : known.generic);
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
            {pending === action ? m.common.working : labelFor(action, match, m)}
          </button>
        ))}
      </div>
      <p role="alert" className="text-sm min-h-5" style={{ color: "var(--color-danger)" }}>
        {error}
      </p>
    </div>
  );
}
