"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n/provider";
import { UserMenu } from "./user-menu";
import { Wordmark } from "./wordmark";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { m } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  // У каждой роли свой главный список; профиль и настройки — в меню аватара.
  const links = user?.role === "logist" ? [{ href: "/loads", label: m.nav.loads }] : user?.role === "carrier" ? [{ href: "/offers", label: m.nav.trips }] : [];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/" className="text-lg" aria-label={m.brand.home}>
              <Wordmark />
            </Link>
            <nav aria-label={m.nav.label} className="flex items-center gap-5">
              {links.map((link) => (
                <Link key={link.href} href={link.href} className="nav-link" aria-current={pathname.startsWith(link.href) ? "page" : undefined}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          {user && (
            <UserMenu
              user={user}
              onLogout={() => {
                logout();
                router.push("/login");
              }}
            />
          )}
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
