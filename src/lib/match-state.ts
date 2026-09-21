import { z } from "zod";

export type Party = "logist" | "carrier";
export type ClosedReason = "load_taken" | "offer_taken" | "expired" | "cancelled";
export type MatchAction = "request" | "confirm" | "decline";

/** Состояние пары «груз ↔ предложение». Невозможные комбинации (например, «подтверждено» без запроса) не выражаются типом. */
export type MatchState =
  | { status: "pending" }
  | { status: "requested"; by: Party }
  | { status: "confirmed" }
  | { status: "declined"; by: Party }
  | { status: "closed"; reason: ClosedReason };

const partySchema = z.enum(["logist", "carrier"]);

const matchRowSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }),
  z.object({ status: z.literal("requested"), requested_by: partySchema }),
  z.object({ status: z.literal("confirmed") }),
  z.object({ status: z.literal("declined"), declined_by: partySchema }),
  z.object({ status: z.literal("closed"), closed_reason: z.enum(["load_taken", "offer_taken", "expired", "cancelled"]) }),
]);

/** Строка match_requests из БД → состояние. Ограничение match_state_shape в БД гарантирует, что разбор не упадёт. */
export function parseMatchState(row: unknown): MatchState {
  const parsed = matchRowSchema.parse(row);
  switch (parsed.status) {
    case "pending":
      return { status: "pending" };
    case "requested":
      return { status: "requested", by: parsed.requested_by };
    case "confirmed":
      return { status: "confirmed" };
    case "declined":
      return { status: "declined", by: parsed.declined_by };
    case "closed":
      return { status: "closed", reason: parsed.closed_reason };
  }
}

/**
 * Что может сделать участник. `canConnect` — обе стороны в приложении: если одна из них пришла из Facebook,
 * подтверждать некому, а контакт и так публичен — остаётся только скрыть пару.
 */
export function availableActions(state: MatchState, viewer: Party, canConnect: boolean): MatchAction[] {
  switch (state.status) {
    case "pending":
      return canConnect ? ["request", "decline"] : ["decline"];
    case "requested":
      return state.by === viewer ? ["decline"] : ["confirm", "decline"];
    case "confirmed":
    case "declined":
    case "closed":
      return [];
  }
}

export function otherParty(party: Party): Party {
  return party === "logist" ? "carrier" : "logist";
}
