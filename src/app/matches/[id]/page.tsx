"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { contactHref, counterpartLabel, formatDate, formatDateRange, routeText, truckLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { homePath } from "@/lib/routes";
import { useAsync } from "@/lib/use-async";
import { useRoleGuard } from "@/lib/use-role-guard";
import type { MatchView } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { AsyncView } from "@/components/async-view";
import { Avatar } from "@/components/avatar";
import { MatchActions } from "@/components/match-actions";
import { MatchStateBadge, describeState } from "@/components/match-status";
import { VerifiedBadges } from "@/components/verified-badges";

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const user = useRoleGuard();
  const { m } = useI18n();
  const { state, reload } = useAsync(async () => (await api.getMatch(id)).match, m.match.notFound, [id], Boolean(user));
  if (!user) return null;

  return (
    <AppShell>
      <Link href={homePath(user.role)} className="text-sm text-[var(--color-text-muted)] hover:underline">
        {m.common.back}
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
  const { m } = useI18n();
  const { load, offer, counterpart, state, viewer } = match;
  const canConnect = load.source === "direct" && offer.source === "direct";
  const label = counterpartLabel(counterpart, m);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="card flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {counterpart.verified && <Avatar url={counterpart.person?.avatarUrl ?? null} name={counterpart.person?.name ?? counterpart.company} size={48} label={label} />}
            <div className="min-w-0">
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">{counterpart.person?.name ?? label}</h1>
              {counterpart.person?.name && <p className="text-sm text-[var(--color-text-muted)]">{label}</p>}
            </div>
          </div>
          <MatchStateBadge state={state} viewer={viewer} />
        </div>
        <VerifiedBadges verified={counterpart.verified} />
        <p className="text-[var(--color-text-muted)]">{describeState(state, viewer, canConnect, m)}</p>
        <MatchActions match={match} onChange={onRefresh} onStale={onRefresh} />
      </div>

      <ContactBlock match={match} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card flex flex-col gap-2">
          <p className="field-label">{m.match.load}</p>
          <p className="font-semibold">{routeText(load, m)}</p>
          <p className="text-sm mono">
            {m.common.loadOn} {formatDate(load.pickup_date)}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mono">
            {[truckLabel(load.truck_required, m), load.weight_kg && `${load.weight_kg} kg`, load.pallets && `${load.pallets} ${m.common.pallets}`, load.cargo].filter(Boolean).join(" · ") || m.common.noDetails}
          </p>
          {load.price && <p className="text-sm mono">{load.price}</p>}
        </div>
        <div className="card flex flex-col gap-2">
          <p className="field-label">{m.match.trip}</p>
          <p className="font-semibold">{routeText(offer, m)}</p>
          <p className="text-sm mono">{formatDateRange(offer.available_from, offer.available_to)}</p>
          <p className="text-sm text-[var(--color-text-muted)] mono">
            {[truckLabel(offer.truck_type, m), offer.capacity_kg && `${offer.capacity_kg} kg`].filter(Boolean).join(" · ") || m.common.noDetails}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Контакт показываем только если сервер его прислал: после подтверждения или для публичного объявления из Facebook. */
function ContactBlock({ match }: { match: MatchView }) {
  const { m } = useI18n();
  const { counterpart, state } = match;
  const isOpen = state.status === "confirmed" || (counterpart.source === "facebook" && state.status !== "declined" && state.status !== "closed");
  if (!isOpen || (!counterpart.contact && !counterpart.sourceUrl && !counterpart.person?.email)) return null;

  const href = counterpart.contact ? contactHref(counterpart.contact) : null;
  return (
    <div className="card flex flex-col gap-3" style={{ borderColor: "var(--color-success)" }}>
      <p className="field-label">{m.match.contact}</p>
      {counterpart.contact &&
        (href ? (
          <a className="mono text-lg font-semibold break-all" style={{ color: "var(--color-accent)" }} href={href}>
            {counterpart.contact}
          </a>
        ) : (
          <p className="mono text-lg font-semibold break-all">{counterpart.contact}</p>
        ))}
      {counterpart.person?.email && (
        <a className="text-sm mono break-all" style={{ color: "var(--color-accent)" }} href={`mailto:${counterpart.person.email}`}>
          {counterpart.person.email}
        </a>
      )}
      {counterpart.sourceUrl && (
        <a className="text-sm underline" style={{ color: "var(--color-accent)" }} href={counterpart.sourceUrl} target="_blank" rel="noopener noreferrer">
          {m.match.openOnFacebook}
        </a>
      )}
    </div>
  );
}
