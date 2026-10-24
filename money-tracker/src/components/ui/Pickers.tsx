import {
  Baby,
  Car,
  Gem,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  Plane,
  ShieldCheck,
  Smartphone,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, type ReactNode } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { CATEGORIES, type CategoryId } from '../../lib/categories';
import type { GoalIcon } from '../../lib/goals';
import { haptic } from '../../lib/haptics';
import type { AccountType } from '../../types';
import { Segmented } from './Segmented';

/** All categories as a wrapping grid of chips; one is always chosen. */
export function CategoryGrid({ value, onChange, legend }: { value: CategoryId; onChange: (id: CategoryId) => void; legend?: string }) {
  const { t } = useI18n();
  return (
    <fieldset>
      <legend className="eyebrow mb-2">{legend ?? t('composer.category')}</legend>
      <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = value === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                haptic('select');
                onChange(c.id);
              }}
              className={`press flex min-h-11 min-w-0 items-center gap-2 rounded-xl border px-3 text-[14px] ${active ? 'border-transparent font-medium' : 'border-line text-ink-2'}`}
              style={
                active
                  ? { background: `color-mix(in oklab, ${c.hue} 22%, var(--surface))`, boxShadow: `inset 0 0 0 1.5px ${c.hue}` }
                  : undefined
              }
            >
              <Icon className="size-4 shrink-0" style={{ color: c.hue }} aria-hidden />
              <span className="truncate">{t(c.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function AccountPicker({ value, onChange, label }: { value: AccountType; onChange: (a: AccountType) => void; label?: string }) {
  const { t, accountName } = useI18n();
  return (
    <div>
      <span className="eyebrow mb-2 block">{label ?? t('composer.account')}</span>
      <Segmented
        label={label ?? t('composer.account')}
        value={value}
        onChange={onChange}
        options={[
          { value: 'cash', label: accountName('cash') },
          { value: 'bank', label: accountName('bank') },
        ]}
      />
    </div>
  );
}

export function TypePicker({ value, onChange }: { value: 'expense' | 'income'; onChange: (v: 'expense' | 'income') => void }) {
  const { t } = useI18n();
  return (
    <Segmented
      label={t('composer.type')}
      value={value}
      onChange={onChange}
      options={[
        { value: 'expense', label: t('common.expense'), tone: 'var(--out)' },
        { value: 'income', label: t('common.income'), tone: 'var(--in)' },
      ]}
    />
  );
}

/** A labelled text field with an optional error line. */
export function TextField({
  label,
  value,
  onChange,
  error,
  placeholder,
  maxLength = 60,
  inputMode,
  dir,
  type = 'text',
  autoFocus,
  trailing,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  maxLength?: number;
  inputMode?: 'decimal' | 'numeric' | 'text';
  dir?: 'ltr' | 'rtl';
  type?: 'text' | 'date';
  autoFocus?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">{label}</span>
      <span className="relative block" dir={dir}>
        <input
          className={`field ${trailing ? 'pe-14' : ''} ${inputMode === 'decimal' ? 'tabular' : ''}`}
          type={type}
          value={value}
          dir={dir}
          inputMode={inputMode}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={!!error}
          {...(autoFocus ? { 'data-autofocus': true } : {})}
          onChange={(e) => onChange(e.target.value)}
        />
        {trailing && <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-[14px] text-ink-3">{trailing}</span>}
      </span>
      {error && (
        <span role="alert" className="mt-1.5 block text-[13px] font-medium text-out">
          {error}
        </span>
      )}
    </label>
  );
}

export const GOAL_ICON_MAP: Record<GoalIcon, LucideIcon> = {
  travel: Plane,
  car: Car,
  wedding: Gem,
  home: Home,
  phone: Smartphone,
  laptop: Laptop,
  study: GraduationCap,
  baby: Baby,
  gift: Gift,
  safety: ShieldCheck,
  health: HeartPulse,
  star: Star,
};

/** A goal's picture: the user's photo, or its icon struck like a coin. */
export function GoalMedallion({ icon, photo, size = 52 }: { icon: GoalIcon; photo?: string; size?: number }) {
  const Icon = GOAL_ICON_MAP[icon];
  if (photo) {
    return (
      <span
        className="block shrink-0 overflow-hidden rounded-full bg-surface-2"
        style={{ width: size, height: size, boxShadow: '0 0 0 2px var(--surface), 0 0 0 3.5px var(--coin)' }}
        aria-hidden
      >
        <img src={photo} alt="" className="size-full object-cover" />
      </span>
    );
  }
  return (
    <span className="coin grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size }} aria-hidden>
      <Icon style={{ width: size * 0.44, height: size * 0.44 }} strokeWidth={1.8} />
    </span>
  );
}

/** Parses an amount typed in any of the app's languages: "1.250,50", "1,250.50", "١٢٫٥". */
export function parseNumber(input: string): number {
  const western = input
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/\s/g, '');
  const lastComma = western.lastIndexOf(',');
  const lastDot = western.lastIndexOf('.');
  const normalized = lastComma > lastDot ? western.replace(/\./g, '').replace(',', '.') : western.replace(/,/g, '');
  return parseFloat(normalized);
}

/** A share as a percentage in the reader's format: "+22,5 %" in German, "+22.5%" in Arabic and English. */
export function usePercent() {
  const { lang } = useI18n();
  return useCallback(
    (share: number, signed = false) =>
      new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US', {
        style: 'percent',
        maximumFractionDigits: 1,
        signDisplay: signed ? 'exceptZero' : 'auto',
      }).format(share),
    [lang],
  );
}
