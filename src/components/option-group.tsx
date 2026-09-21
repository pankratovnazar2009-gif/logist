interface OptionGroupProps<T extends string> {
  label: string;
  hint?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** Выбор одного варианта из нескольких: кнопки-метки с семантикой radio, выбранная подсвечена и озвучивается скринридером. */
export function OptionGroup<T extends string>({ label, hint, value, options, onChange }: OptionGroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={label}>
      <p className="field-label">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button key={option.value} type="button" role="radio" aria-checked={option.value === value} className="chip" onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
      {hint && <p className="mt-2 text-xs text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}
