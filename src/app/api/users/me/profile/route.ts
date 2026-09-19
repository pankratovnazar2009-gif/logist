import { z } from "zod";
import { db } from "@/lib/server/db";
import { lookupCompanyByNip } from "@/lib/server/gus";
import { authUserId, json, unauthorized } from "@/lib/server/http";

const profileSchema = z.object({
  role: z.enum(["logist", "carrier"]),
  nip: z.string().regex(/^\d{10}$/).optional(),
  truck_types: z.array(z.string().regex(/^[A-Za-z0-9_-]+$/)).optional(),
  preferred_routes: z.array(z.string().regex(/^[A-Za-z0-9_-]+$/)).optional(),
});

/** POST /api/users/me/profile — выбор роли + профиль; для логиста с NIP подтягиваем название фирмы из GUS. */
export async function POST(req: Request) {
  const userId = authUserId(req);
  if (!userId) return unauthorized();

  const parsed = profileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
  const { role, nip, truck_types, preferred_routes } = parsed.data;

  const update: Record<string, unknown> = { role };

  if (role === "logist" && nip) {
    const company = await lookupCompanyByNip(nip).catch((err) => {
      console.error("GUS lookup failed", err);
      return null;
    });
    if (!company) return json({ error: "nip_not_found" }, 422);
    update.nip = nip;
    update.company_name = company.name;
  }

  if (role === "carrier") {
    if (truck_types) update.truck_types = truck_types;
    if (preferred_routes) update.preferred_routes = preferred_routes;
  }

  const { data: user, error } = await db().from("users").update(update).eq("id", userId).select("*").single();
  if (error) return json({ error: "db_error" }, 500);
  return json({ user });
}
