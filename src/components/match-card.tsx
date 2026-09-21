import Link from "next/link";
import { formatDate, formatDateRange, routeText, truckLabel } from "@/lib/format";
import type { MatchView } from "@/lib/types";
import { MatchStateBadge, needsMyAction } from "./match-status";
import { VerifiedBadges } from "./verified-badges";

/** Строка списка: что предлагает вторая сторона (маршрут, даты, кузов) без контактов. */
export function MatchCard({ match }: { match: MatchView }) {
  const { viewer, load, offer, counterpart, state } = match;
  const isLogist = viewer === "logist";
  const place = isLogist ? offer : load;
  const when = isLogist ? formatDateRange(offer.available_from, offer.available_to) : `załadunek ${formatDate(load.pickup_date)}`;
  const details = [
    isLogist ? truckLabel(offer.truck_type) : truckLabel(load.truck_required),
    isLogist ? (offer.capacity_kg ? `${offer.capacity_kg} kg` : "") : load.weight_kg ? `${load.weight_kg} kg` : "",
    !isLogist && load.pallets ? `${load.pallets} pal.` : "",
    !isLogist && load.cargo ? load.cargo : "",
  ].filter(Boolean);

  return (
    <Link
      href={`/matches/${match.id}`}
      className="card flex flex-col gap-2 hover:border-[var(--color-accent)]"
      style={needsMyAction(state, viewer) ? { borderColor: "var(--color-danger)" } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-semibold">{counterpart.label}</span>
        <MatchStateBadge state={state} viewer={viewer} />
      </div>
      <div className="text-sm">
        {routeText(place)} · <span className="mono">{when}</span>
      </div>
      {details.length > 0 && <div className="text-sm text-[var(--color-text-muted)] mono">{details.join(" · ")}</div>}
      <VerifiedBadges verified={counterpart.verified} />
    </Link>
  );
}
