import { motion } from 'motion/react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { lastDays } from '../../lib/ledger';
import { useWallet } from '../../state/WalletContext';
import { Guilloche } from '../ui/Engraving';
import { Money, Odometer } from '../ui/Money';
import { PrivacyButton } from './PrivacyButton';
import { PulseChips } from './PulseChips';

/**
 * The hero: total balance on a thick slab of frosted glass, with an etched rosette,
 * a 7-day pulse of money in/out and the cash/bank split.
 */
export function BalanceHero({ monthNet }: { monthNet: number }) {
  const { t, money, weekdayShort } = useI18n();
  const { balances, transactions, pulses } = useWallet();
  const totalPulses = pulses.filter((p) => p.target === 'total');
  const lastPulse = totalPulses[totalPulses.length - 1];

  const days = useMemo(() => lastDays(transactions, 7), [transactions]);
  const maxFlow = Math.max(1, ...days.map((d) => Math.abs(d.income - d.expense)));

  const cash = Math.max(0, balances.cash);
  const bank = Math.max(0, balances.bank);
  const sum = cash + bank;
  const cashShare = sum > 0 ? cash / sum : 0;

  return (
    <section aria-labelledby="hero-title" className="glass overflow-hidden rounded-[34px]">
      {lastPulse && (
        <motion.div
          key={lastPulse.id}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 rounded-[34px]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          style={{
            boxShadow: `inset 0 0 0 1.5px ${lastPulse.delta > 0 ? 'var(--in)' : 'var(--out)'}, inset 0 0 60px -14px ${
              lastPulse.delta > 0 ? 'var(--in)' : 'var(--out)'
            }`,
          }}
        />
      )}

      {/* Etched into the glass */}
      <Guilloche className="absolute -top-20 -end-20 -z-10 size-[280px] text-ink opacity-[0.07]" spin />

      <div className="relative px-6 pt-5 pb-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="hero-title" className="eyebrow">
            {t('home.total')}
          </h2>
          <PrivacyButton className="glass-pill -me-2 text-ink-2 hover:text-ink" />
        </div>

        <div className="relative mt-1">
          <Odometer
            value={balances.total}
            className="font-display text-[44px] leading-[1.08] font-light min-[380px]:text-[50px] sm:text-[58px]"
            decimalsClassName="text-[0.46em] text-ink-3 ms-0.5"
            currencyClassName="text-[0.5em] text-ink-3 mx-1"
          />
          <PulseChips pulses={totalPulses} className="-top-3 end-0" />
        </div>

        <div className="mt-3 flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span
              className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[13px]"
              style={{
                background: `color-mix(in oklab, ${monthNet >= 0 ? 'var(--in)' : 'var(--out)'} 14%, transparent)`,
                color: `color-mix(in oklab, ${monthNet >= 0 ? 'var(--in)' : 'var(--out)'} 85%, var(--ink))`,
                boxShadow: 'inset 0 1px 0 var(--rim)',
              }}
            >
              {monthNet >= 0 ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
              <Money value={monthNet} sign className="font-semibold" />
            </span>
            <span className="text-[12px] text-ink-3">{t('home.monthNet')}</span>
          </div>

          {/* 7-day pulse: net per day above / below the line */}
          <div
            className="flex h-12 items-stretch gap-[5px]"
            role="img"
            aria-label={days.map((d) => `${weekdayShort(d.date)} ${money(d.income - d.expense, { sign: true })}`).join('، ')}
          >
            {days.map((d, i) => {
              const net = d.income - d.expense;
              const h = Math.max(net === 0 ? 0 : 0.14, Math.abs(net) / maxFlow) * 50;
              return (
                <span key={d.key} className="relative flex w-[7px] flex-col">
                  <span className="flex flex-1 items-end">
                    {net > 0 && (
                      <motion.span
                        className="w-full rounded-full bg-in"
                        initial={{ height: 0 }}
                        animate={{ height: `${h * 2}%` }}
                        transition={{ delay: 0.2 + i * 0.05, type: 'spring', stiffness: 200, damping: 20 }}
                      />
                    )}
                  </span>
                  <span className="h-px w-full bg-line-strong" />
                  <span className="flex flex-1 items-start">
                    {net < 0 && (
                      <motion.span
                        className="w-full rounded-full bg-out"
                        initial={{ height: 0 }}
                        animate={{ height: `${h * 2}%` }}
                        transition={{ delay: 0.2 + i * 0.05, type: 'spring', stiffness: 200, damping: 20 }}
                      />
                    )}
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Cash / bank split */}
        <div className="mt-5">
          <div className="inset flex h-2.5 overflow-hidden rounded-full p-0.5" aria-hidden>
            <motion.span
              className="h-full rounded-full"
              style={{ background: 'var(--cash)' }}
              initial={false}
              animate={{ width: `${cashShare * 100}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
            {sum > 0 && <span className="ms-0.5 h-full flex-1 rounded-full" style={{ background: 'var(--bank)' }} />}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-cash" aria-hidden />
              <span className="text-ink-3">{t('common.cash')}</span>
              <Money value={balances.cash} className="font-medium" />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-bank" aria-hidden />
              <span className="text-ink-3">{t('common.bank')}</span>
              <Money value={balances.bank} className="font-medium" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
