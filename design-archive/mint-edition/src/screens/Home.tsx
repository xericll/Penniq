import { motion } from 'motion/react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronLeft, Coins, Target } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { BalanceNote } from '../components/home/BalanceNote';
import { Pockets } from '../components/home/Pockets';
import { EssentialsCard, Reserves } from '../components/home/Reserves';
import { TxRow } from '../components/tx/TxRow';
import { AssistantButton } from '../components/ui/AssistantButton';
import { Guilloche } from '../components/ui/Engraving';
import { Money } from '../components/ui/Money';
import { useI18n } from '../i18n/LanguageContext';
import { currencyName } from '../lib/currency';
import { byNewest, periodSummary } from '../lib/ledger';
import { useWallet } from '../state/WalletContext';
import type { AccountType, Tab, Transaction, TransactionType } from '../types';
import { ScreenHeader } from './ScreenHeader';

interface HomeProps {
  onCompose: (type: TransactionType, account?: AccountType) => void;
  onOpenAccount: (a: AccountType) => void;
  onOpenTx: (tx: Transaction) => void;
  onNavigate: (tab: Tab) => void;
  onOpening: () => void;
  onVault: () => void;
  onDebts: () => void;
  onEssentials: () => void;
  onCurrency: () => void;
  onAssistant: () => void;
}

