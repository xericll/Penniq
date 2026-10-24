import { motion } from 'motion/react';
import React, { useId } from 'react';
import { haptic } from '../../lib/haptics';

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** CSS colour for the active pill, e.g. 'var(--out)'. Defaults to ink. */
  tone?: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: NoInfer<T>) => void;
  options: SegmentOption<NoInfer<T>>[];
  label: string;
  size?: 'md' | 'lg';
  className?: string;
}

/** Radio-group style switcher with a sliding pill. */
export function Segmented<T extends string>({ value, onChange, options, label, size = 'md', className = '' }: SegmentedProps<T>) {
  const id = useId();

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const rtl = document.documentElement.dir === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = -1;
    if (e.key === forward) next = (index + 1) % options.length;
    if (e.key === backward) next = (index - 1 + options.length) % options.length;
    if (next >= 0) {
      e.preventDefault();
      onChange(options[next].value);
      (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`relative grid rounded-2xl bg-surface-2 p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => {
              if (!active) {
                haptic('select');
                onChange(opt.value);
              }
            }}
            className={`relative z-0 flex items-center justify-center rounded-xl font-medium transition-colors ${
              // Long German labels ("Umbuchung") with an icon still fit three across on a 360 px phone.
              size === 'lg'
                ? 'min-h-12 gap-1 px-1 text-[13px] min-[390px]:gap-1.5 min-[390px]:px-2 min-[390px]:text-[15px]'
                : 'min-h-10 gap-1.5 px-2 text-sm'
            } ${active ? '' : 'text-ink-2 hover:text-ink'}`}
            style={active ? { color: 'var(--bg)' } : undefined}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 -z-10 rounded-xl"
                style={{ background: opt.tone ?? 'var(--ink)' }}
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              />
            )}
            {opt.icon}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
