"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/provider";
import type { MatchView } from "@/lib/types";

type State = { status: "asking" } | { status: "saving"; outcome: "completed" | "failed" } | { status: "error" } | { status: "done"; outcome: "completed" | "failed" };

/**
 * «Состоялась ли перевозка?» — появляется на подтверждённой паре, пока результат не отмечен. Ответ строит
 * базу проверенных перевозчиков (см. README): кто, куда, каким кузовом реально возит.
 */
export function MatchOutcome({ match, onChange }: { match: MatchView; onChange: (match: MatchView) => void }) {
  const { m } = useI18n();
  const [state, setState] = useState<State>({ status: "asking" });
  if (!match.canReportOutcome && state.status !== "done") return null;

  async function report(outcome: "completed" | "failed") {
    setState({ status: "saving", outcome });
    try {
      onChange((await api.reportOutcome(match.id, outcome)).match);
      setState({ status: "done", outcome });
    } catch {
      setState({ status: "error" });
    }
  }

  return (
    <div className="card flex flex-col gap-3">
      {state.status === "done" ? (
        <p className="text-sm" style={{ color: "var(--color-success)" }}>
          {state.outcome === "completed" ? m.match.outcome.thanksCompleted : m.match.outcome.thanksFailed}
        </p>
      ) : (
        <>
          <p className="field-label">{m.match.outcome.question}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" disabled={state.status === "saving"} onClick={() => report("completed")}>
              {state.status === "saving" && state.outcome === "completed" ? m.common.working : m.match.outcome.completed}
            </button>
            <button type="button" className="btn btn-secondary" disabled={state.status === "saving"} onClick={() => report("failed")}>
              {state.status === "saving" && state.outcome === "failed" ? m.common.working : m.match.outcome.failed}
            </button>
          </div>
          {state.status === "error" && (
            <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>
              {m.match.outcome.error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
