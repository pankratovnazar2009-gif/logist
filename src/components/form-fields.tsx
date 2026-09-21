import { ROUTE_OPTIONS, TRUCK_TYPES } from "@/lib/types";

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>}
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
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      <optgroup label="Polska">
        {ROUTE_OPTIONS.filter((r) => r.value.startsWith("PL-")).map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="Zagranica">
        {ROUTE_OPTIONS.filter((r) => !r.value.startsWith("PL-")).map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

export function TruckSelect({ id, value, onChange, required, placeholder }: SelectProps) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {TRUCK_TYPES.map((t) => (
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
