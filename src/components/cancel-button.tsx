"use client";

import { useState } from "react";

interface Props {
  label: string;
  confirmText: string;
  onConfirm: () => Promise<void>;
}

/** Необратимое действие в два шага: первый клик просит подтверждение, второй — выполняет. */
export function CancelButton({ label, confirmText, onConfirm }: Props) {
  const [step, setStep] = useState<"idle" | "confirm" | "working">("idle");
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setStep("working");
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError("Nie udało się. Być może to ogłoszenie zostało już przydzielone.");
      setStep("idle");
    }
  }

  return (
    <div className="flex flex-col gap-2 items-start">
      {step === "idle" && (
        <button type="button" className="btn btn-ghost" onClick={() => setStep("confirm")}>
          {label}
        </button>
      )}
      {step !== "idle" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">{confirmText}</span>
          <button type="button" className="btn btn-secondary" disabled={step === "working"} onClick={run}>
            {step === "working" ? "Chwila…" : "Tak, wycofaj"}
          </button>
          <button type="button" className="btn btn-ghost" disabled={step === "working"} onClick={() => setStep("idle")}>
            Nie
          </button>
        </div>
      )}
      <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>
        {error}
      </p>
    </div>
  );
}
