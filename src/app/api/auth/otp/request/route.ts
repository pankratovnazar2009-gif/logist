import { randomInt } from "crypto";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { sendSms } from "@/lib/server/sms";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const bodySchema = z.object({ phone: z.string().regex(/^\+?[0-9]{9,15}$/) });

/** POST /api/auth/otp/request { phone } — генерирует 6-значный код и шлёт SMS. */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_phone" }, 400);
  const { phone } = parsed.data;

  const supabase = db();
  const { data: recent } = await supabase
    .from("otp_codes")
    .select("created_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent && Date.now() - new Date(recent.created_at).getTime() < OTP_RESEND_COOLDOWN_MS) {
    return json({ error: "too_many_requests" }, 429);
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const { data: inserted, error } = await supabase
    .from("otp_codes")
    .insert({ phone, code, expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString() })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error("otp insert failed", error);
    return json({ error: "db_error" }, 500);
  }

  try {
    // Раньше здесь была строка «@домен #код» (формат WebOTP — Chrome сам подставляет код), но SMSAPI.pl
    // распознаёт «@домен» как ссылку и блокирует всё сообщение целиком (их ошибка 94 «Not allowed to send
    // messages with link»). Автозаполнение удобнее, но доставка важнее — строку убрали.
    await sendSms(phone, `Pozna.logist: Twój kod logowania ${code}. Ważny 5 minut. Nie podawaj go nikomu.`);
  } catch (err) {
    console.error("sendSms failed", err);
    // Без этого удаления неудачная попытка сама себе перекрывает повтор: следующий запрос в течение
    // минуты упирался бы в «подождите» вместо настоящей причины (провайдер SMS недоступен/без кредитов).
    await supabase.from("otp_codes").delete().eq("id", inserted.id);
    return json({ error: "sms_send_failed" }, 502);
  }

  return json({ ok: true });
}
