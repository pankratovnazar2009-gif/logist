/** Размер стороны итоговой квадратной аватарки; больше в интерфейсе не нужно. */
const AVATAR_SIZE = 256;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;

export type PhotoError = "not_image" | "too_large" | "unreadable";

export class PhotoRejected extends Error {
  constructor(public reason: PhotoError) {
    super(reason);
  }
}

/**
 * Берёт любое фото, вырезает по центру квадрат и сжимает до JPEG 256×256 (около 30 КБ).
 * Поворот по EXIF учитывается браузером при декодировании.
 */
export async function photoToAvatarJpeg(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new PhotoRejected("not_image");
  if (file.size > MAX_SOURCE_BYTES) throw new PhotoRejected("too_large");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoRejected("unreadable");
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new PhotoRejected("unreadable");
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new PhotoRejected("unreadable");
  return blob;
}
