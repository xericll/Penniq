import { motion } from 'motion/react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useI18n } from '../../i18n/LanguageContext';
import { useWallet } from '../../state/WalletContext';
import { Guilloche, MicroBorder } from '../ui/Engraving';
import { Logo } from '../ui/Logo';
import { Money, Odometer } from '../ui/Money';
import { PrivacyButton } from './PrivacyButton';
import { PulseChips } from './PulseChips';

/**
 * The hero: the total balance printed like a banknote — guilloché rosette,
 * micro-text frame, serial number and a watermark of the mark.
 */
export function BalanceNote({ monthNet }: { monthNet: number }) {
  const { t, money } = useI18n();
  const { balances, transactions, pulses } = useWallet();
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

  return (
    <motion.section
      aria-labelledby="note-title"
      className="relative isolate overflow-hidden rounded-[28px] text-note-ink"
      style={{
        background:
          'radial-gradient(120% 90% at 100% 0%, var(--note-bg-2) 0%, transparent 62%), radial-gradient(90% 80% at 0% 100%, color-mix(in oklab, var(--note-foil) 12%, transparent) 0%, transparent 70%), var(--note-bg)',
        boxShadow: '0 30px 60px -34px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {lastPulse && (
        <motion.div
          key={lastPulse.id}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 rounded-[28px]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          style={{
            boxShadow: `inset 0 0 0 1.5px ${lastPulse.delta > 0 ? 'var(--in)' : 'var(--out)'}, inset 0 0 48px -12px ${lastPulse.delta > 0 ? 'var(--in)' : 'var(--out)'}`,
          }}
        />
      )}
      {/* Engraving */}
      <Guilloche className="absolute -top-20 -end-24 -z-10 size-[300px] text-note-foil opacity-[0.22]" spin />
      <Guilloche className="absolute -bottom-36 -start-32 -z-10 size-[240px] text-note-foil opacity-[0.07]" density="light" />
      <Logo
        variant="mark"
        size={116}
        color="var(--note-foil)"
        className="pointer-events-none absolute -z-10 end-7 bottom-16 opacity-[0.07]"
      />
      <MicroBorder radius={28} className="text-note-foil opacity-45" />

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
            className={`font-display leading-[1.1] font-light ${size}`}
            decimalsClassName="text-[0.5em] text-note-ink-2 ms-0.5"
            currencyClassName="text-[0.55em] text-note-foil mx-1"
          />
          <PulseChips pulses={totalPulses} className="-top-3 end-0" />
        </div>

        <div className="mt-2 flex items-center gap-2 text-[13px]">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{
              background:
                monthNet >= 0 ? 'color-mix(in oklab, var(--in) 16%, transparent)' : 'color-mix(in oklab, var(--out) 16%, transparent)',
              color: monthNet >= 0 ? 'color-mix(in oklab, var(--in) 70%, white)' : 'color-mix(in oklab, var(--out) 70%, white)',
            }}
          >
            {monthNet >= 0 ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
            <Money value={monthNet} sign className="font-semibold" />
          </span>
          <span className="text-note-ink-2">{t('home.monthNet')}</span>
        </div>

        {/* Cash / bank split — a two-tone bar like the note's security thread */}
        <div className="mt-6">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
            <motion.span
              className="h-full rounded-full"
              style={{ background: 'var(--note-foil)' }}
              initial={false}
              animate={{ width: `${sum > 0 ? cashShare * 100 : 0}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
            <span
              className="h-full flex-1"
              style={{ background: sum > 0 ? 'color-mix(in oklab, var(--bank) 80%, white)' : 'transparent' }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: 'var(--note-foil)' }} aria-hidden />
              <span className="text-note-ink-2">{t('common.cash')}</span>
              <Money value={balances.cash} className="font-medium" />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: 'color-mix(in oklab, var(--bank) 80%, white)' }} aria-hidden />
              <span className="text-note-ink-2">{t('common.bank')}</span>
              <Money value={balances.bank} className="font-medium" />
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
