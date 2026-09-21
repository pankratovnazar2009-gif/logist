"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { regionOptions, truckOptions } from "@/lib/i18n/options";
import { useI18n } from "@/lib/i18n/provider";
import { homePath } from "@/lib/routes";
import type { UserRole } from "@/lib/types";
import { ChipGroup } from "@/components/chip-group";

export default function OnboardingPage() {
  const { user, loading, refreshUser } = useAuth();
  const { m } = useI18n();
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return null;

  const done = (target: UserRole) => async () => {
    await refreshUser();
    router.replace(homePath(target));
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight mb-2">{m.onboarding.title}</h1>
        <p className="text-[var(--color-text-muted)] mb-6">{m.onboarding.subtitle}</p>

        {!role && (
          <div className="grid grid-cols-1 gap-3">
            <RoleCard title={m.onboarding.logistTitle} subtitle={m.onboarding.logistSubtitle} onClick={() => setRole("logist")} />
            <RoleCard title={m.roles.carrier} subtitle={m.onboarding.carrierSubtitle} onClick={() => setRole("carrier")} />
          </div>
        )}

        {role === "logist" && <LogistProfileForm onDone={done("logist")} onBack={() => setRole(null)} />}
        {role === "carrier" && <CarrierProfileForm onDone={done("carrier")} onBack={() => setRole(null)} />}
      </div>
    </div>
  );
}

function RoleCard({ title, subtitle, onClick }: { title: string; subtitle: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card text-left flex flex-col gap-1 hover:border-[var(--color-accent)]">
      <span className="font-semibold text-lg">{title}</span>
      <span className="text-sm text-[var(--color-text-muted)]">{subtitle}</span>
    </button>
  );
}

function LogistProfileForm({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { m } = useI18n();
  const [nip, setNip] = useState("");
  const [company, setCompany] = useState<{ name: string; city: string | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCompany(null);
    if (!/^\d{10}$/.test(nip)) return;
    const t = setTimeout(async () => {
      setChecking(true);
      setError(null);
      try {
        const { company } = await api.lookupNip(nip);
        setCompany({ name: company.name, city: company.city });
      } catch {
        setError(m.onboarding.nipNotFound);
      } finally {
        setChecking(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [nip, m]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.saveProfile({ role: "logist", nip });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError && err.code === "nip_not_found" ? m.onboarding.nipNotFound : m.onboarding.saveFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
      <div>
        <label className="field-label" htmlFor="nip">
          {m.onboarding.nip}
        </label>
        <input
          id="nip"
          className="input mono"
          inputMode="numeric"
          maxLength={10}
          placeholder="1234563218"
          value={nip}
          onChange={(e) => setNip(e.target.value.replace(/\D/g, ""))}
          required
        />
      </div>
      {checking && <p className="text-sm text-[var(--color-text-muted)]">{m.onboarding.gusChecking}</p>}
      {company && (
        <div className="badge badge-success w-fit">
          {company.name}
          {company.city ? `, ${company.city}` : ""}
        </div>
      )}
      {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
      <div className="flex gap-3">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          {m.onboarding.back}
        </button>
        <button type="submit" className="btn btn-primary flex-1" disabled={submitting || !company}>
          {submitting ? m.onboarding.saving : m.onboarding.saveContinue}
        </button>
      </div>
    </form>
  );
}

function CarrierProfileForm({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { m } = useI18n();
  const [truckTypes, setTruckTypes] = useState<string[]>([]);
  const [routes, setRoutes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.saveProfile({ role: "carrier", truck_types: truckTypes, preferred_routes: routes });
      onDone();
    } catch {
      setError(m.onboarding.saveFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-5">
      <ChipGroup label={m.onboarding.bodyType} options={truckOptions(m)} selected={truckTypes} onChange={setTruckTypes} />
      <ChipGroup label={m.onboarding.directions} options={regionOptions(m)} selected={routes} onChange={setRoutes} />
      {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
      <div className="flex gap-3">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          {m.onboarding.back}
        </button>
        <button type="submit" className="btn btn-primary flex-1" disabled={submitting || truckTypes.length === 0 || routes.length === 0}>
          {submitting ? m.onboarding.saving : m.onboarding.saveContinue}
        </button>
      </div>
    </form>
  );
}
