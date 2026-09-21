"use client";

import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatDateRange, routeText, truckLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { useAsync } from "@/lib/use-async";
import { useRoleGuard } from "@/lib/use-role-guard";
import { AppShell } from "@/components/app-shell";
import { AsyncView } from "@/components/async-view";
import { CancelButton } from "@/components/cancel-button";
import { MatchesSection } from "@/components/matches-section";
import { StatusBadge, isLive, useNow } from "@/components/status-badge";

export default function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useRoleGuard("carrier");
  const router = useRouter();
  const { m } = useI18n();
  const now = useNow();
  const { state, reload } = useAsync(async () => (await api.getOffer(id)).offer, m.offers.notFound, [id], Boolean(user));
  if (!user) return null;

  return (
    <AppShell>
      <AsyncView state={state} onRetry={reload} empty={null}>
        {(offer) => (
          <div className="flex flex-col gap-6 max-w-2xl">
            <div className="card flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">{routeText(offer, m)}</h1>
                <StatusBadge status={offer.status} expiresAt={offer.expires_at} />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="field-label">{m.offers.fields.dates}</dt>
                  <dd className="mono">{formatDateRange(offer.available_from, offer.available_to)}</dd>
                </div>
                <div>
                  <dt className="field-label">{m.offers.fields.bodyCapacity}</dt>
                  <dd className="mono">{[truckLabel(offer.truck_type, m), offer.capacity_kg && `${offer.capacity_kg} kg`].filter(Boolean).join(" · ") || "—"}</dd>
                </div>
              </dl>
              {isLive(offer.status, offer.expires_at, now) && (
                <CancelButton
                  label={m.offers.cancel}
                  confirmText={m.offers.cancelConfirm}
                  onConfirm={async () => {
                    await api.cancelOffer(offer.id);
                    router.replace("/offers");
                  }}
                />
              )}
            </div>

            <MatchesSection scope={{ offer: offer.id }} emptyText={m.offers.noMatchesYet} />
          </div>
        )}
      </AsyncView>
    </AppShell>
  );
}
