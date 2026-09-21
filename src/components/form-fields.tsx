"use client";

import { useI18n } from "@/lib/i18n/provider";
import { regionOptions, truckOptions } from "@/lib/i18n/options";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  /** Ошибка заменяет подсказку: красный текст, объявляется скринридером. */
  error?: string | null;
  children: React.ReactNode;
}

export function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>
      )}
    </div>
  );
}

interface SelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** Подпись пустого варианта; без неё пустого варианта нет. */
  placeholder?: string;
}

export function RegionSelect({ id, value, onChange, required, placeholder }: SelectProps) {
  const { m } = useI18n();
  const options = regionOptions(m);
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      <optgroup label={m.regionGroups.poland}>
        {options
          .filter((r) => r.value.startsWith("PL-"))
          .map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
      </optgroup>
      <optgroup label={m.regionGroups.abroad}>
        {options
          .filter((r) => !r.value.startsWith("PL-"))
          .map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
      </optgroup>
    </select>
  );
}

export function TruckSelect({ id, value, onChange, required, placeholder }: SelectProps) {
  const { m } = useI18n();
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {truckOptions(m).map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );
}

/** Пустая строка → undefined, иначе целое число; NaN тоже превращается в undefined, чтобы не отправлять мусор. */
export function toOptionalInt(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

export const todayIso = (): string => new Date().toISOString().slice(0, 10);
