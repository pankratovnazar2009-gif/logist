import { z } from "zod";
import { db } from "@/lib/server/db";
import { json, signAppToken } from "@/lib/server/http";

const OTP_MAX_ATTEMPTS = 5;

const bodySchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{9,15}$/),
  code: z.string().length(6),
});

/** POST /api/auth/otp/verify { phone, code } — проверяет код, создаёт/находит юзера, выдаёт JWT. */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_input" }, 400);
  const { phone, code } = parsed.data;

  const supabase = db();
  const { data: otp } = await supabase
    .from("otp_codes")
    .select("*")
    .eq("phone", phone)
    .is("verified_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp) return json({ error: "no_pending_code" }, 400);
  if (new Date(otp.expires_at).getTime() < Date.now()) return json({ error: "code_expired" }, 400);
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return json({ error: "too_many_attempts" }, 429);

  if (otp.code !== code) {
    await supabase.from("otp_codes").update({ attempts: otp.attempts + 1 }).eq("id", otp.id);
    return json({ error: "wrong_code" }, 400);
  }

  await supabase.from("otp_codes").update({ verified_at: new Date().toISOString() }).eq("id", otp.id);

  let { data: user } = await supabase.from("users").select("*").eq("phone", phone).maybeSingle();
  if (!user) {
    const { data: created, error } = await supabase.from("users").insert({ phone }).select("*").single();
    if (error) return json({ error: "db_error" }, 500);
    user = created;
  }

  return json({ token: signAppToken(user.id), user });
}
