"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { ROUTE_OPTIONS, TRUCK_TYPES } from "@/lib/types";

export default function NewLoadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originRegion, setOriginRegion] = useState("");
  const [destinationRegion, setDestinationRegion] = useState("");
  const [truckRequired, setTruckRequired] = useState("");
  const [price, setPrice] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.role !== "logist") router.replace("/loads");
  }, [loading, user, router]);

  if (loading || user?.role !== "logist") return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.createLoad({
        origin,
        destination,
        origin_region: originRegion || undefined,
        destination_region: destinationRegion || undefined,
        truck_required: truckRequired || undefined,
        price: price || undefined,
        contact_info: contactInfo || undefined,
      });
      router.replace("/loads");
    } catch {
      setError("Nie udało się dodać ładunku.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight mb-6">
        Nowy ładunek
      </h1>
      <form onSubmit={handleSubmit} className="card flex flex-col gap-4 max-w-lg">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="origin">
              Skąd
            </label>
            <input id="origin" className="input" value={origin} onChange={(e) => setOrigin(e.target.value)} required />
          </div>
          <div>
            <label className="field-label" htmlFor="destination">
              Dokąd
            </label>
            <input id="destination" className="input" value={destination} onChange={(e) => setDestination(e.target.value)} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="originRegion">
              Region załadunku
            </label>
            <select id="originRegion" className="input" value={originRegion} onChange={(e) => setOriginRegion(e.target.value)}>
              <option value="">—</option>
              {ROUTE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="destinationRegion">
              Region rozładunku
            </label>
            <select
              id="destinationRegion"
              className="input"
              value={destinationRegion}
              onChange={(e) => setDestinationRegion(e.target.value)}
            >
              <option value="">—</option>
              {ROUTE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="truckRequired">
            Wymagane nadwozie
          </label>
          <select id="truckRequired" className="input" value={truckRequired} onChange={(e) => setTruckRequired(e.target.value)}>
            <option value="">—</option>
            {TRUCK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="price">
              Stawka
            </label>
            <input id="price" className="input mono" placeholder="np. 1200 PLN" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="contact">
              Kontakt
            </label>
            <input id="contact" className="input mono" placeholder="+48…" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} />
          </div>
        </div>

        {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Dodawanie…" : "Dodaj ładunek"}
        </button>
      </form>
    </AppShell>
  );
}
