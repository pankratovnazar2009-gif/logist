import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { lookupCompanyByNip } from "@/lib/server/gus";
import { authUserId, json, unauthorized } from "@/lib/server/http";
import { profileUpdateSchema } from "@/lib/server/schemas";

/**
 * PATCH /api/users/me — правка профиля. NIP проверяется в GUS: при успехе фирма помечается подтверждённой
 * (название берётся из реестра и вручную не меняется). Кузов и направления — только у перевозчика.
 */
export async function PATCH(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const parsed = profileUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
  const { nip, company_name, truck_types, preferred_routes, ...plain } = parsed.data;

  const patch: Record<string, unknown> = { ...plain };
  let finalNip = auth.user.nip;

  if (nip === null) {
    patch.nip = null;
    finalNip = null;
  } else if (nip !== undefined && nip !== auth.user.nip) {
    const company = await lookupCompanyByNip(nip).catch((err) => {
      console.error("GUS lookup failed", err);
      return null;
    });
    if (!company) return json({ error: "nip_not_found" }, 422);
    patch.nip = nip;
    patch.company_name = company.name;
    finalNip = nip;
  }

  if (company_name !== undefined && !finalNip) patch.company_name = company_name;
  if (auth.user.role === "carrier") {
    if (truck_types) patch.truck_types = truck_types;
    if (preferred_routes) patch.preferred_routes = preferred_routes;
  }
  if (Object.keys(patch).length === 0) return json({ user: auth.user });

  const { data: user, error } = await db().from("users").update(patch).eq("id", auth.user.id).select("*").single();
  if (error) {
    console.error("profile update failed", error);
    return json({ error: "db_error" }, 500);
  }
  return json({ user });
}

export async function GET(req: Request) {
  const userId = authUserId(req);
  if (!userId) return unauthorized();

  const { data: user, error } = await db().from("users").select("*").eq("id", userId).single();
  if (error || !user) return json({ error: "user_not_found" }, 404);
  return json({ user });
}
