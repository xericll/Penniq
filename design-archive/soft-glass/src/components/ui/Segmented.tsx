import { motion } from 'motion/react';
import React, { useEffect, useId, useRef } from 'react';
import { haptic } from '../../lib/haptics';

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** CSS colour that tints the active droplet and its label, e.g. 'var(--out)'. */
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

/**
 * Radio group on a recessed glass track. The active option sits inside a liquid-glass
 * droplet that slides over, stretching while it travels and wobbling as it settles.
 */
export function Segmented<T extends string>({ value, onChange, options, label, size = 'md', className = '' }: SegmentedProps<T>) {
  const id = useId();
  // Wobble only when the choice changes, not when the control first appears.
  const settled = useRef(false);
  useEffect(() => {
    settled.current = true;
  }, []);

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
      className={`inset relative grid rounded-full p-1 ${className}`}
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
            className={`relative z-0 flex items-center justify-center gap-1.5 rounded-full px-2 font-medium transition-colors duration-300 ${
              size === 'lg' ? 'min-h-12 text-[15px]' : 'min-h-10 text-sm'
            } ${active ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`}
            style={active && opt.tone ? { color: `color-mix(in oklab, ${opt.tone} 85%, var(--ink))` } : undefined}
          >
            {active && (
              <motion.span
                layoutId={`drop-${id}`}
                aria-hidden
                className="glass-pill iris absolute inset-0 -z-10 rounded-full"
                style={opt.tone ? { backgroundColor: `color-mix(in oklab, ${opt.tone} 14%, transparent)` } : undefined}
                initial={{ scaleX: 1, scaleY: 1 }}
                animate={settled.current ? { scaleX: [1, 1.14, 0.96, 1.02, 1], scaleY: [1, 0.86, 1.05, 0.99, 1] } : undefined}
                transition={{
                  layout: { type: 'spring', stiffness: 380, damping: 30, mass: 0.9 },
                  scaleX: { duration: 0.6, times: [0, 0.3, 0.6, 0.82, 1], ease: 'easeOut' },
                  scaleY: { duration: 0.6, times: [0, 0.3, 0.6, 0.82, 1], ease: 'easeOut' },
                }}
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
