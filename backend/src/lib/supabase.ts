import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// service_role key — используется только на backend, никогда не отдаём фронтенду.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
