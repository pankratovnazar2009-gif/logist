"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/provider";
import { useRoleGuard } from "@/lib/use-role-guard";
import { AppShell } from "@/components/app-shell";
import { Field, RegionSelect, TruckSelect, todayIso, toOptionalInt } from "@/components/form-fields";

export default function NewOfferPage() {
  const user = useRoleGuard("carrier");
  if (!user) return null;
  return (
    <AppShell>
      <OfferForm defaults={{ region: user.preferred_routes[0] ?? "", truck: user.truck_types[0] ?? "" }} />
    </AppShell>
  );
}

/** Отдельный компонент: значения по умолчанию из профиля читаются при первом рендере, когда пользователь уже известен. */
function OfferForm({ defaults }: { defaults: { region: string; truck: string } }) {
  const router = useRouter();
  const { m } = useI18n();
  const f = m.offers.form;
  const [origin, setOrigin] = useState("");
  const [originRegion, setOriginRegion] = useState(defaults.region);
  const [destination, setDestination] = useState("");
  const [destinationRegion, setDestinationRegion] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [truckType, setTruckType] = useState(defaults.truck);
  const [capacity, setCapacity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { offer } = await api.createOffer({
        origin: origin.trim() || undefined,
        destination: destination.trim() || undefined,
        origin_region: originRegion,
        destination_region: destinationRegion || undefined,
        available_from: from,
        available_to: to || from,
        truck_type: truckType || undefined,
        capacity_kg: toOptionalInt(capacity),
      });
      router.replace(`/offers/${offer.id}`);
    } catch {
      setError(f.error);
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight mb-2">{f.title}</h1>
      <p className="text-[var(--color-text-muted)] mb-6 max-w-lg">{f.intro}</p>
      <form onSubmit={handleSubmit} className="card flex flex-col gap-4 max-w-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="originRegion" label={f.fromRegion} hint={f.fromRegionHint}>
            <RegionSelect id="originRegion" value={originRegion} onChange={setOriginRegion} required placeholder={m.common.choose} />
          </Field>
          <Field id="origin" label={f.from}>
            <input id="origin" className="input" value={origin} onChange={(e) => setOrigin(e.target.value)} />
          </Field>
          <Field id="destinationRegion" label={f.toRegion} hint={f.toRegionHint}>
            <RegionSelect id="destinationRegion" value={destinationRegion} onChange={setDestinationRegion} placeholder={m.common.anyDirection} />
          </Field>
          <Field id="destination" label={f.to}>
            <input id="destination" className="input" value={destination} onChange={(e) => setDestination(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="from" label={f.freeFrom}>
            <input id="from" type="date" className="input mono" min={todayIso()} value={from} onChange={(e) => setFrom(e.target.value)} required />
          </Field>
          <Field id="to" label={f.freeTo} hint={f.freeToHint}>
            <input id="to" type="date" className="input mono" min={from || todayIso()} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="truckType" label={f.body}>
            <TruckSelect id="truckType" value={truckType} onChange={setTruckType} placeholder={m.common.notProvided} />
          </Field>
          <Field id="capacity" label={f.capacity} hint={f.capacityHint}>
            <input id="capacity" className="input mono" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))} />
          </Field>
        </div>

        <p role="alert" className="text-sm min-h-5" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? f.submitting : f.submit}
        </button>
      </form>
    </>
  );
}
