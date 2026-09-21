"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { contactHref, formatDate, formatDateRange, routeText, truckLabel } from "@/lib/format";
import { homePath } from "@/lib/routes";
import { useAsync } from "@/lib/use-async";
import { useRoleGuard } from "@/lib/use-role-guard";
import type { MatchView } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { AsyncView } from "@/components/async-view";
import { MatchActions } from "@/components/match-actions";
import { MatchStateBadge, describeState } from "@/components/match-status";

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const user = useRoleGuard();
  const { state, reload } = useAsync(async () => (await api.getMatch(id)).match, "Nie znaleziono tego dopasowania.", [id], Boolean(user));
  if (!user) return null;

  return (
    <AppShell>
      <Link href={homePath(user.role)} className="text-sm text-[var(--color-text-muted)] hover:underline">
        ← Wróć
      </Link>
      <div className="mt-4">
        <AsyncView state={state} onRetry={reload} empty={null}>
          {(match) => <MatchDetail match={match} onRefresh={reload} />}
        </AsyncView>
      </div>
    </AppShell>
  );
}

function MatchDetail({ match, onRefresh }: { match: MatchView; onRefresh: () => void }) {
  const { load, offer, counterpart, state, viewer } = match;
  const canConnect = load.source === "direct" && offer.source === "direct";

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="card flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">{counterpart.label}</h1>
          <MatchStateBadge state={state} viewer={viewer} />
        </div>
        <p className="text-[var(--color-text-muted)]">{describeState(state, viewer, canConnect)}</p>
        <MatchActions match={match} onChange={onRefresh} onStale={onRefresh} />
      </div>

      <ContactBlock match={match} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card flex flex-col gap-2">
          <p className="field-label">Ładunek</p>
          <p className="font-semibold">{routeText(load)}</p>
          <p className="text-sm mono">załadunek {formatDate(load.pickup_date)}</p>
          <p className="text-sm text-[var(--color-text-muted)] mono">
            {[truckLabel(load.truck_required), load.weight_kg && `${load.weight_kg} kg`, load.pallets && `${load.pallets} pal.`, load.cargo].filter(Boolean).join(" · ") || "brak szczegółów"}
          </p>
          {load.price && <p className="text-sm mono">{load.price}</p>}
        </div>
        <div className="card flex flex-col gap-2">
          <p className="field-label">Przejazd</p>
          <p className="font-semibold">{routeText(offer)}</p>
          <p className="text-sm mono">{formatDateRange(offer.available_from, offer.available_to)}</p>
          <p className="text-sm text-[var(--color-text-muted)] mono">
            {[truckLabel(offer.truck_type), offer.capacity_kg && `${offer.capacity_kg} kg`].filter(Boolean).join(" · ") || "brak szczegółów"}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Контакт показываем только если сервер его прислал: после подтверждения или для публичного объявления из Facebook. */
function ContactBlock({ match }: { match: MatchView }) {
  const { counterpart, state } = match;
  const isOpen = state.status === "confirmed" || (counterpart.source === "facebook" && state.status !== "declined" && state.status !== "closed");
  if (!isOpen || (!counterpart.contact && !counterpart.sourceUrl)) return null;

  const href = counterpart.contact ? contactHref(counterpart.contact) : null;
  return (
    <div className="card flex flex-col gap-3" style={{ borderColor: "var(--color-success)" }}>
      <p className="field-label">Kontakt</p>
      {counterpart.contact &&
        (href ? (
          <a className="mono text-lg font-semibold break-all" style={{ color: "var(--color-accent)" }} href={href}>
            {counterpart.contact}
          </a>
        ) : (
          <p className="mono text-lg font-semibold break-all">{counterpart.contact}</p>
        ))}
      {counterpart.sourceUrl && (
        <a className="text-sm underline" style={{ color: "var(--color-accent)" }} href={counterpart.sourceUrl} target="_blank" rel="noopener noreferrer">
          Otwórz ogłoszenie na Facebooku
        </a>
      )}
    </div>
  );
}
