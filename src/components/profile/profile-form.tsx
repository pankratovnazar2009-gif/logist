"use client";

import { useState } from "react";
import { ApiError, api, type ProfilePatch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { LANGUAGE_OPTIONS, ROUTE_OPTIONS, TRUCK_TYPES, type AppUser } from "@/lib/types";
import { ChipGroup } from "../chip-group";
import { Field } from "../form-fields";

type SaveState = { status: "idle" } | { status: "saving" } | { status: "saved" } | { status: "error"; message: string; field?: "nip" | "email" | "name" };

/** Форма профиля: одна кнопка «Zapisz» на все поля; фото сохраняется отдельно и сразу. */
export function ProfileForm({ user }: { user: AppUser }) {
  const { refreshUser } = useAuth();
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [nip, setNip] = useState(user.nip ?? "");
  const [companyName, setCompanyName] = useState(user.company_name ?? "");
  const [languages, setLanguages] = useState(user.languages);
  const [truckTypes, setTruckTypes] = useState(user.truck_types);
  const [routes, setRoutes] = useState(user.preferred_routes);
  const [save, setSave] = useState<SaveState>({ status: "idle" });

  const isCarrier = user.role === "carrier";
  const companyVerified = Boolean(user.nip) && nip === user.nip;
  const saving = save.status === "saving";
  const fieldError = (field: "nip" | "email" | "name") => (save.status === "error" && save.field === field ? save.message : null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (fullName.trim() && fullName.trim().length < 2) return setSave({ status: "error", message: "Imię jest za krótkie.", field: "name" });
    if (nip && !/^\d{10}$/.test(nip)) return setSave({ status: "error", message: "NIP ma 10 cyfr.", field: "nip" });

    const patch: ProfilePatch = {
      full_name: fullName.trim() || null,
      email: email.trim() || null,
      nip: nip || null,
      languages,
      ...(nip ? {} : { company_name: companyName.trim() || null }),
      ...(isCarrier ? { truck_types: truckTypes, preferred_routes: routes } : {}),
    };

    setSave({ status: "saving" });
    try {
      await api.updateProfile(patch);
      await refreshUser();
      setSave({ status: "saved" });
    } catch (err) {
      if (err instanceof ApiError && err.code === "nip_not_found") return setSave({ status: "error", message: "Nie znaleziono firmy dla tego NIP w GUS.", field: "nip" });
      if (err instanceof ApiError && err.code === "invalid_input") return setSave({ status: "error", message: "Sprawdź poprawność e-maila i imienia.", field: "email" });
      setSave({ status: "error", message: "Nie udało się zapisać. Spróbuj ponownie." });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section className="card flex flex-col gap-4" aria-labelledby="personal-heading">
        <h2 id="personal-heading" className="font-[family-name:var(--font-display)] text-lg font-bold">
          Dane osobowe
        </h2>
        <Field id="fullName" label="Imię i nazwisko" error={fieldError("name")}>
          <input id="fullName" className="input" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} />
        </Field>
        <Field id="email" label="E-mail" error={fieldError("email")} hint="Zobaczy go druga strona dopiero po potwierdzeniu połączenia.">
          <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />
        </Field>
        <Field id="phone" label="Telefon" hint="Potwierdzony kodem SMS — zmienić go można tylko przez ponowne logowanie.">
          <input id="phone" className="input mono" value={user.phone ?? "—"} disabled readOnly />
        </Field>
      </section>

      <section className="card flex flex-col gap-4" aria-labelledby="company-heading">
        <h2 id="company-heading" className="font-[family-name:var(--font-display)] text-lg font-bold">
          Firma
        </h2>
        <Field id="nip" label="NIP" error={fieldError("nip")} hint="Sprawdzimy firmę w GUS — dostaniesz znaczek „firma zweryfikowana”.">
          <input id="nip" className="input mono" inputMode="numeric" maxLength={10} value={nip} onChange={(e) => setNip(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field id="company" label="Nazwa firmy" hint={companyVerified ? "Pobrana z GUS — nie można jej zmienić ręcznie." : undefined}>
          <input id="company" className="input" value={companyVerified ? (user.company_name ?? "") : companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={companyVerified} maxLength={120} />
        </Field>
      </section>

      <section className="card flex flex-col gap-5" aria-labelledby="prefs-heading">
        <h2 id="prefs-heading" className="font-[family-name:var(--font-display)] text-lg font-bold">
          {isCarrier ? "Języki i flota" : "Języki"}
        </h2>
        <ChipGroup label="W jakich językach się dogadasz" options={LANGUAGE_OPTIONS} selected={languages} onChange={setLanguages} />
        {isCarrier && <ChipGroup label="Typ nadwozia" options={TRUCK_TYPES} selected={truckTypes} onChange={setTruckTypes} />}
        {isCarrier && <ChipGroup label="Preferowane kierunki" options={ROUTE_OPTIONS} selected={routes} onChange={setRoutes} />}
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Zapisywanie…" : "Zapisz"}
        </button>
        <p role="status" className="text-sm" style={{ color: save.status === "error" ? "var(--color-danger)" : "var(--color-success)" }}>
          {save.status === "saved" ? "Zapisano." : save.status === "error" && !save.field ? save.message : ""}
        </p>
      </div>
    </form>
  );
}
