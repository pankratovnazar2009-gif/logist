"use client";

import { api } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { AsyncView } from "./async-view";
import { MatchCard } from "./match-card";

/** Список пар одного груза или одного предложения. */
export function MatchesSection({ scope, emptyText }: { scope: { load?: string; offer?: string }; emptyText: string }) {
  const { state, reload } = useAsync(async () => (await api.listMatches(scope)).matches, "Nie udało się pobrać dopasowań.", [scope.load, scope.offer]);

  return (
    <section aria-labelledby="matches-heading" className="flex flex-col gap-3">
      <h2 id="matches-heading" className="font-[family-name:var(--font-display)] text-lg font-bold">
        Dopasowania
      </h2>
      <AsyncView state={state} onRetry={reload} isEmpty={(matches) => matches.length === 0} empty={emptyText}>
        {(matches) => (
          <div className="flex flex-col gap-3">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </AsyncView>
    </section>
  );
}
