import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
import { listMatchViews } from "@/lib/server/match-view";

const scopeSchema = z.object({ load: z.string().uuid().optional(), offer: z.string().uuid().optional() });

/** GET /api/matches[?load=<id>|?offer=<id>] — пары пользователя; контакты контрагента скрыты до подтверждения. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const scope = scopeSchema.safeParse({ load: url.searchParams.get("load") ?? undefined, offer: url.searchParams.get("offer") ?? undefined });
  if (!scope.success) return json({ error: "invalid_input" }, 400);

  const matches = await listMatchViews(auth.user.id, { loadId: scope.data.load, offerId: scope.data.offer });
  return json({ matches });
}
