import { Router } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase";
import { requireAuth } from "../middleware/requireAuth";
import { matchAndNotifyForLoad } from "../services/matching";

export const loadsRouter = Router();

const SAFE_TOKEN = /^[A-Za-z0-9_-]+$/;

/**
 * GET /api/loads — лента: для логиста его собственные грузы, для перевозчика —
 * активные грузы, отфильтрованные по его направлениям/кузову (если профиль заполнен).
 */
loadsRouter.get("/", requireAuth, async (req, res) => {
  const { data: viewer } = await supabase
    .from("users")
    .select("role, truck_types, preferred_routes")
    .eq("id", req.userId)
    .single();
  if (!viewer) return res.status(404).json({ error: "user_not_found" });

  if (viewer.role === "logist") {
    const { data: loads, error } = await supabase
      .from("loads")
      .select("*")
      .eq("logist_id", req.userId)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: "db_error" });
    return res.json({ loads });
  }

  const regions = (viewer.preferred_routes ?? []).filter((r: string) => SAFE_TOKEN.test(r));
  const truckTypes = (viewer.truck_types ?? []).filter((t: string) => SAFE_TOKEN.test(t));

  let query = supabase.from("loads").select("*").eq("status", "active");
  if (regions.length > 0) {
    query = query.or(`origin_region.in.(${regions.join(",")}),destination_region.in.(${regions.join(",")})`);
  }
  if (truckTypes.length > 0) {
    query = query.in("truck_required", truckTypes);
  }
  const { data: loads, error } = await query.order("created_at", { ascending: false }).limit(50);
  if (error) return res.status(500).json({ error: "db_error" });
  res.json({ loads });
});

loadsRouter.get("/:id", requireAuth, async (req, res) => {
  const { data: load, error } = await supabase.from("loads").select("*").eq("id", req.params.id).single();
  if (error || !load) return res.status(404).json({ error: "load_not_found" });

  const { data: viewer } = await supabase.from("users").select("role").eq("id", req.userId).single();
  const isOwner = load.logist_id === req.userId;
  if (!isOwner && viewer?.role !== "carrier") return res.status(403).json({ error: "forbidden" });

  res.json({ load });
});

const directLoadSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  origin_region: z.string().optional(),
  destination_region: z.string().optional(),
  truck_required: z.string().optional(),
  price: z.string().optional(),
  contact_info: z.string().optional(),
});

/**
 * POST /api/loads — логист добавляет груз напрямую в приложении (source='direct').
 */
loadsRouter.post("/", requireAuth, async (req, res) => {
  const parsed = directLoadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });

  const { data: load, error } = await supabase
    .from("loads")
    .insert({ ...parsed.data, source: "direct", logist_id: req.userId })
    .select("*")
    .single();
  if (error || !load) return res.status(500).json({ error: "db_error" });

  matchAndNotifyForLoad(load.id).catch((err) => console.error("matchAndNotifyForLoad failed", err));
  res.status(201).json({ load });
});
