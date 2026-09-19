import { lookupCompanyByNip } from "@/lib/server/gus";
import { authUserId, json, unauthorized } from "@/lib/server/http";

/** GET /api/nip/:nip — предпросмотр данных фирмы из GUS до сохранения профиля. */
export async function GET(req: Request, { params }: { params: Promise<{ nip: string }> }) {
  if (!authUserId(req)) return unauthorized();

  const { nip } = await params;
  if (!/^\d{10}$/.test(nip)) return json({ error: "invalid_nip" }, 400);

  const company = await lookupCompanyByNip(nip).catch((err) => {
    console.error("GUS lookup failed", err);
    return null;
  });
  if (!company) return json({ error: "nip_not_found" }, 404);
  return json({ company });
}
