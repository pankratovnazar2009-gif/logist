"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import type { Load } from "@/lib/types";

export default function LoadsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [loads, setLoads] = useState<Load[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) return router.replace("/login");
    if (!user.role) return router.replace("/onboarding");

    api
      .listLoads()
      .then(({ loads }) => setLoads(loads))
      .catch(() => setError("Nie udało się pobrać listy."));
  }, [loading, user, router]);

  if (loading || !user?.role) return null;

  const isLogist = user.role === "logist";

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">
          {isLogist ? "Twoje zlecenia" : "Dopasowane ładunki"}
        </h1>
        {isLogist && (
          <Link href="/loads/new" className="btn btn-primary">
            + Dodaj ładunek
          </Link>
        )}
      </div>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
      {loads === null && !error && <p className="text-[var(--color-text-muted)]">Ładowanie…</p>}
      {loads?.length === 0 && (
        <p className="text-[var(--color-text-muted)]">
          {isLogist ? "Nie masz jeszcze żadnych zleceń." : "Na razie brak ładunków pasujących do Twojego profilu."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {loads?.map((load) => (
          <LoadCard key={load.id} load={load} />
        ))}
      </div>
    </AppShell>
  );
}

function LoadCard({ load }: { load: Load }) {
  return (
    <Link href={`/loads/${load.id}`} className="card flex items-center justify-between gap-4 hover:border-[var(--color-accent)]">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="font-semibold truncate">
          {load.origin ?? "?"} → {load.destination ?? "?"}
        </div>
        <div className="flex gap-2 text-sm text-[var(--color-text-muted)]">
          {load.truck_required && <span className="mono">{load.truck_required}</span>}
          {load.price && <span className="mono">{load.price}</span>}
        </div>
      </div>
      <StatusBadge status={load.status} />
    </Link>
  );
}

function StatusBadge({ status }: { status: Load["status"] }) {
  if (status === "active") return <span className="badge badge-accent">aktywne</span>;
  if (status === "matched") return <span className="badge badge-success">dopasowane</span>;
  return <span className="badge badge-warning">wygasłe</span>;
}
