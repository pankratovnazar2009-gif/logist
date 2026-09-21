"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "./avatar";
import { Wordmark } from "./wordmark";

/** Разделы шапки: у каждой роли свой главный список; профиль — по аватару. */
const NAV = {
  logist: [{ href: "/loads", label: "Ładunki" }],
  carrier: [{ href: "/offers", label: "Przejazdy" }],
} as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const links = user?.role ? NAV[user.role] : [];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/" className="text-lg" aria-label="Pozna.logist — strona główna">
              <Wordmark />
            </Link>
            <nav aria-label="Główna nawigacja" className="flex items-center gap-5">
              {links.map((link) => (
                <Link key={link.href} href={link.href} className="nav-link" aria-current={pathname.startsWith(link.href) ? "page" : undefined}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          {user && <Avatar url={user.avatar_url} name={user.full_name} size={36} href="/profile" label="Twój profil" />}
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
