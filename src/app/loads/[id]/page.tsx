"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import type { Load } from "@/lib/types";

export default function LoadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [load, setLoad] = useState<Load | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) return router.replace("/login");

    api
      .getLoad(id)
      .then(({ load }) => setLoad(load))
      .catch((err) => setError(err instanceof ApiError && err.status === 403 ? "Brak dostępu do tego ładunku." : "Nie znaleziono ładunku."));
  }, [id, loading, user, router]);

  if (loading || !user) return null;

  return (
    <AppShell>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
      {!load && !error && <p className="text-[var(--color-text-muted)]">Ładowanie…</p>}
      {load && (
        <div className="card max-w-lg flex flex-col gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">
              {load.origin ?? "?"} → {load.destination ?? "?"}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mono">
              dodano {new Date(load.created_at).toLocaleString("pl-PL")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {load.truck_required && <span className="badge badge-accent">{load.truck_required}</span>}
            {load.price && <span className="badge badge-success">{load.price}</span>}
          </div>

          {load.contact_info && (
            <div>
              <p className="field-label">Kontakt</p>
              <a className="mono text-lg font-semibold" style={{ color: "var(--color-accent)" }} href={buildContactHref(load.contact_info)}>
                {load.contact_info}
              </a>
            </div>
          )}

          {load.raw_text && (
            <div>
              <p className="field-label">Oryginalny tekst ogłoszenia</p>
              <p className="text-sm whitespace-pre-wrap text-[var(--color-text-muted)]">{load.raw_text}</p>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

function buildContactHref(contact: string): string {
  const phoneLike = contact.replace(/[\s()-]/g, "");
  if (/^\+?\d{7,15}$/.test(phoneLike)) return `tel:${phoneLike}`;
  if (contact.includes("@")) return `mailto:${contact}`;
  return "#";
}
