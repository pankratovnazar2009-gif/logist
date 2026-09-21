import { after } from "next/server";
import { db } from "@/lib/server/db";
import { countActiveMatches, requireUser } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
import { createMatchesForOffer } from "@/lib/server/matching";
import { sendMatchNotifications } from "@/lib/server/notifications";
import { directOfferSchema, expiresAtFor } from "@/lib/server/schemas";

/** GET /api/offers — предложения (поездки) перевозчика с числом живых совпадений. */
export async function GET(req: Request) {
  const auth = await requireUser(req, "carrier");
  if (!auth.ok) return auth.response;

  const { data: offers, error } = await db()
    .from("carrier_offers")
    .select("*")
    .eq("carrier_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return json({ error: "db_error" }, 500);

  const counts = await countActiveMatches("offer_id", (offers ?? []).map((o) => o.id));
  return json({ offers: (offers ?? []).map((offer) => ({ ...offer, match_count: counts.get(offer.id) ?? 0 })) });
}

/** POST /api/offers — перевозчик публикует поездку; подходящие грузы находятся сразу, SMS логистам уходят после ответа. */
export async function POST(req: Request) {
  const auth = await requireUser(req, "carrier");
  if (!auth.ok) return auth.response;

  const parsed = directOfferSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_input", details: parsed.error.flatten() }, 400);

  const { data: offer, error } = await db()
    .from("carrier_offers")
    .insert({ ...parsed.data, source: "direct", carrier_id: auth.user.id, expires_at: expiresAtFor(parsed.data.available_to) })
    .select("*")
    .single();
  if (error || !offer) return json({ error: "db_error" }, 500);

  const notifications = await createMatchesForOffer(offer.id).catch((err) => {
    console.error("createMatchesForOffer failed", err);
    return [];
  });
  after(() => sendMatchNotifications(notifications));

  return json({ offer }, 201);
}
