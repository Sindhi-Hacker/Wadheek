import React from 'react';

/** Small form controls shared across panels. */

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? String(Math.round(value * 100) / 100);
  const commit = (raw: string) => {
    const parsed = parseFloat(raw.replace(',', '.'));
    setDraft(null);
    if (Number.isFinite(parsed)) {
      let v = parsed;
      if (min != null) v = Math.max(min, v);
      if (max != null) v = Math.min(max, v);
      onChange(v);
    }
  };
  return (
    <span className="number-field">
      <input
        type="text"
        inputMode="decimal"
        value={shown}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft != null && commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const mult = e.key === 'ArrowUp' ? 1 : -1;
            const next = (draft != null ? parseFloat(draft) || 0 : value) + mult * step * (e.shiftKey ? 10 : 1);
            setDraft(null);
            let v = next;
            if (min != null) v = Math.max(min, v);
            if (max != null) v = Math.min(max, v);
            onChange(v);
          }
        }}
      />
      {suffix && <em>{suffix}</em>}
    </span>
  );
}

export function SliderField({
  value,
  onChange,
  onCommit,
  min,
  max,
  step = 0.01,
  format,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  disabled?: boolean;
}) {
  return (
    <span className="slider-field">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerUp={() => onCommit?.()}
        onKeyUp={() => onCommit?.()}
        onBlur={() => onCommit?.()}
      />
      <output>{format ? format(value) : String(Math.round(value * 100) / 100)}</output>
    </span>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button className={`toggle-row${checked ? ' on' : ''}`} onClick={() => onChange(!checked)} role="switch" aria-checked={checked} aria-label={label}>
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      {label && <span className="toggle-text">{label}</span>}
    </button>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <strong>{title}</strong>
      {hint && <span>{hint}</span>}
      {action}
    </div>
  );
}
