import { Router } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase";
import { requireAuth } from "../middleware/requireAuth";
import { lookupCompanyByNip } from "../services/gus";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, async (req, res) => {
  const { data: user, error } = await supabase.from("users").select("*").eq("id", req.userId).single();
  if (error || !user) return res.status(404).json({ error: "user_not_found" });
  res.json({ user });
});

const profileSchema = z.object({
  role: z.enum(["logist", "carrier"]),
  nip: z.string().length(10).optional(),
  truck_types: z.array(z.string()).optional(),
  preferred_routes: z.array(z.string()).optional(),
});

/**
 * POST /api/users/me/profile
 * Онбординг: выбор роли + профиль. Для логиста с NIP — подтягиваем название фирмы из GUS.
 */
usersRouter.post("/me/profile", requireAuth, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  const { role, nip, truck_types, preferred_routes } = parsed.data;

  const update: Record<string, unknown> = { role };

  if (role === "logist" && nip) {
    const company = await lookupCompanyByNip(nip).catch((err) => {
      console.error("GUS lookup failed", err);
      return null;
    });
    if (!company) return res.status(422).json({ error: "nip_not_found" });
    update.nip = nip;
    update.company_name = company.name;
  }

  if (role === "carrier") {
    if (truck_types) update.truck_types = truck_types;
    if (preferred_routes) update.preferred_routes = preferred_routes;
  }

  const { data: user, error } = await supabase
    .from("users")
    .update(update)
    .eq("id", req.userId)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: "db_error" });
  res.json({ user });
});
