"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
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

/** Силуэт для тех, у кого нет ни фото, ни имени: вместо инициалов и, тем более, вместо вопросительного знака. */
function PersonIcon({ size }: { size: number }) {
  return (
    <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.6" fill="currentColor" />
      <path d="M4.5 20c.6-3.7 3.6-5.6 7.5-5.6s6.9 1.9 7.5 5.6" fill="currentColor" />
    </svg>
  );
}

export function Avatar({ url, name, size = 40, href, label }: AvatarProps) {
  const { m } = useI18n();
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  const letters = initials(name);
  const content = url ? (
    // Фото уже сжато до 256×256 на нашей стороне, оптимизатор изображений здесь не нужен.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} />
  ) : letters ? (
    <span aria-hidden="true">{letters}</span>
  ) : (
    <PersonIcon size={size} />
  );

  if (href) {
    return (
      <Link href={href} className="avatar" style={style} aria-label={label ?? m.userMenu.profile}>
        {content}
      </Link>
    );
  }
  return (
    <span className="avatar" style={style} role="img" aria-label={label ?? name ?? m.profile.photoAlt}>
      {content}
    </span>
  );
}
