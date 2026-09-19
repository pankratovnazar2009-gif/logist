import { Router } from "express";
import { randomInt } from "crypto";
import { z } from "zod";
import { supabase } from "../lib/supabase";
import { sendSms } from "../services/sms";
import { signAppToken } from "../lib/jwt";

export const authRouter = Router();

const phoneSchema = z.string().regex(/^\+?[0-9]{9,15}$/, "invalid_phone");

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

/**
 * POST /api/auth/otp/request { phone }
 * Генерирует 6-значный код, шлёт SMS. Не раскрывает, существует ли уже такой юзер.
 */
authRouter.post("/otp/request", async (req, res) => {
  const parsed = z.object({ phone: phoneSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_phone" });
  const { phone } = parsed.data;

  const { data: recent } = await supabase
    .from("otp_codes")
    .select("created_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent && Date.now() - new Date(recent.created_at).getTime() < OTP_RESEND_COOLDOWN_MS) {
    return res.status(429).json({ error: "too_many_requests" });
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const { error } = await supabase.from("otp_codes").insert({
    phone,
    code,
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });
  if (error) return res.status(500).json({ error: "db_error" });

  try {
    await sendSms(phone, `Twój kod logowania: ${code} (ważny 5 minut)`);
  } catch (err) {
    console.error("sendSms failed", err);
    return res.status(502).json({ error: "sms_send_failed" });
  }

  res.json({ ok: true });
});

/**
 * POST /api/auth/otp/verify { phone, code }
 * Проверяет код, создаёт/находит юзера, выдаёт наш JWT.
 */
authRouter.post("/otp/verify", async (req, res) => {
  const parsed = z.object({ phone: phoneSchema, code: z.string().length(6) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const { phone, code } = parsed.data;

  const { data: otp } = await supabase
    .from("otp_codes")
    .select("*")
    .eq("phone", phone)
    .is("verified_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp) return res.status(400).json({ error: "no_pending_code" });
  if (new Date(otp.expires_at).getTime() < Date.now()) return res.status(400).json({ error: "code_expired" });
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return res.status(429).json({ error: "too_many_attempts" });

  if (otp.code !== code) {
    await supabase.from("otp_codes").update({ attempts: otp.attempts + 1 }).eq("id", otp.id);
    return res.status(400).json({ error: "wrong_code" });
  }

  await supabase.from("otp_codes").update({ verified_at: new Date().toISOString() }).eq("id", otp.id);

  let { data: user } = await supabase.from("users").select("*").eq("phone", phone).maybeSingle();
  if (!user) {
    const { data: created, error } = await supabase.from("users").insert({ phone }).select("*").single();
    if (error) return res.status(500).json({ error: "db_error" });
    user = created;
  }

  const token = signAppToken({ userId: user.id });
  res.json({ token, user });
});

/**
 * POST /api/auth/google { supabaseAccessToken }
 * Фронтенд логинит логиста через Supabase Auth (signInWithOAuth google) и присылает нам
 * полученный access token; мы проверяем его через Supabase и связываем/создаём users-запись.
 */
authRouter.post("/google", async (req, res) => {
  const parsed = z.object({ supabaseAccessToken: z.string().min(10) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

  const { data: authData, error: authError } = await supabase.auth.getUser(parsed.data.supabaseAccessToken);
  if (authError || !authData?.user) return res.status(401).json({ error: "invalid_supabase_token" });

  const authUserId = authData.user.id;
  let { data: user } = await supabase.from("users").select("*").eq("auth_user_id", authUserId).maybeSingle();
  if (!user) {
    const { data: created, error } = await supabase
      .from("users")
      .insert({ auth_user_id: authUserId, role: "logist" })
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: "db_error" });
    user = created;
  }

  const token = signAppToken({ userId: user.id });
  res.json({ token, user });
});
