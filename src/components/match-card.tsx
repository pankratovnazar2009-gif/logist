"use client";

import Link from "next/link";
import { counterpartLabel, formatDate, formatDateRange, routeText, truckLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import type { MatchView } from "@/lib/types";
import { MatchStateBadge, needsMyAction } from "./match-status";
import { VerifiedBadges } from "./verified-badges";

/** Строка списка: что предлагает вторая сторона (маршрут, даты, кузов) без контактов. */
export function MatchCard({ match }: { match: MatchView }) {
  const { m } = useI18n();
  const { viewer, load, offer, counterpart, state } = match;
  const isLogist = viewer === "logist";
  const place = isLogist ? offer : load;
  const when = isLogist ? formatDateRange(offer.available_from, offer.available_to) : `${m.common.loadOn} ${formatDate(load.pickup_date)}`;
  const details = [
    isLogist ? truckLabel(offer.truck_type, m) : truckLabel(load.truck_required, m),
    isLogist ? (offer.capacity_kg ? `${offer.capacity_kg} kg` : "") : load.weight_kg ? `${load.weight_kg} kg` : "",
    !isLogist && load.pallets ? `${load.pallets} ${m.common.pallets}` : "",
    !isLogist && load.cargo ? load.cargo : "",
  ].filter(Boolean);

  return (
    <Link
      href={`/matches/${match.id}`}
      className="card flex flex-col gap-2 hover:border-[var(--color-accent)]"
      style={needsMyAction(state, viewer) ? { borderColor: "var(--color-danger)" } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-semibold">{counterpartLabel(counterpart, m)}</span>
        <MatchStateBadge state={state} viewer={viewer} />
      </div>
      <div className="text-sm">
        {routeText(place, m)} · <span className="mono">{when}</span>
      </div>
      {details.length > 0 && <div className="text-sm text-[var(--color-text-muted)] mono">{details.join(" · ")}</div>}
      <VerifiedBadges verified={counterpart.verified} />
    </Link>
  );
}
