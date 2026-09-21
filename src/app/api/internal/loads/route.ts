import { after } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/lib/server/db";
import { isInternalRequest, json, unauthorized } from "@/lib/server/http";
import { createMatchesForLoad } from "@/lib/server/matching";
import { sendMatchNotifications } from "@/lib/server/notifications";
import { expiresAtFor, internalLoadSchema } from "@/lib/server/schemas";

/**
 * POST /api/internal/loads — вызывается воркфлоу n8n после разбора FB-поста нейросетью.
 * Защищено общим секретом (x-internal-key). Дедупликация — по sha256 текста (уникальный индекс).
 */
export async function POST(req: Request) {
  if (!isInternalRequest(req)) return unauthorized();

  const parsed = internalLoadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_input", details: parsed.error.flatten() }, 400);

  const raw_text_hash = createHash("sha256").update(parsed.data.raw_text.trim()).digest("hex");
  const expires_at = parsed.data.pickup_date ? expiresAtFor(parsed.data.pickup_date) : undefined; // без даты — срок по умолчанию (48 ч)

  const { data: load, error } = await db()
    .from("loads")
    .insert({ ...parsed.data, raw_text_hash, ...(expires_at ? { expires_at } : {}), source: "facebook" })
    .select("*")
    .maybeSingle();

  if (error) {
    // unique_violation по raw_text_hash — пост уже видели, это ожидаемо.
    if ((error as { code?: string }).code === "23505") return json({ inserted: false, reason: "duplicate" });
    console.error("insert internal load failed", error);
    return json({ error: "db_error" }, 500);
  }
  if (!load) return json({ inserted: false, reason: "duplicate" });

  const notifications = await createMatchesForLoad(load.id).catch((err) => {
    console.error("createMatchesForLoad failed", err);
    return [];
  });
  after(() => sendMatchNotifications(notifications));

  return json({ inserted: true, id: load.id, matches: notifications.length }, 201);
}
