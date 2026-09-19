import { db } from "@/lib/server/db";
import { authUserId, json, unauthorized } from "@/lib/server/http";

export async function GET(req: Request) {
  const userId = authUserId(req);
  if (!userId) return unauthorized();

  const { data: user, error } = await db().from("users").select("*").eq("id", userId).single();
  if (error || !user) return json({ error: "user_not_found" }, 404);
  return json({ user });
}
