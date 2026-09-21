"use client";

import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatDate, routeText, truckLabel } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import { useRoleGuard } from "@/lib/use-role-guard";
import { AppShell } from "@/components/app-shell";
import { AsyncView } from "@/components/async-view";
import { CancelButton } from "@/components/cancel-button";
import { MatchesSection } from "@/components/matches-section";
import { StatusBadge, isLive, useNow } from "@/components/status-badge";

export default function LoadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useRoleGuard("logist");
  const router = useRouter();
  const now = useNow();
  const { state, reload } = useAsync(async () => (await api.getLoad(id)).load, "Nie znaleziono ładunku.", [id], Boolean(user));
  if (!user) return null;

  return (
    <AppShell>
      <AsyncView state={state} onRetry={reload} empty={null}>
        {(load) => (
          <div className="flex flex-col gap-6 max-w-2xl">
            <div className="card flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">{routeText(load)}</h1>
                <StatusBadge status={load.status} expiresAt={load.expires_at} />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Item label="Załadunek" value={formatDate(load.pickup_date)} />
                <Item label="Nadwozie" value={truckLabel(load.truck_required) || "dowolne"} />
                <Item label="Towar" value={load.cargo ?? "—"} />
                <Item label="Waga / palety" value={[load.weight_kg && `${load.weight_kg} kg`, load.pallets && `${load.pallets} pal.`].filter(Boolean).join(" · ") || "—"} />
                <Item label="Stawka" value={load.price ?? "—"} />
              </dl>
              {isLive(load.status, load.expires_at, now) && (
                <CancelButton
                  label="Wycofaj ładunek"
                  confirmText="Wycofać ładunek? Otwarte dopasowania zostaną zamknięte."
                  onConfirm={async () => {
                    await api.cancelLoad(load.id);
                    router.replace("/loads");
                  }}
                />
              )}
            </div>

            <MatchesSection
              scope={{ load: load.id }}
              emptyText="Na razie nikt nie pasuje do tego ładunku. Dopasowania pojawią się tu same, gdy przewoźnik opublikuje pasującą trasę — dostaniesz SMS."
            />
          </div>
        )}
      </AsyncView>
    </AppShell>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="field-label">{label}</dt>
      <dd className="mono">{value}</dd>
    </div>
  );
}
