import { motion, useReducedMotion } from 'motion/react';
import { useRef, type PointerEvent } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useI18n } from '../../i18n/LanguageContext';
import { useWallet } from '../../state/WalletContext';
import { Guilloche } from '../ui/Engraving';
import { Mark } from '../ui/Logo';
import { Garland } from '../ui/Olive';
import { Money, Odometer } from '../ui/Money';
import { PrivacyButton } from './PrivacyButton';
import { PulseChips } from './PulseChips';

/**
 * The hero: the total balance printed like a banknote — guilloché rosettes,
 * an olive garland inside the edge, serial number and a watermark of the mark.
 * A band of gold light crosses it now and then; it tilts towards the pointer.
 */
export function BalanceNote({ monthNet }: { monthNet: number }) {
  const { t, money } = useI18n();
  const { balances, transactions, pulses } = useWallet();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const totalPulses = pulses.filter((p) => p.target === 'total');
  const lastPulse = totalPulses[totalPulses.length - 1];

  const cash = Math.max(0, balances.cash);
  const bank = Math.max(0, balances.bank);
  const sum = cash + bank;
  const cashShare = sum > 0 ? cash / sum : 0.5;
  const year = new Date().getFullYear();
  const serial = String(transactions.length).padStart(6, '0');
  // Long totals (millions, or a currency with a wide symbol) step down so they stay inside the note.
  const length = money(balances.total, { decimals: 'always' }).length;
  const size =
    length <= 13
      ? 'text-[44px] min-[380px]:text-[50px] sm:text-[56px]'
      : length <= 15
        ? 'text-[38px] sm:text-[48px]'
        : length <= 17
          ? 'text-[32px] sm:text-[40px]'
          : 'text-[26px] sm:text-[32px]';

  // Tilt towards the pointer (mouse or finger) and move a soft light with it.
  const tilt = (e: PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el || reduced || e.pointerType === 'touch') return;
    const b = el.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width;
    const y = (e.clientY - b.top) / b.height;
    el.style.setProperty('--ry', `${((x - 0.5) * 10).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${((0.5 - y) * 8).toFixed(2)}deg`);
    el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    el.style.setProperty('--glare', '1');
  };
  const untilt = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--glare', '0');
  };

  const split = 'color-mix(in oklab, var(--note-ink) 55%, transparent)';

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 26, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      <section
        ref={ref}
        aria-labelledby="note-title"
        onPointerMove={tilt}
        onPointerLeave={untilt}
        className="relative isolate overflow-hidden rounded-[26px] text-note-ink"
        style={{
          background:
            'radial-gradient(120% 90% at 100% 0%, color-mix(in oklab, var(--note-bg) 82%, white) 0%, transparent 62%), radial-gradient(90% 80% at 0% 100%, color-mix(in oklab, var(--note-foil) 16%, transparent) 0%, transparent 70%), linear-gradient(160deg, var(--note-bg), var(--note-bg-2))',
          boxShadow: '0 28px 50px -30px rgba(20,20,5,0.7), inset 0 1px 0 rgba(255,255,255,0.07)',
          transform: 'perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))',
          transition: 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {lastPulse && (
          <motion.div
            key={lastPulse.id}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 rounded-[26px]"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
            style={{
              boxShadow: `inset 0 0 0 1.5px ${lastPulse.delta > 0 ? 'var(--in)' : 'var(--out)'}, inset 0 0 48px -12px ${lastPulse.delta > 0 ? 'var(--in)' : 'var(--out)'}`,
            }}
          />
        )}
        {/* Engraving */}
        <Guilloche className="absolute -top-20 -end-24 -z-10 size-[300px] text-note-foil opacity-[0.24]" spin />
        <Guilloche className="absolute -bottom-36 -start-32 -z-10 size-[240px] text-note-foil opacity-[0.08]" density="light" />
        <span className="pointer-events-none absolute end-6 bottom-16 -z-10 opacity-[0.09]" aria-hidden>
          <Mark size={70} color="var(--note-foil)" />
        </span>
        <Garland className="text-note-foil opacity-55" />
        <span className="note-sheen" aria-hidden />
        <span className="note-glare" aria-hidden />

        <div className="relative px-6 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <h2 id="note-title" className="eyebrow !text-note-ink-2">
              {t('home.total')}
            </h2>
            <span className="serial ms-auto text-note-ink-2/80" dir="ltr">
              № {serial} · {year}
            </span>
            <PrivacyButton className="-me-2 text-note-ink-2 hover:bg-white/5 hover:text-note-ink" />
          </div>

          <div className="relative mt-1">
            <Odometer
              value={balances.total}
              className={`font-display leading-[1.1] font-normal ${size}`}
              decimalsClassName="text-[0.5em] text-note-ink-2 ms-0.5"
              currencyClassName="text-[0.5em] text-note-foil mx-1.5"
            />
            <PulseChips pulses={totalPulses} className="-top-3 end-0" />
          </div>

          <div className="mt-2 flex items-center gap-2 text-[13px]">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{
                background:
                  monthNet >= 0 ? 'color-mix(in oklab, var(--in) 22%, transparent)' : 'color-mix(in oklab, var(--out) 22%, transparent)',
                color:
                  monthNet >= 0
                    ? 'color-mix(in oklab, var(--in) 45%, var(--note-ink))'
                    : 'color-mix(in oklab, var(--out) 45%, var(--note-ink))',
              }}
            >
              {monthNet >= 0 ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
              <Money value={monthNet} sign className="font-semibold" />
            </span>
            <span className="text-note-ink-2">{t('home.monthNet')}</span>
          </div>

          {/* Cash / bank split — a two-tone bar like the note's security thread */}
          <div className="mt-6">
            <div
              className="flex h-1.5 overflow-hidden rounded-full"
              style={{ background: 'color-mix(in oklab, var(--note-ink) 12%, transparent)' }}
              aria-hidden
            >
              <motion.span
                className="h-full rounded-full"
                style={{ background: 'var(--note-foil)' }}
                initial={reduced ? false : { width: '0%' }}
                animate={{ width: `${sum > 0 ? cashShare * 100 : 0}%` }}
                transition={{ type: 'spring', stiffness: 60, damping: 18, delay: reduced ? 0 : 0.9 }}
              />
              <span className="h-full flex-1" style={{ background: sum > 0 ? split : 'transparent' }} />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: 'var(--note-foil)' }} aria-hidden />
                <span className="text-note-ink-2">{t('common.cash')}</span>
                <Money value={balances.cash} className="font-medium" />
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: split }} aria-hidden />
                <span className="text-note-ink-2">{t('common.bank')}</span>
                <Money value={balances.bank} className="font-medium" />
              </span>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
