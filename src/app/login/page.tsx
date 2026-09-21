"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n/provider";
import type { Messages } from "@/lib/i18n/messages";
import { homePath } from "@/lib/routes";
import { Wordmark } from "@/components/wordmark";

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
  const { m } = useI18n();
  const router = useRouter();

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.requestOtp(phone.trim());
      setStep("code");
    } catch (err) {
      setError(describeError(err, "request", m));
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
      setError(describeError(err, "verify", m));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl mb-1">
          <Wordmark />
        </h1>
        <p className="text-[var(--color-text-muted)] mb-8">{m.auth.tagline}</p>

        {step === "phone" && (
          <form onSubmit={handleRequestCode} className="card flex flex-col gap-4">
            <div>
              <label className="field-label" htmlFor="phone">
                {m.auth.phone}
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
              {submitting ? m.auth.sending : m.auth.sendCode}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="card flex flex-col gap-4">
            <p className="text-sm text-[var(--color-text-muted)]">
              {m.auth.codeSentTo} <span className="mono">{phone}</span>
            </p>
            <div>
              <label className="field-label" htmlFor="code">
                {m.auth.codeLabel}
              </label>
              <input
                id="code"
                className="input mono text-center text-xl tracking-[0.3em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={submitting || code.length !== 6}>
              {submitting ? m.auth.checking : m.auth.confirm}
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
              {m.auth.changeNumber}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const KNOWN_ERRORS = ["invalid_phone", "too_many_requests", "sms_send_failed", "no_pending_code", "code_expired", "wrong_code", "too_many_attempts"] as const;
type KnownError = (typeof KNOWN_ERRORS)[number];
const isKnownError = (code: string): code is KnownError => (KNOWN_ERRORS as readonly string[]).includes(code);

function describeError(err: unknown, context: "request" | "verify", m: Messages): string {
  if (err instanceof ApiError && isKnownError(err.code)) return m.auth.errors[err.code];
  return m.auth.errors[context];
}
