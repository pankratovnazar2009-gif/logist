import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
import { getMatchView } from "@/lib/server/match-view";
import { outcomeSchema } from "@/lib/server/schemas";

type Params = { params: Promise<{ id: string }> };

const idSchema = z.string().uuid();

/**
 * POST /api/matches/:id/outcome { outcome } — «состоялась ли перевозка». Только для своих подтверждённых пар;
 * строит базу проверенных перевозчиков (кто, куда, каким кузовом реально возит — см. README).
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return json({ error: "not_found" }, 404);
  const body = outcomeSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "invalid_input" }, 400);

  // getMatchView уже проверяет, что пара принадлежит пользователю (иначе вернёт null).
  const existing = await getMatchView(auth.user.id, id.data);
  if (!existing) return json({ error: "not_found" }, 404);

  const { data, error } = await db().rpc("match_record_outcome", { p_match: id.data, p_user: auth.user.id, p_outcome: body.data.outcome });
  if (error) {
    console.error("match_record_outcome failed", error);
    return json({ error: "db_error" }, 500);
  }
  const result = z
    .union([z.object({ ok: z.literal(true), outcome: z.string() }), z.object({ ok: z.literal(false), error: z.string() })])
    .safeParse(data);
  if (!result.success) return json({ error: "db_error" }, 500);
  if (!result.data.ok) return json({ error: result.data.error }, result.data.error === "invalid_state" ? 409 : 400);

  const match = await getMatchView(auth.user.id, id.data);
  return json({ match });
}
