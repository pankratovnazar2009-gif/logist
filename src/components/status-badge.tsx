"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { LoadStatus, OfferStatus } from "@/lib/types";

/** Момент открытия экрана. Фиксируется один раз: срок объявления сверяем с ним, а не с часами во время рендера. */
export function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}

/** Активно ли объявление сейчас (можно ли его снять и искать по нему пары). */
export const isLive = (status: LoadStatus | OfferStatus, expiresAt: string, now: number): boolean =>
  (status === "active" || status === "matched") && Date.parse(expiresAt) >= now;

/** Статус объявления с учётом срока: «активное», у которого срок вышел, показываем как истёкшее (в БД оно обновится лениво). */
export function StatusBadge({ status, expiresAt }: { status: LoadStatus | OfferStatus; expiresAt: string }) {
  const { m } = useI18n();
  const now = useNow();
  const effective = status === "active" || status === "matched" ? (isLive(status, expiresAt, now) ? "active" : "expired") : status;
  switch (effective) {
    case "active":
      return <span className="badge badge-accent">{m.status.active}</span>;
    case "taken":
      return <span className="badge badge-success">{m.status.taken}</span>;
    case "cancelled":
      return <span className="badge badge-warning">{m.status.cancelled}</span>;
    default:
      return <span className="badge badge-warning">{m.status.expired}</span>;
  }
}

export function MatchCountBadge({ count }: { count: number }) {
  const { m } = useI18n();
  return count > 0 ? <span className="badge badge-success">{m.status.matches(count)}</span> : <span className="badge badge-warning">{m.status.noMatches}</span>;
}
