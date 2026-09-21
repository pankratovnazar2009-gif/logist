"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { formatDate, routeText, truckLabel } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import { useRoleGuard } from "@/lib/use-role-guard";
import type { LoadWithCount } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { AsyncView } from "@/components/async-view";
import { MatchCountBadge, StatusBadge, isLive, useNow } from "@/components/status-badge";

export default function LoadsPage() {
  const user = useRoleGuard("logist");
  const { state, reload } = useAsync(async () => (await api.listLoads()).loads, "Nie udało się pobrać listy ładunków.", [], Boolean(user));
  if (!user) return null;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">Twoje ładunki</h1>
        <Link href="/loads/new" className="btn btn-primary">
          + Dodaj ładunek
        </Link>
      </div>

      <AsyncView
        state={state}
        onRetry={reload}
        isEmpty={(loads) => loads.length === 0}
        empty="Nie masz jeszcze żadnych ładunków. Dodaj pierwszy — od razu pokażemy pasujących przewoźników."
      >
        {(loads) => (
          <div className="flex flex-col gap-3">
            {loads.map((load) => (
              <LoadCard key={load.id} load={load} />
            ))}
          </div>
        )}
      </AsyncView>
    </AppShell>
  );
}

function LoadCard({ load }: { load: LoadWithCount }) {
  const now = useNow();
  return (
    <Link href={`/loads/${load.id}`} className="card flex items-center justify-between gap-4 hover:border-[var(--color-accent)]">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="font-semibold truncate">{routeText(load)}</div>
        <div className="flex flex-wrap gap-x-3 text-sm text-[var(--color-text-muted)] mono">
          <span>załadunek {formatDate(load.pickup_date)}</span>
          {load.truck_required && <span>{truckLabel(load.truck_required)}</span>}
          {load.weight_kg && <span>{load.weight_kg} kg</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <StatusBadge status={load.status} expiresAt={load.expires_at} />
        {isLive(load.status, load.expires_at, now) && <MatchCountBadge count={load.match_count} />}
      </div>
    </Link>
  );
}
