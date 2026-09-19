import { db } from "@/lib/server/db";
import { isInternalRequest, json, unauthorized } from "@/lib/server/http";

/** GET /api/internal/fb-groups — активные группы для обхода парсером. */
export async function GET(req: Request) {
  if (!isInternalRequest(req)) return unauthorized();

  const { data, error } = await db().from("fb_groups").select("*").eq("active", true);
  if (error) return json({ error: "db_error" }, 500);
  return json({ groups: data });
}
