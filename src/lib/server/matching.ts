import { db } from "./db";
import { addDays, evaluateMatch, pickupWindow, type LoadFacts, type OfferFacts } from "../matching-rules";
import type { CarrierOffer, Load } from "../types";
import type { PendingNotification } from "./notifications";

/** Сколько SMS уходит по одному новому объявлению: остальные совпадения видны в приложении, но спамить не будем. */
const MAX_SMS_PER_EVENT = 10;

export const loadFacts = (load: Load): LoadFacts => ({
  originRegion: load.origin_region,
  destinationRegion: load.destination_region,
  pickupDate: load.pickup_date,
  truckRequired: load.truck_required,
  weightKg: load.weight_kg,
  pallets: load.pallets,
});

export const offerFacts = (offer: CarrierOffer): OfferFacts => ({
  originRegion: offer.origin_region,
  destinationRegion: offer.destination_region,
  availableFrom: offer.available_from,
  availableTo: offer.available_to,
  truckType: offer.truck_type,
  capacityKg: offer.capacity_kg,
});

const routeLabel = (origin: string | null, destination: string | null, originRegion: string | null, destinationRegion: string | null) =>
  `${origin ?? originRegion ?? "?"} → ${destination ?? destinationRegion ?? "?"}`;

interface Scored<T> {
  item: T;
  score: number;
}

/** Создаёт пары для нового груза и возвращает, кого из перевозчиков нужно оповестить. Только БД — SMS шлёт вызывающий. */
export async function createMatchesForLoad(loadId: string): Promise<PendingNotification[]> {
  const supabase = db();
  const { data: load } = await supabase.from("loads").select("*").eq("id", loadId).single<Load>();
  if (!load || !load.origin_region || load.status !== "active") return [];

  let query = supabase
    .from("carrier_offers")
    .select("*")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .eq("origin_region", load.origin_region);
  if (load.pickup_date) {
    // грубый отбор в БД; точное правило (окно ±1 день) применяет evaluateMatch
    query = query.lte("available_from", addDays(load.pickup_date, 1)).gte("available_to", addDays(load.pickup_date, -1));
  }
  const { data: offers, error } = await query.returns<CarrierOffer[]>();
  if (error) throw error;

  const scored = scoreAll(offers ?? [], (offer) => evaluateMatch(loadFacts(load), offerFacts(offer)));
  const created = await insertPairs(scored.map((s) => ({ load_id: load.id, offer_id: s.item.id, score: s.score })));
  const offerById = new Map(scored.map((s) => [s.item.id, s]));

  return created
    .map((pair) => ({ pair, offer: offerById.get(pair.offer_id) }))
    .filter((x): x is { pair: CreatedPair; offer: Scored<CarrierOffer> } => Boolean(x.offer?.item.carrier_id))
    .sort((a, b) => b.offer.score - a.offer.score)
    .slice(0, MAX_SMS_PER_EVENT)
    .map(({ pair, offer }) => ({
      matchId: pair.id,
      userId: offer.item.carrier_id as string,
      kind: "match" as const,
      route: routeLabel(load.origin, load.destination, load.origin_region, load.destination_region),
    }));
}

/** Создаёт пары для нового предложения перевозчика и возвращает, кого из логистов нужно оповестить. */
export async function createMatchesForOffer(offerId: string): Promise<PendingNotification[]> {
  const supabase = db();
  const { data: offer } = await supabase.from("carrier_offers").select("*").eq("id", offerId).single<CarrierOffer>();
  if (!offer || offer.status !== "active") return [];

  const window = pickupWindow(offerFacts(offer));
  const { data: loads, error } = await supabase
    .from("loads")
    .select("*")
    .in("status", ["active", "matched"])
    .gt("expires_at", new Date().toISOString())
    .eq("origin_region", offer.origin_region)
    .or(`pickup_date.is.null,and(pickup_date.gte.${window.from},pickup_date.lte.${window.to})`)
    .returns<Load[]>();
  if (error) throw error;

  const scored = scoreAll(loads ?? [], (load) => evaluateMatch(loadFacts(load), offerFacts(offer)));
  const created = await insertPairs(scored.map((s) => ({ load_id: s.item.id, offer_id: offer.id, score: s.score })));
  const loadById = new Map(scored.map((s) => [s.item.id, s]));

  return created
    .map((pair) => ({ pair, load: loadById.get(pair.load_id) }))
    .filter((x): x is { pair: CreatedPair; load: Scored<Load> } => Boolean(x.load?.item.logist_id))
    .sort((a, b) => b.load.score - a.load.score)
    .slice(0, MAX_SMS_PER_EVENT)
    .map(({ pair, load }) => ({
      matchId: pair.id,
      userId: load.item.logist_id as string,
      kind: "match" as const,
      route: routeLabel(offer.origin, offer.destination, offer.origin_region, offer.destination_region),
    }));
}

interface CreatedPair {
  id: string;
  load_id: string;
  offer_id: string;
}

function scoreAll<T>(items: T[], evaluate: (item: T) => ReturnType<typeof evaluateMatch>): Scored<T>[] {
  const out: Scored<T>[] = [];
  for (const item of items) {
    const verdict = evaluate(item);
    if (verdict.ok) out.push({ item, score: verdict.score });
  }
  return out;
}

/** Вставляет только новые пары (уникальность по load_id + offer_id) и возвращает именно их — повторный вызов ничего не создаёт. */
async function insertPairs(rows: { load_id: string; offer_id: string; score: number }[]): Promise<CreatedPair[]> {
  if (rows.length === 0) return [];
  const { data, error } = await db()
    .from("match_requests")
    .upsert(rows, { onConflict: "load_id,offer_id", ignoreDuplicates: true })
    .select("id, load_id, offer_id");
  if (error) throw error;
  return (data ?? []) as CreatedPair[];
}
