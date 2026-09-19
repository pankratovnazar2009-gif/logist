import { supabase } from "../lib/supabase";
import { sendSms } from "./sms";
import { env } from "../lib/env";

/**
 * Находит перевозчиков, которым подходит груз (совпадение направления и типа кузова),
 * и шлёт им SMS со ссылкой на карточку груза в PWA. Дедуплицируется через
 * notifications_log (load_id, user_id) — повторный вызов для того же груза не спамит.
 */
export async function matchAndNotifyForLoad(loadId: string): Promise<{ notified: number }> {
  const { data: load, error: loadError } = await supabase.from("loads").select("*").eq("id", loadId).single();
  if (loadError || !load) throw new Error(`load ${loadId} not found`);

  const regions = [load.origin_region, load.destination_region].filter(Boolean) as string[];

  let query = supabase.from("users").select("id, phone").eq("role", "carrier");
  if (regions.length > 0) query = query.overlaps("preferred_routes", regions);
  if (load.truck_required) query = query.contains("truck_types", [load.truck_required]);

  const { data: carriers, error: carriersError } = await query;
  if (carriersError) throw carriersError;
  if (!carriers || carriers.length === 0) return { notified: 0 };

  const { data: alreadyNotified } = await supabase
    .from("notifications_log")
    .select("user_id")
    .eq("load_id", loadId);
  const alreadyNotifiedIds = new Set((alreadyNotified ?? []).map((r) => r.user_id));

  const toNotify = carriers.filter((c) => !alreadyNotifiedIds.has(c.id) && c.phone);
  if (toNotify.length === 0) return { notified: 0 };

  const link = `${env.APP_BASE_URL}/loads/${loadId}`;
  const text = `Nowy ładunek ${load.origin ?? "?"} - ${load.destination ?? "?"}${
    load.truck_required ? ` (${load.truck_required})` : ""
  }! Sprawdź szczegóły i kontakt: ${link}`;

  let notified = 0;
  for (const carrier of toNotify) {
    try {
      await sendSms(carrier.phone as string, text);
      await supabase.from("notifications_log").insert({ load_id: loadId, user_id: carrier.id, status: "sent" });
      notified += 1;
    } catch (err) {
      console.error(`Failed to notify carrier ${carrier.id} about load ${loadId}`, err);
      await supabase.from("notifications_log").insert({ load_id: loadId, user_id: carrier.id, status: "failed" });
    }
  }

  if (notified > 0) {
    await supabase.from("loads").update({ status: "matched" }).eq("id", loadId);
  }

  return { notified };
}
