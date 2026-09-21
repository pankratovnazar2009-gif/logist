"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { homePath } from "@/lib/routes";

type Step = "phone" | "code";

/** Куда вернуть после входа (?next=). Только путь внутри приложения — чужой адрес превратил бы форму входа в открытый редирект. */
function returnPath(): string | null {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export default function LoginPage() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("+48");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { loginWithToken } = useAuth();
  const router = useRouter();

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.requestOtp(phone.trim());
      setStep("code");
    } catch (err) {
      setError(describeError(err, "request"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { token, user } = await api.verifyOtp(phone.trim(), code.trim());
      loginWithToken(token, user);
      router.replace(user.role ? (returnPath() ?? homePath(user.role)) : "/onboarding");
    } catch (err) {
      setError(describeError(err, "verify"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight mb-1">
          Logist<span style={{ color: "var(--color-accent)" }}>.</span>
        </h1>
        <p className="text-[var(--color-text-muted)] mb-8">Zaloguj się kodem SMS</p>

        {step === "phone" && (
          <form onSubmit={handleRequestCode} className="card flex flex-col gap-4">
            <div>
              <label className="field-label" htmlFor="phone">
                Numer telefonu
              </label>
              <input
                id="phone"
                className="input mono"
                type="tel"
                inputMode="tel"
                placeholder="+48123456789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Wysyłanie…" : "Wyślij kod"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="card flex flex-col gap-4">
            <p className="text-sm text-[var(--color-text-muted)]">
              Kod wysłany na <span className="mono">{phone}</span>
            </p>
            <div>
              <label className="field-label" htmlFor="code">
                Kod z SMS
              </label>
              <input
                id="code"
                className="input mono text-center text-xl tracking-[0.3em]"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={submitting || code.length !== 6}>
              {submitting ? "Sprawdzanie…" : "Potwierdź"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
            >
              Zmień numer
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function describeError(err: unknown, context: "request" | "verify"): string {
  if (err instanceof ApiError) {
    if (err.code === "invalid_phone") return "Nieprawidłowy numer telefonu.";
    if (err.code === "too_many_requests") return "Poczekaj chwilę przed ponownym wysłaniem kodu.";
    if (err.code === "sms_send_failed") return "Nie udało się wysłać SMS. Spróbuj ponownie.";
    if (err.code === "no_pending_code") return "Poproś o nowy kod.";
    if (err.code === "code_expired") return "Kod wygasł, poproś o nowy.";
    if (err.code === "wrong_code") return "Nieprawidłowy kod.";
    if (err.code === "too_many_attempts") return "Zbyt wiele prób, poproś o nowy kod.";
  }
  return context === "request" ? "Nie udało się wysłać kodu." : "Nie udało się zweryfikować kodu.";
}
