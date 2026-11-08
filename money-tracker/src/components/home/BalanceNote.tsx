import { motion, useReducedMotion } from 'motion/react';
import { useRef, type PointerEvent } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useEntrance } from '../../hooks/useEntrance';
import { useI18n } from '../../i18n/LanguageContext';
import { useWallet } from '../../state/WalletContext';
import { Flow, FLOW_PINCH, Spark } from '../ui/Flow';
import { Money, Odometer } from '../ui/Money';
import { PrivacyButton } from './PrivacyButton';
import { PulseChips } from './PulseChips';

/** Small sparks [left %, top %, size px] and star dots [left %, top %] around the Flow, as placed in the design. */
const SPARKS: [number, number, number][] = [
  [5.5, 30, 12],
  [32.5, 37, 10],
  [36, 53, 9],
];
const DOTS: [number, number][] = [
  [11.5, 34],
  [15.5, 21],
  [27, 19],
  [24, 45],
];

/**
 * The hero: the total balance on a banknote — the Flow ribbon pinching into a spark,
 * a serial number and the cash / bank split. A band of light crosses it now and then;
 * it tilts towards the pointer.
 */
export function BalanceNote({ monthNet }: { monthNet: number }) {
  const { t, money } = useI18n();
  const { balances, transactions, pulses } = useWallet();
  const reduced = useReducedMotion();
  const first = useEntrance();
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

  const split = 'var(--note-bank)';

  return (
    <motion.div
      initial={reduced || !first ? false : { opacity: 0, y: 26, scale: 0.97 }}
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
            'radial-gradient(110% 95% at 100% 0%, var(--note-hi) 0%, transparent 60%), linear-gradient(170deg, var(--note-bg) 45%, var(--note-bg-2))',
          boxShadow: 'var(--note-shadow), inset 0 1px 0 rgba(255,255,255,0.1)',
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
        {/* The Flow fans in from the edge and pinches into the large spark; small sparks around it.
            Drawn from the left as in the design, mirrored for left-to-right languages. */}
        <span className="pointer-events-none absolute inset-0 -z-10 ltr:-scale-x-100" aria-hidden>
          <Flow className="absolute inset-0 size-full text-note-ink" />
          <Spark
            size={34}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-note-ink"
            style={{
              left: `${FLOW_PINCH.x / 10}%`,
              top: `${FLOW_PINCH.y / 5}%`,
              filter: 'drop-shadow(0 0 6px color-mix(in oklab, var(--note-ink) 70%, transparent))',
            }}
          />
          {SPARKS.map(([x, y, s], i) => (
            <Spark key={i} size={s} className="absolute text-note-ink opacity-80" style={{ left: `${x}%`, top: `${y}%` }} />
          ))}
          {DOTS.map(([x, y], i) => (
            <span key={i} className="absolute size-[3px] rounded-full bg-note-ink opacity-60" style={{ left: `${x}%`, top: `${y}%` }} />
          ))}
        </span>
        <span className="note-sheen" aria-hidden />
        <span className="note-glare" aria-hidden />

        <div className="relative px-4 pt-2.5 pb-1.5">
          <div className="flex items-center gap-2">
            <h2 id="note-title" className="text-[15px] text-note-ink">
              {t('home.total')}
            </h2>
            <span className="size-[5px] shrink-0 rounded-full bg-note-ink" aria-hidden />
            <span className="font-display text-[12px] text-note-ink-2 tabular" dir="ltr">
              {year} - {serial}
            </span>
            <PrivacyButton
              className="ms-auto -me-0.5 !size-[27px] text-note-ink [&>svg]:!size-[17px]"
              style={{ background: 'color-mix(in oklab, var(--note-ink) 40%, transparent)' }}
            />
          </div>

          <div className="relative mt-0.5 pe-2">
            <Odometer
              value={balances.total}
              className={`font-display leading-[1.05] font-normal ${size}`}
              decimalsClassName="text-[0.6em] text-note-ink ms-0.5"
              currencyClassName="text-[0.6em] text-note-ink mx-1.5"
            />
            <PulseChips pulses={totalPulses} className="-top-3 end-0" />
          </div>

          <div className="mt-1 flex items-center gap-2.5 text-[13px]">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5"
              style={{ background: 'var(--note-chip)', color: 'var(--note-chip-ink)' }}
            >
              {monthNet >= 0 ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
              <Money value={monthNet} sign className="font-display text-[14px]" />
            </span>
            <span className="text-note-ink">{t('home.monthNet')}</span>
          </div>

          {/* Cash / bank split */}
          <div className="mt-4 px-1">
            <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" style={{ background: split }} aria-hidden>
              <motion.span
                className="h-full rounded-full"
                style={{ background: 'var(--note-foil)' }}
                initial={reduced ? false : { width: '0%' }}
                animate={{ width: `${sum > 0 ? cashShare * 100 : 0}%` }}
                transition={{ type: 'spring', stiffness: 60, damping: 18, delay: reduced ? 0 : 0.9 }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-2">
                <span className="size-[7px] rounded-full" style={{ background: 'var(--note-foil)' }} aria-hidden />
                <span className="text-note-ink">{t('common.cash')}</span>
                <Money value={balances.cash} className="font-display text-[15px]" />
              </span>
              <span className="flex items-center gap-2">
                <span className="size-[7px] rounded-full" style={{ background: split }} aria-hidden />
                <span className="text-note-ink">{t('common.bank')}</span>
                <Money value={balances.bank} className="font-display text-[15px]" />
              </span>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
