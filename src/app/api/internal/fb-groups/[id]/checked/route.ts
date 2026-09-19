import { db } from "@/lib/server/db";
import { isInternalRequest, json, unauthorized } from "@/lib/server/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isInternalRequest(req)) return unauthorized();

  const { id } = await params;
  const { error } = await db().from("fb_groups").update({ last_checked_at: new Date().toISOString() }).eq("id", id);
  if (error) return json({ error: "db_error" }, 500);
  return json({ ok: true });
}
