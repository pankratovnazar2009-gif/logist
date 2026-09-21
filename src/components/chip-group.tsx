interface ChipGroupProps {
  label: string;
  options: readonly { value: string; label: string }[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
}

/** Множественный выбор метками. Нажатое состояние читают и скринридеры (aria-pressed), а не только глаза. */
export function ChipGroup({ label, options, selected, onChange }: ChipGroupProps) {
  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  return (
    <div role="group" aria-label={label}>
      <p className="field-label">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button key={option.value} type="button" className="chip" aria-pressed={selected.includes(option.value)} onClick={() => toggle(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
