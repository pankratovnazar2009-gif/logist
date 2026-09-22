import { db } from "./db";
import { appBaseUrl, getEnv } from "./env";
import { sendSms } from "./sms";

export type NotificationKind = "match" | "requested" | "confirmed" | "load_taken" | "outcome_request";

export interface PendingNotification {
  matchId: string;
  userId: string;
  kind: NotificationKind;
  /** Короткое описание маршрута для текста SMS. */
  route: string;
}

const MESSAGES: Record<NotificationKind, (route: string, url: string) => string> = {
  match: (route, url) => `Pozna.logist: nowe dopasowanie (${route}). Zobacz w aplikacji: ${url}`,
  requested: (route, url) => `Pozna.logist: ktoś chce się połączyć w sprawie ${route}. Potwierdź w aplikacji: ${url}`,
  confirmed: (route, url) => `Pozna.logist: połączenie potwierdzone (${route}). Kontakt czeka w aplikacji: ${url}`,
  load_taken: (route) => `Pozna.logist: ładunek ${route} wziął już ktoś inny. Sprawdź inne dopasowania w aplikacji.`,
  outcome_request: (route, url) => `Pozna.logist: czy transport ${route} się odbył? Odpowiedz w aplikacji: ${url}`,
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

/**
 * Сообщает владельцу, что для груза из Facebook нашёлся перевозчик — дальше он сам пишет заказчику в FB
 * (см. README). Не привязано к пользователю приложения, поэтому не через match_notifications: защита от
 * повтора — атомарный UPDATE ... WHERE owner_notified_at IS NULL в вызывающем коде (см. matches/[id]/route.ts).
 * OWNER_NOTIFY_PHONE не задан — шаг просто пропускается, остальное приложение продолжает работать.
 */
export async function notifyOwnerOfTakenLoad(params: { route: string; sourceUrl: string | null; carrierName: string | null; carrierPhone: string | null }): Promise<void> {
  const phone = getEnv().OWNER_NOTIFY_PHONE;
  if (!phone) return;
  const carrier = [params.carrierName, params.carrierPhone].filter(Boolean).join(" ") || "brak danych kontaktowych";
  const text = `Pozna.logist: dla ladunku ${params.route} znalazl sie przewoznik: ${carrier}. Napisz do zleceniodawcy na FB${params.sourceUrl ? `: ${params.sourceUrl}` : "."}`;
  try {
    await sendSms(phone, text);
  } catch (err) {
    console.error("Owner notify failed", err);
  }
}

/** Напоминание владельцу спросить заказчика из FB, состоялась ли перевозка (шаг делается вручную). */
export async function notifyOwnerToAskOutcome(route: string, sourceUrl: string | null): Promise<void> {
  const phone = getEnv().OWNER_NOTIFY_PHONE;
  if (!phone) return;
  const text = `Pozna.logist: minela doba od ${route}. Zapytaj zleceniodawce z FB, czy transport sie odbyl${sourceUrl ? `: ${sourceUrl}` : "."}`;
  try {
    await sendSms(phone, text);
  } catch (err) {
    console.error("Owner outcome reminder failed", err);
  }
}
