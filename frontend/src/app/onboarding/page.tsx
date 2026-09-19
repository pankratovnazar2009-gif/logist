"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { ROUTE_OPTIONS, TRUCK_TYPES, type UserRole } from "@/lib/types";

export default function OnboardingPage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight mb-2">
          Kim jesteś?
        </h1>
        <p className="text-[var(--color-text-muted)] mb-6">To ustawia, jakie zlecenia będziesz widzieć.</p>

        {!role && (
          <div className="grid grid-cols-1 gap-3">
            <RoleCard title="Logist / Spedytor" subtitle="Wystawiam ładunki, szukam przewoźnika" onClick={() => setRole("logist")} />
            <RoleCard title="Przewoźnik" subtitle="Szukam ładunków, dostaję SMS o dopasowaniach" onClick={() => setRole("carrier")} />
          </div>
        )}

        {role === "logist" && <LogistProfileForm onDone={async () => { await refreshUser(); router.replace("/loads"); }} onBack={() => setRole(null)} />}
        {role === "carrier" && <CarrierProfileForm onDone={async () => { await refreshUser(); router.replace("/loads"); }} onBack={() => setRole(null)} />}
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
        setError("Nie znaleziono firmy dla tego NIP.");
      } finally {
        setChecking(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [nip]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.saveProfile({ role: "logist", nip });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError && err.code === "nip_not_found" ? "Nie znaleziono firmy dla tego NIP." : "Nie udało się zapisać profilu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
      <div>
        <label className="field-label" htmlFor="nip">
          NIP firmy
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
      {checking && <p className="text-sm text-[var(--color-text-muted)]">Sprawdzanie w GUS…</p>}
      {company && (
        <div className="badge badge-success w-fit">
          {company.name}
          {company.city ? `, ${company.city}` : ""}
        </div>
      )}
      {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
      <div className="flex gap-3">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Wstecz
        </button>
        <button type="submit" className="btn btn-primary flex-1" disabled={submitting || !company}>
          {submitting ? "Zapisywanie…" : "Zapisz i kontynuuj"}
        </button>
      </div>
    </form>
  );
}

function CarrierProfileForm({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [truckTypes, setTruckTypes] = useState<string[]>([]);
  const [routes, setRoutes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.saveProfile({ role: "carrier", truck_types: truckTypes, preferred_routes: routes });
      onDone();
    } catch {
      setError("Nie udało się zapisać profilu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-5">
      <div>
        <p className="field-label">Typ nadwozia</p>
        <div className="flex flex-wrap gap-2">
          {TRUCK_TYPES.map((t) => (
            <Chip key={t.value} label={t.label} active={truckTypes.includes(t.value)} onClick={() => toggle(truckTypes, setTruckTypes, t.value)} />
          ))}
        </div>
      </div>
      <div>
        <p className="field-label">Preferowane kierunki</p>
        <div className="flex flex-wrap gap-2">
          {ROUTE_OPTIONS.map((r) => (
            <Chip key={r.value} label={r.label} active={routes.includes(r.value)} onClick={() => toggle(routes, setRoutes, r.value)} />
          ))}
        </div>
      </div>
      {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
      <div className="flex gap-3">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Wstecz
        </button>
        <button type="submit" className="btn btn-primary flex-1" disabled={submitting || truckTypes.length === 0 || routes.length === 0}>
          {submitting ? "Zapisywanie…" : "Zapisz i kontynuuj"}
        </button>
      </div>
    </form>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="badge"
      style={{
        background: active ? "var(--color-accent)" : "var(--color-surface-muted)",
        color: active ? "var(--color-on-accent)" : "var(--color-text-muted)",
        fontFamily: "var(--font-body)",
        padding: "6px 12px",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
