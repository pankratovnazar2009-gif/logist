import { Router } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase";
import { requireInternalKey } from "../middleware/requireAuth";
import { matchAndNotifyForLoad } from "../services/matching";

export const internalRouter = Router();

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
 * POST /api/internal/loads — вызывается Python-парсером после того, как LLM структурировал пост.
 * Защищено общим секретом (заголовок x-internal-key), а не пользовательским JWT.
 * Дедупликация — по raw_text_hash (уникальный индекс в БД): повторный пост тихо игнорируется.
 */
internalRouter.post("/loads", requireInternalKey, async (req, res) => {
  const parsed = internalLoadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });

  const { data: load, error } = await supabase
    .from("loads")
    .insert({ ...parsed.data, source: "facebook" })
    .select("*")
    .maybeSingle();

  if (error) {
    // unique_violation на raw_text_hash — этот пост уже видели, это ожидаемо, не ошибка.
    if ((error as { code?: string }).code === "23505") return res.json({ inserted: false, reason: "duplicate" });
    console.error("insert internal load failed", error);
    return res.status(500).json({ error: "db_error" });
  }
  if (!load) return res.json({ inserted: false, reason: "duplicate" });

  const { notified } = await matchAndNotifyForLoad(load.id).catch((err) => {
    console.error("matchAndNotifyForLoad failed", err);
    return { notified: 0 };
  });

  res.status(201).json({ inserted: true, load, notified });
});

/**
 * GET /api/internal/fb-groups — активные группы для обхода парсером.
 */
internalRouter.get("/fb-groups", requireInternalKey, async (_req, res) => {
  const { data, error } = await supabase.from("fb_groups").select("*").eq("active", true);
  if (error) return res.status(500).json({ error: "db_error" });
  res.json({ groups: data });
});

internalRouter.post("/fb-groups/:id/checked", requireInternalKey, async (req, res) => {
  const { error } = await supabase
    .from("fb_groups")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("id", req.params.id);
  if (error) return res.status(500).json({ error: "db_error" });
  res.json({ ok: true });
});
