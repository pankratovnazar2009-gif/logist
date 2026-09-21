import { db } from "./db";
import { appBaseUrl } from "./env";
import { sendSms } from "./sms";

export type NotificationKind = "match" | "requested" | "confirmed";

export interface PendingNotification {
  matchId: string;
  userId: string;
  kind: NotificationKind;
  /** Короткое описание маршрута для текста SMS. */
  route: string;
}

const MESSAGES: Record<NotificationKind, (route: string, url: string) => string> = {
  match: (route, url) => `Logist: znaleziono dopasowanie (${route}). Zobacz w aplikacji: ${url}`,
  requested: (route, url) => `Logist: ktoś chce się połączyć w sprawie ${route}. Potwierdź w aplikacji: ${url}`,
  confirmed: (route, url) => `Logist: połączenie potwierdzone (${route}). Kontakt czeka w aplikacji: ${url}`,
};

/**
 * Шлёт SMS-оповещения. В тексте нет ни телефона, ни имени контрагента — только ссылка на приложение:
 * контакты открываются после подтверждения. Каждое оповещение (пара, получатель, вид) уходит не больше одного раза:
 * запись в match_notifications создаётся ДО отправки, поэтому параллельные вызовы не дублируют SMS.
 * Сбой SMS не роняет вызывающий запрос — он только помечается в журнале.
 */
export async function sendMatchNotifications(items: PendingNotification[]): Promise<void> {
  if (items.length === 0) return;
  const supabase = db();

  const userIds = [...new Set(items.map((i) => i.userId))];
  const { data: users } = await supabase.from("users").select("id, phone").in("id", userIds);
  const phoneById = new Map((users ?? []).map((u) => [u.id as string, u.phone as string | null]));

  for (const item of items) {
    const phone = phoneById.get(item.userId);
    if (!phone) continue;

    const { data: claimed, error } = await supabase
      .from("match_notifications")
      .upsert({ match_id: item.matchId, user_id: item.userId, kind: item.kind, status: "sent" }, { onConflict: "match_id,user_id,kind", ignoreDuplicates: true })
      .select("id");
    if (error || !claimed || claimed.length === 0) continue; // уже отправляли (или журнал недоступен — лучше не слать)

    const url = `${appBaseUrl()}/matches/${item.matchId}`;
    try {
      await sendSms(phone, MESSAGES[item.kind](item.route, url));
    } catch (err) {
      console.error(`SMS to user ${item.userId} for match ${item.matchId} failed`, err);
      await supabase.from("match_notifications").update({ status: "failed" }).eq("id", claimed[0].id);
    }
  }
}
