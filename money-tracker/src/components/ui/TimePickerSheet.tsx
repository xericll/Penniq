import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { haptic } from '../../lib/haptics';
import { Sheet } from './Sheet';

const ROW = 44;
const VISIBLE = 5;

interface WheelProps<T extends string | number> {
  items: T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  format?: (v: T) => string;
  className?: string;
}

/**
 * One scroll wheel: the rows snap to the band in the middle and fade and shrink
 * towards the edges. Arrow keys, Page Up/Down, Home and End work as on a spin button.
 */
function Wheel<T extends string | number>({ items, value, onChange, label, format = String, className = '' }: WheelProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);
  const frame = useRef(0);
  const index = Math.max(0, items.indexOf(value));
  const live = useRef({ items, onChange, index });
  live.current = { items, onChange, index };
  const reduced = useReducedMotion();

  // Fade and scale each row by its distance from the middle band.
  const paint = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const mid = el.scrollTop / ROW;
    el.querySelectorAll<HTMLElement>('[data-row]').forEach((row, i) => {
      const d = Math.min(2.5, Math.abs(i - mid));
      row.style.opacity = String(1 - d * 0.32);
      row.style.transform = `scale(${1 - d * 0.09}) rotateX(${(i - mid) * -14}deg)`;
    });
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Only jump when the value changed from outside (not while the finger is on it).
    if (Math.round(el.scrollTop / ROW) !== index) el.scrollTop = index * ROW;
    paint();
  }, [index, paint]);

  useEffect(() => () => window.clearTimeout(settle.current), []);

  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(paint);
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const { items, onChange, index } = live.current;
      const next = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)));
      if (next !== index) {
        haptic('tap');
        onChange(items[next]);
      }
    }, 90);
  };

  const step = (by: number) => {
    const next = Math.min(items.length - 1, Math.max(0, index + by));
    if (next === index) return;
    haptic('tap');
    onChange(items[next]);
    ref.current?.scrollTo({ top: next * ROW, behavior: reduced ? 'auto' : 'smooth' });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5, Home: -items.length, End: items.length };
    if (moves[e.key] === undefined) return;
    e.preventDefault();
    step(moves[e.key]);
  };

  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={index}
      aria-valuetext={format(value)}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      className={`no-scrollbar relative snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-foil ${className}`}
      style={{
        height: ROW * VISIBLE,
        paddingBlock: ROW * 2,
        perspective: 600,
        maskImage: 'linear-gradient(to bottom, transparent, #000 28%, #000 72%, transparent)',
      }}
    >
      {items.map((item, i) => (
        <button
          key={String(item)}
          type="button"
          tabIndex={-1}
          data-row
          onClick={() => step(i - index)}
          className="font-display block w-full snap-center text-center text-[28px] leading-none tabular will-change-transform"
          style={{ height: ROW, lineHeight: `${ROW}px` }}
        >
          {format(item)}
        </button>
      ))}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

interface TimePickerSheetProps {
  open: boolean;
  /** "HH:MM", 24 hours. */
  value: string;
  title: string;
  onClose: () => void;
  onSave: (time: string) => void;
}

/**
 * Picks a time of day with three wheels: hours, minutes and (in Arabic) ص / م.
 * German and English count the day in 24 hours, as the rest of the app shows it.
 */
export function TimePickerSheet({ open, value, title, onClose, onSave }: TimePickerSheetProps) {
  const { t, lang, timeLabel } = useI18n();
  const twelve = lang === 'ar';
  const [hour, setHour] = useState(21);
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    if (!open) return;
    const [h, m] = value.split(':').map(Number);
    setHour(Number.isFinite(h) ? h : 21);
    setMinute(Number.isFinite(m) ? m : 0);
  }, [open, value]);

  const pm = hour >= 12;
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const time = `${pad(hour)}:${pad(minute)}`;
  const preview = timeLabel(new Date(2026, 0, 1, hour, minute));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="press min-h-13 rounded-2xl border border-line-strong text-[15px] font-medium hover:bg-surface-2"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              haptic('success');
              onSave(time);
            }}
            className="foil press min-h-13 rounded-2xl text-[15px] font-semibold"
          >
            {t('common.save')}
          </button>
        </div>
      }
    >
      <motion.p
        key={preview}
        initial={{ opacity: 0.4, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mb-3 text-center text-[14px] text-ink-3"
        aria-live="polite"
      >
        {preview}
      </motion.p>
      <div dir="ltr" className="relative mx-auto flex max-w-[320px] items-center justify-center gap-1">
        {/* The band the chosen row rests on. */}
        <span
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-2xl"
          style={{ height: ROW, background: 'var(--surface-2)', boxShadow: 'inset 0 0 0 1px var(--line-strong)' }}
          aria-hidden
        />
        {twelve ? (
          <Wheel
            items={HOURS_12}
            value={hour12}
            onChange={(h) => setHour((h % 12) + (pm ? 12 : 0))}
            label={t('time.hour')}
            format={pad}
            className="relative w-20"
          />
        ) : (
          <Wheel items={HOURS_24} value={hour} onChange={setHour} label={t('time.hour')} format={pad} className="relative w-20" />
        )}
        <span className="font-display relative pb-1 text-[28px] text-ink-3" aria-hidden>
          :
        </span>
        <Wheel items={MINUTES} value={minute} onChange={setMinute} label={t('time.minute')} format={pad} className="relative w-20" />
        {twelve && (
          <Wheel
            items={['am', 'pm']}
            value={pm ? 'pm' : 'am'}
            onChange={(v) => setHour((hour % 12) + (v === 'pm' ? 12 : 0))}
            label={t('time.period')}
            format={(v) => t(v === 'pm' ? 'time.pm' : 'time.am')}
            className="relative ms-2 w-16 [&_[data-row]]:font-sans [&_[data-row]]:text-[22px]"
          />
        )}
      </div>
    </Sheet>
  );
}
