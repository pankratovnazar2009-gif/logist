"use client";

import { useI18n } from "@/lib/i18n/provider";
import { LOCALES } from "@/lib/i18n/locales";
import { useTheme } from "@/lib/theme";
import { useRoleGuard } from "@/lib/use-role-guard";
import { AppShell } from "@/components/app-shell";
import { OptionGroup } from "@/components/option-group";

export default function SettingsPage() {
  const user = useRoleGuard();
  const { m, locale, setLocale } = useI18n();
  const { preference, setPreference } = useTheme();
  if (!user) return null;

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">{m.settings.title}</h1>

        <section className="card flex flex-col gap-6" aria-labelledby="appearance-heading">
          <h2 id="appearance-heading" className="font-[family-name:var(--font-display)] text-lg font-bold">
            {m.settings.appearance}
          </h2>
          <OptionGroup
            label={m.settings.themeLabel}
            hint={m.settings.themeHint}
            value={preference}
            onChange={setPreference}
            options={[
              { value: "system", label: m.settings.themeSystem },
              { value: "light", label: m.settings.themeLight },
              { value: "dark", label: m.settings.themeDark },
            ]}
          />
          <OptionGroup label={m.settings.languageLabel} hint={m.settings.languageHint} value={locale} onChange={setLocale} options={LOCALES} />
        </section>
      </div>
    </AppShell>
  );
}
