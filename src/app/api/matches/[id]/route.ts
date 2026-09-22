import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
import { getMatchView } from "@/lib/server/match-view";
import { notifyOwnerOfTakenLoad, sendMatchNotifications, type PendingNotification } from "@/lib/server/notifications";
import { matchActionSchema } from "@/lib/server/schemas";
import { otherParty, type MatchAction, type Party } from "@/lib/match-state";

type Params = { params: Promise<{ id: string }> };

const idSchema = z.string().uuid();

const rpcResultSchema = z.union([
  z.object({ ok: z.literal(true), status: z.string() }),
  z.object({ ok: z.literal(false), error: z.string(), reason: z.string().optional() }),
]);

const ERROR_STATUS: Record<string, number> = { not_found: 404, forbidden: 403, invalid_state: 409, closed: 409, not_applicable: 422 };

/** GET /api/matches/:id — пара глазами пользователя. */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return json({ error: "not_found" }, 404);

  const match = await getMatchView(auth.user.id, id.data);
  if (!match) return json({ error: "not_found" }, 404);
  return json({ match });
}

/**
 * POST /api/matches/:id { action } — связаться / подтвердить / отклонить / забрать груз из Facebook.
 * Состояние меняет SQL-функция match_apply в одной транзакции с блокировкой строк, поэтому двойной клик
 * и гонка нескольких перевозчиков за один груз безопасны — блокировка на строке груза решает, кто первый.
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return json({ error: "not_found" }, 404);
  const body = matchActionSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "invalid_input" }, 400);

  const { data, error } = await db().rpc("match_apply", { p_match: id.data, p_user: auth.user.id, p_action: body.data.action });
  if (error) {
    console.error("match_apply failed", error);
    return json({ error: "db_error" }, 500);
  }
  const result = rpcResultSchema.safeParse(data);
  if (!result.success) return json({ error: "db_error" }, 500);
  if (!result.data.ok) {
    return json({ error: result.data.error, reason: result.data.reason ?? null }, ERROR_STATUS[result.data.error] ?? 400);
  }

  const match = await getMatchView(auth.user.id, id.data);
  if (!match) return json({ error: "not_found" }, 404);

  if (body.data.action === "take") {
    after(() => notifyForTake(id.data));
  } else {
    const notification = await notificationFor(id.data, body.data.action, match.viewer);
    if (notification) after(() => sendMatchNotifications([notification]));
  }

  return json({ match });
}

/** Кому и что сообщить после действия: запрос → второй стороне, подтверждение → тому, кто просил. */
async function notificationFor(matchId: string, action: MatchAction, actor: Party): Promise<PendingNotification | null> {
  if (action === "decline") return null;

  const { data: row } = await db()
    .from("match_requests")
    .select("requested_by, load:loads(logist_id, origin, destination, origin_region, destination_region), offer:carrier_offers(carrier_id)")
    .eq("id", matchId)
    .maybeSingle();
  if (!row) return null;

  const load = row.load as unknown as { logist_id: string | null; origin: string | null; destination: string | null; origin_region: string | null; destination_region: string | null };
  const offer = row.offer as unknown as { carrier_id: string | null };
  const recipientParty: Party = action === "request" ? otherParty(actor) : (row.requested_by as Party);
  const userId = recipientParty === "logist" ? load.logist_id : offer.carrier_id;
  if (!userId) return null;

  return {
    matchId,
    userId,
    kind: action === "request" ? "requested" : "confirmed",
    route: `${load.origin ?? load.origin_region ?? "?"} → ${load.destination ?? load.destination_region ?? "?"}`,
  };
}

/**
 * После «take»: конкурирующим перевозчикам — «груз ушёл» (через обычный дедуп по match_notifications),
 * владельцу — контакт выигравшего перевозчика и ссылка на пост, чтобы написать заказчику в Facebook.
 * Владельца уведомляем не больше раза на пару — atomic UPDATE ... WHERE owner_notified_at IS NULL решает,
 * кому из параллельных попыток «повезло» отправить SMS, даже если это тот же перевозчик, дважды нажавший.
 */
async function notifyForTake(matchId: string): Promise<void> {
  const supabase = db();
  const { data: match } = await supabase
    .from("match_requests")
    .select(
      "load_id, offer_id, load:loads(source, source_url, origin, destination, origin_region, destination_region), offer:carrier_offers(carrier_id, source, source_url)",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return;

  const load = match.load as unknown as { source: string; source_url: string | null; origin: string | null; destination: string | null; origin_region: string | null; destination_region: string | null };
  const offer = match.offer as unknown as { carrier_id: string | null; source: string; source_url: string | null };
  const route = `${load.origin ?? load.origin_region ?? "?"} → ${load.destination ?? load.destination_region ?? "?"}`;

  const { data: siblings } = await supabase
    .from("match_requests")
    .select("id, offer:carrier_offers(carrier_id)")
    .eq("load_id", match.load_id)
    .eq("status", "closed")
    .eq("closed_reason", "load_taken")
    .neq("id", matchId);
  const losers: PendingNotification[] = (siblings ?? [])
    .map((s) => ({ id: s.id as string, carrierId: (s.offer as unknown as { carrier_id: string | null }).carrier_id }))
    .filter((s): s is { id: string; carrierId: string } => Boolean(s.carrierId))
    .map((s) => ({ matchId: s.id, userId: s.carrierId, kind: "load_taken", route }));
  if (losers.length > 0) await sendMatchNotifications(losers);

  if (load.source !== "facebook") return; // «take» для FB-предложения (устаревшие данные) — владельцу писать некому

  const { data: claimed } = await supabase.from("match_requests").update({ owner_notified_at: new Date().toISOString() }).eq("id", matchId).is("owner_notified_at", null).select("id");
  if (!claimed || claimed.length === 0) return; // уже уведомляли по этой паре

  const carrierId = offer.carrier_id;
  const { data: carrier } = carrierId ? await supabase.from("users").select("full_name, phone").eq("id", carrierId).maybeSingle() : { data: null };
  await notifyOwnerOfTakenLoad({ route, sourceUrl: load.source_url, carrierName: carrier?.full_name ?? null, carrierPhone: carrier?.phone ?? null });
}
