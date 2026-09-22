import { db } from "@/lib/server/db";
import { isInternalRequest, json, unauthorized } from "@/lib/server/http";
import { notifyOwnerToAskOutcome, sendMatchNotifications, type PendingNotification } from "@/lib/server/notifications";

const ASK_AFTER_HOURS = 24;

/**
 * POST /api/internal/collect-outcomes — вызывается воркфлоу n8n по расписанию (раз в час).
 * Находит пары, подтверждённые ≥24 часа назад, и спрашивает результат один раз: перевозчика — SMS со
 * ссылкой на страницу пары («состоялось / нет»), владельца — напоминание спросить заказчика из FB вручную.
 */
export async function POST(req: Request) {
  if (!isInternalRequest(req)) return unauthorized();

  const supabase = db();
  const cutoff = new Date(Date.now() - ASK_AFTER_HOURS * 3600 * 1000).toISOString();

  const { data: due, error } = await supabase
    .from("match_requests")
    .select("id, updated_at, outcome_asked_at, load:loads(source, source_url, origin, destination, origin_region, destination_region), offer:carrier_offers(carrier_id)")
    .eq("status", "confirmed")
    .eq("outcome", "unknown")
    .is("outcome_asked_at", null)
    .lte("updated_at", cutoff)
    .limit(200);
  if (error) {
    console.error("collect-outcomes query failed", error);
    return json({ error: "db_error" }, 500);
  }
  if (!due || due.length === 0) return json({ asked: 0 });

  const ids = due.map((m) => m.id as string);
  // Помечаем ДО отправки — повторный запуск в том же часу (если первый ещё выполняется) не спросит дважды.
  await supabase.from("match_requests").update({ outcome_asked_at: new Date().toISOString() }).in("id", ids);

  const carrierNotifications: PendingNotification[] = [];
  let ownerReminders = 0;
  for (const m of due) {
    const load = m.load as unknown as { source: string; source_url: string | null; origin: string | null; destination: string | null; origin_region: string | null; destination_region: string | null };
    const offer = m.offer as unknown as { carrier_id: string | null };
    const route = `${load.origin ?? load.origin_region ?? "?"} → ${load.destination ?? load.destination_region ?? "?"}`;

    if (offer.carrier_id) carrierNotifications.push({ matchId: m.id as string, userId: offer.carrier_id, kind: "outcome_request", route });
    if (load.source === "facebook") {
      await notifyOwnerToAskOutcome(route, load.source_url);
      ownerReminders += 1;
    }
  }
  await sendMatchNotifications(carrierNotifications);

  return json({ asked: due.length, carrierSms: carrierNotifications.length, ownerReminders });
}
