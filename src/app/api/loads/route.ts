import { after } from "next/server";
import { db } from "@/lib/server/db";
import { countActiveMatches, requireUser } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
import { createMatchesForLoad } from "@/lib/server/matching";
import { sendMatchNotifications } from "@/lib/server/notifications";
import { directLoadSchema, expiresAtFor } from "@/lib/server/schemas";

/** GET /api/loads — грузы логиста с числом живых совпадений. У перевозчика своих грузов нет: он видит совпадения через /api/matches. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  if (auth.user.role !== "logist") return json({ loads: [] });

  const { data: loads, error } = await db()
    .from("loads")
    .select("*")
    .eq("logist_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return json({ error: "db_error" }, 500);

  const counts = await countActiveMatches("load_id", (loads ?? []).map((l) => l.id));
  return json({ loads: (loads ?? []).map((load) => ({ ...load, match_count: counts.get(load.id) ?? 0 })) });
}

/** POST /api/loads — логист добавляет груз; пары с подходящими предложениями создаются сразу, SMS уходят после ответа. */
export async function POST(req: Request) {
  const auth = await requireUser(req, "logist");
  if (!auth.ok) return auth.response;

  const parsed = directLoadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_input", details: parsed.error.flatten() }, 400);

  const { data: load, error } = await db()
    .from("loads")
    .insert({ ...parsed.data, source: "direct", logist_id: auth.user.id, expires_at: expiresAtFor(parsed.data.pickup_date) })
    .select("*")
    .single();
  if (error || !load) return json({ error: "db_error" }, 500);

  // Сбой подбора не должен терять уже созданный груз: его можно доподобрать позже, а вот дубль груза — нет.
  const notifications = await createMatchesForLoad(load.id).catch((err) => {
    console.error("createMatchesForLoad failed", err);
    return [];
  });
  after(() => sendMatchNotifications(notifications));

  return json({ load }, 201);
}
