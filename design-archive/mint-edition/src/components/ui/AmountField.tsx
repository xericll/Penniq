import { useId, type ReactNode } from 'react';
import { useI18n } from '../../i18n/LanguageContext';

interface AmountFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Shown under the field in red and announced; also marks the field invalid. */
  error?: string;
  /** Quiet line under the field when there is no error. */
  hint?: ReactNode;
  autoFocus?: boolean;
}

/** A large amount typed with the device keyboard — for the short forms outside the composer. */
export function AmountField({ label, value, onChange, error, hint, autoFocus }: AmountFieldProps) {
  const id = useId();
  const { currencySymbol } = useI18n();
  return (
    <div>
      <label htmlFor={id} className="eyebrow mb-2 block">
        {label}
      </label>
      <div className="relative" dir="ltr">
        <input
          id={id}
          {...(autoFocus ? { 'data-autofocus': true } : {})}
          className="field font-display min-h-14 pe-11 text-center text-[26px] tabular"
          inputMode="decimal"
          dir="ltr"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${id}-note` : undefined}
        />
        <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-[18px] text-foil">{currencySymbol}</span>
      </div>
      {(error || hint) && (
        <p
          id={`${id}-note`}
          role={error ? 'alert' : undefined}
          className={`mt-1.5 text-[13px] ${error ? 'font-medium text-out' : 'text-ink-3'}`}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}
