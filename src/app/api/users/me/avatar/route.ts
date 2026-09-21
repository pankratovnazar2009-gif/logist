import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { json } from "@/lib/server/http";

const BUCKET = "avatars";
const MAX_BYTES = 512 * 1024;

/** Фото профиля всегда JPEG: браузер сжимает его до квадрата 256×256 перед отправкой. Здесь — последняя линия проверки. */
const isJpeg = (bytes: Uint8Array): boolean => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

/** POST /api/users/me/avatar (multipart, поле `file`) — заменяет фото профиля. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return json({ error: "invalid_input" }, 400);
  if (file.size > MAX_BYTES) return json({ error: "file_too_large" }, 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isJpeg(bytes)) return json({ error: "unsupported_type" }, 415);

  const supabase = db();
  const path = `${auth.user.id}.jpg`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: true, cacheControl: "3600" });
  if (uploadError) {
    console.error("avatar upload failed", uploadError);
    return json({ error: "storage_error" }, 502);
  }

  // ?v= сбрасывает кэш браузера и CDN: путь у файла всегда один и тот же.
  const avatarUrl = `${supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  const { data: user, error } = await supabase.from("users").update({ avatar_url: avatarUrl }).eq("id", auth.user.id).select("*").single();
  if (error) return json({ error: "db_error" }, 500);
  return json({ user });
}

/** DELETE /api/users/me/avatar — убирает фото. */
export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const supabase = db();
  const { error: removeError } = await supabase.storage.from(BUCKET).remove([`${auth.user.id}.jpg`]);
  if (removeError) console.error("avatar remove failed", removeError);

  const { data: user, error } = await supabase.from("users").update({ avatar_url: null }).eq("id", auth.user.id).select("*").single();
  if (error) return json({ error: "db_error" }, 500);
  return json({ user });
}
