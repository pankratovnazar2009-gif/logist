import { db } from "@/lib/server/db";
import { authUserId, json, unauthorized } from "@/lib/server/http";

/** GET /api/loads/:id — карточка груза (сюда ведёт ссылка из SMS); доступна перевозчикам и владельцу-логисту. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = authUserId(req);
  if (!userId) return unauthorized();

  const { id } = await params;
  const supabase = db();

  const { data: load, error } = await supabase.from("loads").select("*").eq("id", id).single();
  if (error || !load) return json({ error: "load_not_found" }, 404);

  const { data: viewer } = await supabase.from("users").select("role").eq("id", userId).single();
  const isOwner = load.logist_id === userId;
  if (!isOwner && viewer?.role !== "carrier") return json({ error: "forbidden" }, 403);

  return json({ load });
}
