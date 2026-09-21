"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { homePath } from "@/lib/routes";

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!user.role) {
      router.replace("/onboarding");
    } else {
      router.replace(homePath(user.role));
    }
  }, [loading, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-[var(--color-text-muted)]">Ładowanie…</p>
    </div>
  );
}
