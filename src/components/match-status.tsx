"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { Messages } from "@/lib/i18n/messages";
import type { MatchState, Party } from "@/lib/match-state";

/** Эта пара ждёт реакции именно этого пользователя. */
export const needsMyAction = (state: MatchState, viewer: Party): boolean => state.status === "requested" && state.by !== viewer;

export function MatchStateBadge({ state, viewer }: { state: MatchState; viewer: Party }) {
  const { m } = useI18n();
  switch (state.status) {
    case "pending":
      return <span className="badge badge-accent">{m.match.badge.new}</span>;
    case "requested":
      return state.by === viewer ? <span className="badge badge-warning">{m.match.badge.waiting}</span> : <span className="badge badge-danger">{m.match.badge.needsAction}</span>;
    case "confirmed":
      return <span className="badge badge-success">{m.match.badge.connected}</span>;
    case "declined":
      return <span className="badge badge-warning">{m.match.badge.declined}</span>;
    case "closed":
      return <span className="badge badge-warning">{m.match.badge.closed}</span>;
  }
}

/** Что происходит с парой и что делать дальше — простыми словами, с точки зрения пользователя. */
export function describeState(state: MatchState, viewer: Party, canConnect: boolean, m: Messages): string {
  const text = m.match.describe;
  switch (state.status) {
    case "pending":
      return canConnect ? text.pendingApp : text.pendingFacebook;
    case "requested":
      return state.by === viewer ? text.requestedByMe : text.requestedByOther;
    case "confirmed":
      return text.confirmed;
    case "declined":
      return state.by === viewer ? text.declinedByMe : text.declinedByOther;
    case "closed":
      return text[state.reason];
  }
}
