"use client";

import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatDate, routeText, truckLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
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
  const { m } = useI18n();
  const now = useNow();
  const { state, reload } = useAsync(async () => (await api.getLoad(id)).load, m.loads.notFound, [id], Boolean(user));
  if (!user) return null;

  const fields = m.loads.fields;
  return (
    <AppShell>
      <AsyncView state={state} onRetry={reload} empty={null}>
        {(load) => (
          <div className="flex flex-col gap-6 max-w-2xl">
            <div className="card flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">{routeText(load, m)}</h1>
                <StatusBadge status={load.status} expiresAt={load.expires_at} />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Item label={fields.pickup} value={formatDate(load.pickup_date)} />
                <Item label={fields.body} value={truckLabel(load.truck_required, m) || fields.bodyAny} />
                <Item label={fields.cargo} value={load.cargo ?? "—"} />
                <Item label={fields.weightPallets} value={[load.weight_kg && `${load.weight_kg} kg`, load.pallets && `${load.pallets} ${m.common.pallets}`].filter(Boolean).join(" · ") || "—"} />
                <Item label={fields.rate} value={load.price ?? "—"} />
              </dl>
              {isLive(load.status, load.expires_at, now) && (
                <CancelButton
                  label={m.loads.cancel}
                  confirmText={m.loads.cancelConfirm}
                  onConfirm={async () => {
                    await api.cancelLoad(load.id);
                    router.replace("/loads");
                  }}
                />
              )}
            </div>

            <MatchesSection scope={{ load: load.id }} emptyText={m.loads.noMatchesYet} />
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
