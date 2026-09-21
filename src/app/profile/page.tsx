"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { profileCompleteness } from "@/lib/profile";
import { useRoleGuard } from "@/lib/use-role-guard";
import { AppShell } from "@/components/app-shell";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileForm } from "@/components/profile/profile-form";

export default function ProfilePage() {
  const user = useRoleGuard();
  const { logout } = useAuth();
  const router = useRouter();
  if (!user) return null;

  const { percent, missing } = profileCompleteness(user);

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-2xl">
        <div className="flex flex-col gap-4">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">Twój profil</h1>
          <AvatarUploader user={user} />
          <div className="flex flex-col gap-2">
            <div
              role="progressbar"
              aria-label="Uzupełnienie profilu"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-1 w-full overflow-hidden"
              style={{ background: "var(--color-surface-muted)", borderRadius: "var(--radius-sm)" }}
            >
              <div className="h-full" style={{ width: `${percent}%`, background: "var(--color-accent)", transition: "width var(--duration-layout) var(--ease-standard)" }} />
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              {missing.length === 0 ? "Profil uzupełniony — druga strona zobaczy komplet danych po potwierdzeniu." : `Uzupełniony w ${percent}%. Brakuje: ${missing.join(", ")}.`}
            </p>
          </div>
        </div>

        <ProfileForm user={user} />

        <div className="border-t border-[var(--color-border)] pt-6">
          <button
            type="button"
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
    </AppShell>
  );
}
