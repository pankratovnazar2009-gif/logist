"use client";

import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatDateRange, routeText, truckLabel } from "@/lib/format";
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
  const now = useNow();
  const { state, reload } = useAsync(async () => (await api.getOffer(id)).offer, "Nie znaleziono przejazdu.", [id], Boolean(user));
  if (!user) return null;

  return (
    <AppShell>
      <AsyncView state={state} onRetry={reload} empty={null}>
        {(offer) => (
          <div className="flex flex-col gap-6 max-w-2xl">
            <div className="card flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">{routeText(offer)}</h1>
                <StatusBadge status={offer.status} expiresAt={offer.expires_at} />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="field-label">Terminy</dt>
                  <dd className="mono">{formatDateRange(offer.available_from, offer.available_to)}</dd>
                </div>
                <div>
                  <dt className="field-label">Nadwozie / ładowność</dt>
                  <dd className="mono">{[truckLabel(offer.truck_type), offer.capacity_kg && `${offer.capacity_kg} kg`].filter(Boolean).join(" · ") || "—"}</dd>
                </div>
              </dl>
              {isLive(offer.status, offer.expires_at, now) && (
                <CancelButton
                  label="Wycofaj przejazd"
                  confirmText="Wycofać przejazd? Otwarte dopasowania zostaną zamknięte."
                  onConfirm={async () => {
                    await api.cancelOffer(offer.id);
                    router.replace("/offers");
                  }}
                />
              )}
            </div>

            <MatchesSection
              scope={{ offer: offer.id }}
              emptyText="Na razie brak pasujących ładunków. Gdy pojawi się nowy w Twoim regionie i terminie, dostaniesz SMS."
            />
          </div>
        )}
      </AsyncView>
    </AppShell>
  );
}
