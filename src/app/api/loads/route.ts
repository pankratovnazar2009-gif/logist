import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { authUserId, json, unauthorized } from "@/lib/server/http";
import { matchAndNotifyForLoad } from "@/lib/server/matching";

const SAFE_TOKEN = /^[A-Za-z0-9_-]+$/;

/**
 * GET /api/loads — лента: у логиста его собственные грузы, у перевозчика — открытые грузы,
 * отфильтрованные по его направлениям и кузову (если профиль заполнен).
 */
export async function GET(req: Request) {
  const userId = authUserId(req);
  if (!userId) return unauthorized();

  const supabase = db();
  const { data: viewer } = await supabase
    .from("users")
    .select("role, truck_types, preferred_routes")
    .eq("id", userId)
    .single();
  if (!viewer) return json({ error: "user_not_found" }, 404);

  if (viewer.role === "logist") {
    const { data: loads, error } = await supabase
      .from("loads")
      .select("*")
      .eq("logist_id", userId)
      .order("created_at", { ascending: false });
    if (error) return json({ error: "db_error" }, 500);
    return json({ loads });
  }

  const regions = (viewer.preferred_routes ?? []).filter((r: string) => SAFE_TOKEN.test(r));
  const truckTypes = (viewer.truck_types ?? []).filter((t: string) => SAFE_TOKEN.test(t));

  let query = supabase.from("loads").select("*").in("status", ["active", "matched"]);
  if (regions.length > 0) {
    query = query.or(`origin_region.in.(${regions.join(",")}),destination_region.in.(${regions.join(",")})`);
  }
  if (truckTypes.length > 0) {
    query = query.in("truck_required", truckTypes);
  }
  const { data: loads, error } = await query.order("created_at", { ascending: false }).limit(50);
  if (error) return json({ error: "db_error" }, 500);
  return json({ loads });
}

const directLoadSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  origin_region: z.string().optional(),
  destination_region: z.string().optional(),
  truck_required: z.string().optional(),
  price: z.string().optional(),
  contact_info: z.string().optional(),
});

/** POST /api/loads — логист добавляет груз напрямую в приложении (source='direct'). */
export async function POST(req: Request) {
  const userId = authUserId(req);
  if (!userId) return unauthorized();

  const parsed = directLoadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_input", details: parsed.error.flatten() }, 400);

  const { data: load, error } = await db()
    .from("loads")
    .insert({ ...parsed.data, source: "direct", logist_id: userId })
    .select("*")
    .single();
  if (error || !load) return json({ error: "db_error" }, 500);

  after(async () => {
    try {
      await matchAndNotifyForLoad(load.id);
    } catch (err) {
      console.error("matchAndNotifyForLoad failed", err);
    }
  });

  return json({ load }, 201);
}
