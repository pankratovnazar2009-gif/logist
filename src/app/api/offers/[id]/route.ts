import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { json } from "@/lib/server/http";

type Params = { params: Promise<{ id: string }> };

/** GET /api/offers/:id — своё предложение. */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireUser(req, "carrier");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { data: offer } = await db().from("carrier_offers").select("*").eq("id", id).eq("carrier_id", auth.user.id).maybeSingle();
  if (!offer) return json({ error: "offer_not_found" }, 404);
  return json({ offer });
}

/** DELETE /api/offers/:id — перевозчик снимает поездку; открытые пары закрываются. Подтверждённую сделку снять нельзя. */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireUser(req, "carrier");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = db();
  const { data: cancelled, error } = await supabase
    .from("carrier_offers")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("carrier_id", auth.user.id)
    .eq("status", "active")
    .select("id");
  if (error) return json({ error: "db_error" }, 500);
  if (!cancelled?.length) return json({ error: "not_cancellable" }, 409);

  await supabase
    .from("match_requests")
    .update({ status: "closed", closed_reason: "cancelled", updated_at: new Date().toISOString() })
    .eq("offer_id", id)
    .in("status", ["pending", "requested"]);
  return json({ ok: true });
}
