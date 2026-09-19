import { z } from "zod";
import { db } from "@/lib/server/db";
import { json, signAppToken } from "@/lib/server/http";

/**
 * POST /api/auth/google { supabaseAccessToken }
 * Фронтенд логинит логиста через Supabase Auth (Google OAuth) и присылает access token;
 * проверяем его через Supabase и связываем/создаём запись в users.
 */
export async function POST(req: Request) {
  const parsed = z.object({ supabaseAccessToken: z.string().min(10) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_input" }, 400);

  const supabase = db();
  const { data: authData, error: authError } = await supabase.auth.getUser(parsed.data.supabaseAccessToken);
  if (authError || !authData?.user) return json({ error: "invalid_supabase_token" }, 401);

  const authUserId = authData.user.id;
  let { data: user } = await supabase.from("users").select("*").eq("auth_user_id", authUserId).maybeSingle();
  if (!user) {
    const { data: created, error } = await supabase
      .from("users")
      .insert({ auth_user_id: authUserId, role: "logist" })
      .select("*")
      .single();
    if (error) return json({ error: "db_error" }, 500);
    user = created;
  }

  return json({ token: signAppToken(user.id), user });
}
