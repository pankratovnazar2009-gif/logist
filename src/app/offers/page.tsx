"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { formatDateRange, routeText, truckLabel } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import { useRoleGuard } from "@/lib/use-role-guard";
import type { OfferWithCount } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { AsyncView } from "@/components/async-view";
import { MatchCountBadge, StatusBadge, isLive, useNow } from "@/components/status-badge";

export default function OffersPage() {
  const user = useRoleGuard("carrier");
  const { state, reload } = useAsync(async () => (await api.listOffers()).offers, "Nie udało się pobrać listy przejazdów.", [], Boolean(user));
  if (!user) return null;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">Twoje przejazdy</h1>
        <Link href="/offers/new" className="btn btn-primary">
          + Dodaj przejazd
        </Link>
      </div>

      <AsyncView
        state={state}
        onRetry={reload}
        isEmpty={(offers) => offers.length === 0}
        empty="Nie masz jeszcze żadnego przejazdu. Dodaj termin i trasę — pokażemy pasujące ładunki i wyślemy SMS, gdy pojawi się nowy."
      >
        {(offers) => (
          <div className="flex flex-col gap-3">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        )}
      </AsyncView>
    </AppShell>
  );
}

function OfferCard({ offer }: { offer: OfferWithCount }) {
  const now = useNow();
  return (
    <Link href={`/offers/${offer.id}`} className="card flex items-center justify-between gap-4 hover:border-[var(--color-accent)]">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="font-semibold truncate">{routeText(offer)}</div>
        <div className="flex flex-wrap gap-x-3 text-sm text-[var(--color-text-muted)] mono">
          <span>{formatDateRange(offer.available_from, offer.available_to)}</span>
          {offer.truck_type && <span>{truckLabel(offer.truck_type)}</span>}
          {offer.capacity_kg && <span>{offer.capacity_kg} kg</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <StatusBadge status={offer.status} expiresAt={offer.expires_at} />
        {isLive(offer.status, offer.expires_at, now) && <MatchCountBadge count={offer.match_count} />}
      </div>
    </Link>
  );
}
