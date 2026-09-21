import { after } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/lib/server/db";
import { isInternalRequest, json, unauthorized } from "@/lib/server/http";
import { createMatchesForOffer } from "@/lib/server/matching";
import { sendMatchNotifications } from "@/lib/server/notifications";
import { expiresAtFor, internalOfferSchema } from "@/lib/server/schemas";

/**
 * POST /api/internal/offers — предложение перевозчика («wolny pojazd…»), найденное в FB-группе.
 * Нужны регион загрузки и окно дат: без них подбор невозможен, такие посты n8n не присылает.
 */
export async function POST(req: Request) {
  if (!isInternalRequest(req)) return unauthorized();

  const parsed = internalOfferSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_input", details: parsed.error.flatten() }, 400);

  const raw_text_hash = createHash("sha256").update(parsed.data.raw_text.trim()).digest("hex");

  const { data: offer, error } = await db()
    .from("carrier_offers")
    .insert({ ...parsed.data, raw_text_hash, source: "facebook", carrier_id: null, expires_at: expiresAtFor(parsed.data.available_to) })
    .select("*")
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === "23505") return json({ inserted: false, reason: "duplicate" });
    console.error("insert internal offer failed", error);
    return json({ error: "db_error" }, 500);
  }
  if (!offer) return json({ inserted: false, reason: "duplicate" });

  const notifications = await createMatchesForOffer(offer.id).catch((err) => {
    console.error("createMatchesForOffer failed", err);
    return [];
  });
  after(() => sendMatchNotifications(notifications));

  return json({ inserted: true, id: offer.id, matches: notifications.length }, 201);
}
