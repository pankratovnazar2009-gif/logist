"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { AppUser } from "@/lib/types";
import { Avatar } from "./avatar";

/** Аватар в шапке, по нажатию — панель с профилем, настройками и выходом. Закрывается по Esc и по клику снаружи. */
export function UserMenu({ user, onLogout }: { user: AppUser; onLogout: () => void }) {
  const { m } = useI18n();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (container.current && !container.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={container} className="relative">
      <button
        ref={trigger}
        type="button"
        className="avatar-trigger"
        aria-label={m.userMenu.open}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar url={user.avatar_url} name={user.full_name} size={36} label={user.full_name ?? m.userMenu.open} />
      </button>
      {open && (
        <div id={panelId} className="menu">
          <Link href="/profile" className="menu-item" onClick={() => setOpen(false)}>
            {m.userMenu.profile}
          </Link>
          <Link href="/settings" className="menu-item" onClick={() => setOpen(false)}>
            {m.userMenu.settings}
          </Link>
          <div className="menu-separator" role="separator" />
          <button type="button" className="menu-item" onClick={onLogout}>
            {m.userMenu.logout}
          </button>
        </div>
      )}
    </div>
  );
}
