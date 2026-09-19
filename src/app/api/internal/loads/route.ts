import { z } from "zod";
import { db } from "@/lib/server/db";
import { isInternalRequest, json, unauthorized } from "@/lib/server/http";
import { matchAndNotifyForLoad } from "@/lib/server/matching";

const internalLoadSchema = z.object({
  origin: z.string().nullable().optional(),
  destination: z.string().nullable().optional(),
  origin_region: z.string().nullable().optional(),
  destination_region: z.string().nullable().optional(),
  truck_required: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  contact_info: z.string().nullable().optional(),
  raw_text: z.string(),
  raw_text_hash: z.string().length(64),
});

/**
 * POST /api/internal/loads — вызывается Python-парсером после структуризации поста LLM.
 * Защищено общим секретом (x-internal-key). Дедупликация — по raw_text_hash (уникальный индекс).
 */
export async function POST(req: Request) {
  if (!isInternalRequest(req)) return unauthorized();

  const parsed = internalLoadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_input", details: parsed.error.flatten() }, 400);

  const { data: load, error } = await db()
    .from("loads")
    .insert({ ...parsed.data, source: "facebook" })
    .select("*")
    .maybeSingle();

  if (error) {
    // unique_violation по raw_text_hash — пост уже видели, это ожидаемо.
    if ((error as { code?: string }).code === "23505") return json({ inserted: false, reason: "duplicate" });
    console.error("insert internal load failed", error);
    return json({ error: "db_error" }, 500);
  }
  if (!load) return json({ inserted: false, reason: "duplicate" });

  const { notified } = await matchAndNotifyForLoad(load.id).catch((err) => {
    console.error("matchAndNotifyForLoad failed", err);
    return { notified: 0 };
  });

  return json({ inserted: true, load, notified }, 201);
}
