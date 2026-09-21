import Link from "next/link";
import { initials } from "@/lib/profile";

interface AvatarProps {
  url: string | null;
  name: string | null;
  /** Сторона круга в пикселях. */
  size?: number;
  /** Если задан — аватар становится ссылкой. */
  href?: string;
  label?: string;
}

export function Avatar({ url, name, size = 40, href, label }: AvatarProps) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  const content = url ? (
    // Фото уже сжато до 256×256 на нашей стороне, оптимизатор изображений здесь не нужен.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} />
  ) : (
    <span aria-hidden="true">{initials(name)}</span>
  );

  if (href) {
    return (
      <Link href={href} className="avatar" style={style} aria-label={label ?? "Profil"}>
        {content}
      </Link>
    );
  }
  return (
    <span className="avatar" style={style} role="img" aria-label={label ?? name ?? "Brak zdjęcia"}>
      {content}
    </span>
  );
}
