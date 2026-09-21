import { db } from "./db";
import { availableActions, otherParty, parseMatchState, type MatchState, type Party } from "../match-state";
import type { CarrierOffer, Load, LoadSummary, MatchView, OfferSummary } from "../types";

interface MatchRow {
  id: string;
  status: string;
  requested_by: Party | null;
  declined_by: Party | null;
  closed_reason: string | null;
  score: number;
  created_at: string;
  load: Load;
  offer: CarrierOffer;
}

const SELECT = "*, load:loads(*), offer:carrier_offers(*)";

/** Пара, у которой груз или предложение уже недоступны, для пользователя закрыта — даже если в БД ещё «ожидает» (истечение считаем лениво). */
function effectiveState(row: MatchRow): MatchState {
  const state = parseMatchState(row);
  if (state.status !== "pending" && state.status !== "requested") return state;

  const { load, offer } = row;
  const now = Date.now();
  if (load.status === "taken") return { status: "closed", reason: "load_taken" };
  if (offer.status === "taken") return { status: "closed", reason: "offer_taken" };
  if (load.status === "cancelled" || offer.status === "cancelled") return { status: "closed", reason: "cancelled" };
  if (load.status === "expired" || offer.status === "expired" || Date.parse(load.expires_at) < now || Date.parse(offer.expires_at) < now) {
    return { status: "closed", reason: "expired" };
  }
  return state;
}

/** Порядок в списке: сначала то, что ждёт действия пользователя, потом остальное по убыванию совпадения. */
function attentionRank(view: MatchView): number {
  const { state, viewer } = view;
  if (state.status === "requested" && state.by !== viewer) return 0;
  if (state.status === "confirmed") return 1;
  if (state.status === "pending") return 2;
  if (state.status === "requested") return 3;
  return 4;
}

async function buildViews(rows: MatchRow[], userId: string, includeInactive: boolean): Promise<MatchView[]> {
  const mine = rows.flatMap((row) => {
    const viewer: Party | null = row.load.logist_id === userId ? "logist" : row.offer.carrier_id === userId ? "carrier" : null;
    return viewer ? [{ row, viewer }] : [];
  });

  const counterpartIds = [
    ...new Set(mine.flatMap(({ row, viewer }) => (viewer === "logist" ? row.offer.carrier_id : row.load.logist_id)).filter((id): id is string => Boolean(id))),
  ];
  const { data: users } = counterpartIds.length
    ? await db().from("users").select("id, phone, company_name").in("id", counterpartIds)
    : { data: [] };
  const userById = new Map((users ?? []).map((u) => [u.id as string, u as { id: string; phone: string | null; company_name: string | null }]));

  const views = mine.map(({ row, viewer }): MatchView => {
    const state = effectiveState(row);
    const counterpartParty = otherParty(viewer);
    const counterpartUserId = counterpartParty === "carrier" ? row.offer.carrier_id : row.load.logist_id;
    const counterpartSource = counterpartParty === "carrier" ? row.offer.source : row.load.source;
    const counterpartRecordContact = counterpartParty === "carrier" ? row.offer.contact_info : row.load.contact_info;
    const counterpartUser = counterpartUserId ? userById.get(counterpartUserId) : undefined;
    const isFacebook = counterpartSource === "facebook";

    // Контакт из приложения раскрываем только после подтверждения; контакт из FB-поста и так публичен.
    const contact = isFacebook ? counterpartRecordContact : state.status === "confirmed" ? (counterpartRecordContact ?? counterpartUser?.phone ?? null) : null;

    return {
      id: row.id,
      state,
      score: row.score,
      viewer,
      load: summarizeLoad(row.load),
      offer: summarizeOffer(row.offer),
      actions: availableActions(state, viewer, Boolean(row.load.logist_id && row.offer.carrier_id)),
      counterpart: {
        party: counterpartParty,
        source: counterpartSource,
        label: isFacebook
          ? counterpartParty === "carrier" ? "Przewoźnik z grupy Facebook" : "Zleceniodawca z grupy Facebook"
          : counterpartUser?.company_name ?? (counterpartParty === "carrier" ? "Przewoźnik" : "Logist"),
        contact,
        sourceUrl: isFacebook ? (counterpartParty === "carrier" ? row.offer.source_url : row.load.source_url) : null,
      },
      created_at: row.created_at,
    };
  });

  return views
    .filter((view) => includeInactive || (view.state.status !== "declined" && view.state.status !== "closed"))
    .sort((a, b) => attentionRank(a) - attentionRank(b) || b.score - a.score);
}

export async function getMatchView(userId: string, matchId: string): Promise<MatchView | null> {
  const { data } = await db().from("match_requests").select(SELECT).eq("id", matchId).maybeSingle<MatchRow>();
  if (!data) return null;
  return (await buildViews([data], userId, true))[0] ?? null;
}

/** Все пары пользователя; `loadId` / `offerId` сужают список до одного груза или одного предложения. */
export async function listMatchViews(userId: string, scope: { loadId?: string; offerId?: string } = {}): Promise<MatchView[]> {
  const supabase = db();
  let query = supabase.from("match_requests").select(SELECT).order("created_at", { ascending: false }).limit(200);

  if (scope.loadId) query = query.eq("load_id", scope.loadId);
  else if (scope.offerId) query = query.eq("offer_id", scope.offerId);
  else {
    const [{ data: myLoads }, { data: myOffers }] = await Promise.all([
      supabase.from("loads").select("id").eq("logist_id", userId),
      supabase.from("carrier_offers").select("id").eq("carrier_id", userId),
    ]);
    const clauses = [
      ...(myLoads?.length ? [`load_id.in.(${myLoads.map((l) => l.id).join(",")})`] : []),
      ...(myOffers?.length ? [`offer_id.in.(${myOffers.map((o) => o.id).join(",")})`] : []),
    ];
    if (clauses.length === 0) return [];
    query = query.or(clauses.join(","));
  }

  const { data } = await query.returns<MatchRow[]>();
  return buildViews(data ?? [], userId, false);
}

function summarizeLoad(load: Load): LoadSummary {
  const { id, source, origin, destination, origin_region, destination_region, pickup_date, cargo, weight_kg, pallets, truck_required, price, status, expires_at } = load;
  return { id, source, origin, destination, origin_region, destination_region, pickup_date, cargo, weight_kg, pallets, truck_required, price, status, expires_at };
}

function summarizeOffer(offer: CarrierOffer): OfferSummary {
  const { id, source, origin, destination, origin_region, destination_region, available_from, available_to, truck_type, capacity_kg, status, expires_at } = offer;
  return { id, source, origin, destination, origin_region, destination_region, available_from, available_to, truck_type, capacity_kg, status, expires_at };
}