export function Home({
  onCompose,
  onOpenAccount,
  onOpenTx,
  onNavigate,
  onOpening,
  onVault,
  onDebts,
  onEssentials,
  onCurrency,
  onAssistant,
}: HomeProps) {
  const { t, info, dateLabel } = useI18n();
  const { transactions, budget } = useWallet();
  const summary = useMemo(() => periodSummary(transactions, info.weekStartsOn), [transactions, info.weekStartsOn]);
  const recent = useMemo(() => [...transactions].sort(byNewest).slice(0, 5), [transactions]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('greet.morning') : hour < 17 ? t('greet.afternoon') : t('greet.evening');
  const empty = transactions.length === 0;

  return (
    <div className="space-y-4">
      <ScreenHeader title={greeting} subtitle={dateLabel(new Date())} brand actions={<AssistantButton onClick={onAssistant} />} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="space-y-4">
          <Reveal i={0}>
            <BalanceNote monthNet={summary.month.net} />
          </Reveal>

          {empty && (
            <Reveal i={1}>
              <Onboarding onOpening={onOpening} onFirst={() => onCompose('income')} onCurrency={onCurrency} />
            </Reveal>
          )}

          <Reveal i={1}>
            <Pockets onOpenAccount={onOpenAccount} onTransfer={() => onCompose('transfer')} />
          </Reveal>

          <Reveal i={2}>
            <div className="grid grid-cols-3 gap-2.5">
              <ActionButton
                label={t('common.expense')}
                hue="var(--out)"
                icon={<ArrowUpRight className="size-5" />}
                onClick={() => onCompose('expense')}
              />
              <ActionButton
                label={t('common.income')}
                hue="var(--in)"
                icon={<ArrowDownLeft className="size-5" />}
                onClick={() => onCompose('income')}
              />
              <ActionButton
                label={t('common.transfer')}
                hue="var(--bank)"
                icon={<ArrowLeftRight className="size-5" />}
                onClick={() => onCompose('transfer')}
              />
            </div>
          </Reveal>

          <Reveal i={3}>
            <Reserves onVault={onVault} onDebts={onDebts} />
          </Reveal>

          <Reveal i={4}>
            <EssentialsCard onOpen={onEssentials} />
          </Reveal>
        </div>

        <div className="space-y-4">
          {empty ? null : (
            <>
              <Reveal i={3}>
                <button
                  type="button"
                  onClick={() => onNavigate('insights')}
                  className="card press grid w-full grid-cols-3 divide-x divide-line p-0 text-start hover:border-line-strong"
                >
                  <Stat label={t('home.today')}>
                    <Money value={summary.today.net} sign tone className="text-[16px] font-semibold" />
                  </Stat>
                  <Stat label={t('home.thisMonth')}>
                    <span className="flex flex-col leading-tight">
                      <Money value={summary.month.income} sign className="text-[13px] font-medium text-in" />
                      <Money value={-summary.month.expense} className="text-[13px] font-medium text-out" />
                    </span>
                  </Stat>
                  <BudgetStat budget={budget} spent={summary.month.expense} />
                </button>
              </Reveal>

              <Reveal i={4}>
                <section className="card p-2" aria-labelledby="recent-title">
                  <div className="flex items-center justify-between px-3 pt-2 pb-1">
                    <h2 id="recent-title" className="text-[15px] font-semibold">
                      {t('home.recent')}
                    </h2>
                    <button
                      type="button"
                      onClick={() => onNavigate('activity')}
                      className="press -me-1 flex min-h-11 items-center gap-1 rounded-xl px-2 text-[14px] font-medium text-foil"
                    >
                      {t('common.seeAll')}
                      <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden />
                    </button>
                  </div>
                  <div>
                    {recent.map((tx) => (
                      <TxRow key={tx.id} tx={tx} onOpen={onOpenTx} />
                    ))}
                  </div>
                </section>
              </Reveal>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Onboarding({ onOpening, onFirst, onCurrency }: { onOpening: () => void; onFirst: () => void; onCurrency: () => void }) {
  const { t, lang, currency } = useI18n();
  return (
    <section className="card relative overflow-hidden p-6 text-center">
      <Guilloche className="mx-auto -mt-2 mb-3 size-24 text-foil opacity-60" density="light" spin />
      <h2 className="text-[18px] font-semibold">{t('home.empty.title')}</h2>
      <p className="mx-auto mt-1.5 max-w-xs text-[15px] leading-relaxed text-ink-2">{t('home.empty.body')}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onOpening} className="foil press min-h-12 rounded-2xl px-4 text-[15px] font-semibold">
          {t('home.empty.opening')}
        </button>
        <button
          type="button"
          onClick={onFirst}
          className="press min-h-12 rounded-2xl border border-line-strong px-4 text-[15px] font-medium hover:bg-surface-2"
        >
          {t('home.empty.first')}
        </button>
      </div>
      <button
        type="button"
        onClick={onCurrency}
        className="press mx-auto mt-3 flex min-h-11 items-center gap-2 rounded-xl px-3 text-[14px] text-ink-2 hover:text-ink"
      >
        <Coins className="size-4 shrink-0" aria-hidden />
        <span>{t('currency.current', { name: currencyName(currency, lang) })}</span>
        <span className="font-medium text-foil">{t('currency.change')}</span>
      </button>
    </section>
  );
}

function Reveal({ i, children }: { i: number; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function ActionButton({ label, hue, icon, onClick }: { label: string; hue: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card press flex min-h-[76px] flex-col items-center justify-center gap-1.5 hover:border-line-strong"
    >
      <span
        className="grid size-9 place-items-center rounded-full"
        style={{ background: `color-mix(in oklab, ${hue} 18%, transparent)`, color: `color-mix(in oklab, ${hue} 85%, var(--ink))` }}
        aria-hidden
      >
        {icon}
      </span>
      <span className="text-[14px] font-medium">{label}</span>
    </button>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex min-h-[76px] min-w-0 flex-col justify-center gap-1 px-4 py-3">
      <span className="eyebrow truncate">{label}</span>
      {children}
    </span>
  );
}

function BudgetStat({ budget, spent }: { budget: number | null; spent: number }) {
  const { t } = useI18n();
  if (!budget) {
    return (
      <Stat label={t('home.budget')}>
        <span className="flex items-center gap-1 text-[13px] font-medium text-foil">
          <Target className="size-3.5" aria-hidden />
          <span className="leading-tight">{t('budget.set')}</span>
        </span>
      </Stat>
    );
  }
  const left = budget - spent;
  const pct = Math.min(1, spent / budget);
  const color = pct >= 1 ? 'var(--out)' : pct >= 0.8 ? 'var(--foil)' : 'var(--in)';
  return (
    <Stat label={left >= 0 ? t('budget.left') : t('budget.over')}>
      <Money value={Math.abs(left)} className="text-[16px] font-semibold" />
      <span className="h-1 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <span className="block h-full rounded-full" style={{ width: `${pct * 100}%`, background: color }} />
      </span>
    </Stat>
  );
}
