import { db } from "./db";
import { authUserId, json, unauthorized } from "./http";
import type { AppUser, UserRole } from "../types";

export type AuthResult = { ok: true; user: AppUser } | { ok: false; response: Response };

/** Пользователь из Bearer-токена; при `role` — ещё и проверка роли. Ответ-ошибка готов к возврату из handler'а. */
export async function requireUser(req: Request, role?: UserRole): Promise<AuthResult> {
  const userId = authUserId(req);
  if (!userId) return { ok: false, response: unauthorized() };

  const { data: user } = await db().from("users").select("*").eq("id", userId).maybeSingle<AppUser>();
  if (!user) return { ok: false, response: json({ error: "user_not_found" }, 404) };
  if (role && user.role !== role) return { ok: false, response: json({ error: "forbidden" }, 403) };
  return { ok: true, user };
}

/** Сколько живых пар у каждого объекта (для бейджей в списках). */
export async function countActiveMatches(field: "load_id" | "offer_id", ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;
  const { data } = await db().from("match_requests").select(field).in(field, ids).in("status", ["pending", "requested", "confirmed"]);
  for (const row of (data ?? []) as unknown as Record<string, string>[]) {
    counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);
  }
  return counts;
}
