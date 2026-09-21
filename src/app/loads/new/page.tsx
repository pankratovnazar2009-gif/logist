"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/provider";
import { useRoleGuard } from "@/lib/use-role-guard";
import { AppShell } from "@/components/app-shell";
import { Field, RegionSelect, TruckSelect, todayIso, toOptionalInt } from "@/components/form-fields";

export default function NewLoadPage() {
  const user = useRoleGuard("logist");
  const router = useRouter();
  const { m } = useI18n();
  const f = m.loads.form;
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originRegion, setOriginRegion] = useState("");
  const [destinationRegion, setDestinationRegion] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [cargo, setCargo] = useState("");
  const [weight, setWeight] = useState("");
  const [pallets, setPallets] = useState("");
  const [truckRequired, setTruckRequired] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { load } = await api.createLoad({
        origin: origin.trim(),
        destination: destination.trim(),
        origin_region: originRegion,
        destination_region: destinationRegion || undefined,
        pickup_date: pickupDate,
        cargo: cargo.trim() || undefined,
        weight_kg: toOptionalInt(weight),
        pallets: toOptionalInt(pallets),
        truck_required: truckRequired || undefined,
        price: price.trim() || undefined,
      });
      router.replace(`/loads/${load.id}`);
    } catch {
      setError(f.error);
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight mb-2">{f.title}</h1>
      <p className="text-[var(--color-text-muted)] mb-6 max-w-lg">{f.intro}</p>
      <form onSubmit={handleSubmit} className="card flex flex-col gap-4 max-w-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="origin" label={f.from}>
            <input id="origin" className="input" value={origin} onChange={(e) => setOrigin(e.target.value)} required />
          </Field>
          <Field id="originRegion" label={f.fromRegion} hint={f.fromRegionHint}>
            <RegionSelect id="originRegion" value={originRegion} onChange={setOriginRegion} required placeholder={m.common.choose} />
          </Field>
          <Field id="destination" label={f.to}>
            <input id="destination" className="input" value={destination} onChange={(e) => setDestination(e.target.value)} required />
          </Field>
          <Field id="destinationRegion" label={f.toRegion}>
            <RegionSelect id="destinationRegion" value={destinationRegion} onChange={setDestinationRegion} placeholder={m.common.any} />
          </Field>
        </div>

        <Field id="pickupDate" label={f.date} hint={f.dateHint}>
          <input id="pickupDate" type="date" className="input mono" min={todayIso()} value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} required />
        </Field>

        <Field id="cargo" label={f.cargo}>
          <input id="cargo" className="input" placeholder={f.cargoPlaceholder} value={cargo} onChange={(e) => setCargo(e.target.value)} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="weight" label={f.weight}>
            <input id="weight" className="input mono" inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field id="pallets" label={f.pallets}>
            <input id="pallets" className="input mono" inputMode="numeric" value={pallets} onChange={(e) => setPallets(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field id="truckRequired" label={f.body}>
            <TruckSelect id="truckRequired" value={truckRequired} onChange={setTruckRequired} placeholder={m.common.anyNeuter} />
          </Field>
          <Field id="price" label={f.rate}>
            <input id="price" className="input mono" placeholder={f.ratePlaceholder} value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        </div>

        <p role="alert" className="text-sm min-h-5" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? f.submitting : f.submit}
        </button>
      </form>
    </AppShell>
  );
}
