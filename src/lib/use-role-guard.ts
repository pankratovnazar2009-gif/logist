"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import { homePath } from "./routes";
import type { AppUser, UserRole } from "./types";

/**
 * Пускает на экран только вошедшего пользователя нужной роли; остальных отправляет на вход, в онбординг или на их главный экран.
 * Возвращает пользователя, когда доступ подтверждён, иначе null (экран в этот момент ничего не рисует).
 */
export function useRoleGuard(required?: UserRole): AppUser | null {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Ссылка из SMS (/matches/…) ведёт на вход, а после входа — обратно на неё.
  const redirectTo = loading ? null : !user ? `/login?next=${encodeURIComponent(pathname)}` : !user.role ? "/onboarding" : required && user.role !== required ? homePath(user.role) : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  return !loading && user?.role && !redirectTo ? user : null;
}
