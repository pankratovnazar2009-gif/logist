"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <Link href="/loads" className="font-[family-name:var(--font-display)] text-lg font-extrabold tracking-tight">
            Logist<span style={{ color: "var(--color-accent)" }}>.</span>
          </Link>
          <div className="flex items-center gap-3">
            {user?.role && (
              <span className="badge badge-accent">{user.role === "logist" ? "Logist" : "Przewoźnik"}</span>
            )}
            <button
              className="btn btn-ghost"
              onClick={() => {
                logout();
                router.push("/login");
              }}
            >
              Wyloguj
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
