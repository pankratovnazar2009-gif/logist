import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
import type { Load } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/loads/:id — карточка груза. Владелец видит всё. Остальным: груз из FB (данные публичны) — целиком;
 * груз из приложения — только если у них есть пара с этим грузом, и без контакта: он раскрывается через /api/matches.
 */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = db();
  const { data: load } = await supabase.from("loads").select("*").eq("id", id).maybeSingle<Load>();
  if (!load) return json({ error: "load_not_found" }, 404);

  if (load.logist_id === auth.user.id || load.source === "facebook") return json({ load });

  const { data: myOffers } = await supabase.from("carrier_offers").select("id").eq("carrier_id", auth.user.id);
  const offerIds = (myOffers ?? []).map((o) => o.id);
  const { count } = offerIds.length
    ? await supabase.from("match_requests").select("id", { count: "exact", head: true }).eq("load_id", id).in("offer_id", offerIds)
    : { count: 0 };
  if (!count) return json({ error: "forbidden" }, 403);

  return json({ load: { ...load, contact_info: null } });
}

/** DELETE /api/loads/:id — логист снимает груз; открытые пары закрываются. Подтверждённую сделку снять нельзя. */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireUser(req, "logist");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = db();
  const { data: cancelled, error } = await supabase
    .from("loads")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("logist_id", auth.user.id)
    .in("status", ["active", "matched"])
    .select("id");
  if (error) return json({ error: "db_error" }, 500);
  if (!cancelled?.length) return json({ error: "not_cancellable" }, 409);

  await supabase
    .from("match_requests")
    .update({ status: "closed", closed_reason: "cancelled", updated_at: new Date().toISOString() })
    .eq("load_id", id)
    .in("status", ["pending", "requested"]);
  return json({ ok: true });
}
