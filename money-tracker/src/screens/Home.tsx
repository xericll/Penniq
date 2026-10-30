import { motion, useReducedMotion } from 'motion/react';
import { ArrowDown, ArrowDownLeft, ArrowLeftRight, ArrowUp, ArrowUpRight, ChevronLeft, Coins, Gem, Target } from 'lucide-react';
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { BalanceNote } from '../components/home/BalanceNote';
import { Pockets } from '../components/home/Pockets';
import { EssentialsCard, Reserves } from '../components/home/Reserves';
import { TemplateRail } from '../components/planner/QuickRecord';
import { WorkspaceChip } from '../components/sheets/WorkspaceSheets';
import { TxRow } from '../components/tx/TxRow';
import { AssistantButton } from '../components/ui/AssistantButton';
import { Guilloche } from '../components/ui/Engraving';
import { Logo } from '../components/ui/Logo';
import { OliveBranch } from '../components/ui/Olive';
import { Money } from '../components/ui/Money';
import { useI18n } from '../i18n/LanguageContext';
import { currencyName } from '../lib/currency';
import { goalProgress } from '../lib/goals';
import { leakReport } from '../lib/insights';
import { byNewest, periodSummary } from '../lib/ledger';
import { usePlanner } from '../state/PlannerContext';
import { useWallet } from '../state/WalletContext';
import type { AccountType, Tab, Transaction, TransactionType } from '../types';
import { useNetWorth } from '../hooks/useNetWorth';
import { isolate } from '../lib/bidi';

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
    <div className="relative isolate space-y-4">
      <header className="relative z-10">
        <div className="flex h-11 items-center justify-between">
          <Logo variant="mark" size={24} className="lg:invisible" />
          <AssistantButton onClick={onAssistant} />
        </div>
        <h1 className="font-display mt-2 text-[34px] leading-[1.25] lg:text-[40px]">
          <RevealWords text={greeting} />
        </h1>
        <motion.p
          className="text-[14px] text-ink-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          {dateLabel(new Date())}
        </motion.p>
        <WorkspaceChip className="mt-3" />
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="relative space-y-4">
          {/* An olive branch reaches in from the edge and rests on the note (in front of it). */}
          <OliveBranch kind="hero" className="absolute -end-4 -top-[86px] z-20 w-[230px] sm:-end-6 lg:hidden ltr:scale-x-[-1]" />
          {/* A sprig tucked behind the cards lower down. */}
          <OliveBranch kind="corner" className="absolute -start-4 bottom-[6%] -z-10 w-[150px] sm:-start-6 ltr:scale-x-[-1]" />
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
            <div className="mt-2.5">
              <TemplateRail />
            </div>
          </Reveal>

          <MoneyLeak onOpen={() => onNavigate('insights')} />

          <Reveal i={3}>
            <Reserves onVault={onVault} onDebts={onDebts} />
          </Reveal>

          <Reveal i={4}>
            <WealthCard onOpen={() => onNavigate('wealth')} />
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

/** Cards arrive one after another, from soft focus to sharp. */
function Reveal({ i, children }: { i: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + i * 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** The greeting rises word by word from behind its own line. */
function RevealWords({ text }: { text: string }) {
  return (
    <span aria-label={text}>
      {text.split(' ').map((word, i) => (
        <span key={i} aria-hidden>
          {i > 0 && ' '}
          <span className="reveal-word">
            <span style={{ '--w': i } as CSSProperties}>{word}</span>
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * Where the money goes this month, worked out on the device: the top category with its amount and
 * share, the small entries that keep coming back, and spending against the same days of last month.
 */
function MoneyLeak({ onOpen }: { onOpen: () => void }) {
  const { t, money, localize } = useI18n();
  const { transactions } = useWallet();
  const report = useMemo(() => leakReport(transactions), [transactions]);
  const top = report.top;
  if (!top) return null;
  const pct = Math.round(top.share * 100);
  const Icon = top.category.icon;
  const r = 26;
  const c = 2 * Math.PI * r;
  const change = report.lastMonthSameDays > 0 ? (report.monthToDate - report.lastMonthSameDays) / report.lastMonthSameDays : null;
  const up = change !== null && change > 0;

  return (
    <Reveal i={3}>
      <button type="button" onClick={onOpen} className="card press block w-full p-4 text-start hover:border-line-strong">
        <span className="flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-coin" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{t('home.leak.title')}</span>
          {change !== null && Math.abs(change) >= 0.01 && (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[12px] font-semibold"
              style={{
                background: `color-mix(in oklab, ${up ? 'var(--out)' : 'var(--in)'} 16%, transparent)`,
                color: `color-mix(in oklab, ${up ? 'var(--out)' : 'var(--in)'} 85%, var(--ink))`,
              }}
              title={t('leak.vsLast')}
            >
              {up ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
              <span dir="ltr" className="tabular">
                {Math.round(Math.abs(change) * 100)}%
              </span>
            </span>
          )}
        </span>

        <span className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <span className="min-w-0 text-[13px] leading-relaxed text-ink-2">
            {t('leak.top', { category: t(top.category.labelKey), amount: isolate(money(top.amount)), pct })}
            {report.topLastMonth > 0 && (
              <span className="mt-0.5 block text-[12px] text-ink-3">
                {t('leak.topLast', { amount: isolate(money(report.topLastMonth)) })}
              </span>
            )}
          </span>
          <span className="relative grid size-[62px] place-items-center" style={{ color: top.category.hue }} aria-hidden>
            <svg viewBox="0 0 62 62" className="absolute inset-0 -rotate-90">
              <circle cx="31" cy="31" r={r} fill="none" strokeWidth="6" style={{ stroke: 'var(--surface-2)' }} />
              <motion.circle
                cx="31"
                cy="31"
                r={r}
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                stroke="currentColor"
                strokeDasharray={c}
                initial={{ strokeDashoffset: c }}
                animate={{ strokeDashoffset: c * (1 - top.share) }}
                transition={{ duration: 1.4, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
              />
            </svg>
            <Icon className="size-5" />
          </span>
        </span>

        {report.small.length > 0 && (
          <span className="mt-3 block border-t border-line pt-3">
            <span className="eyebrow block">{t('leak.small')}</span>
            {report.small.map((leak) => {
              const LeakIcon = leak.category.icon;
              return (
                <span key={leak.reason} className="mt-2 flex items-center gap-2 text-[13px]">
                  <LeakIcon className="size-4 shrink-0" style={{ color: leak.category.hue }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-ink-2">
                    {t('leak.repeat', { name: localize(leak.reason), count: leak.count })}
                  </span>
                  <Money value={leak.total} className="shrink-0 font-semibold" />
                </span>
              );
            })}
          </span>
        )}

        {change !== null && (
          <span className="mt-3 block text-[12px] text-ink-3">
            {t('leak.compare', { now: isolate(money(report.monthToDate)), last: isolate(money(report.lastMonthSameDays)) })}
          </span>
        )}
      </button>
    </Reveal>
  );
}

/** Assets and savings goals at a glance; opens the Wealth screen. */
function WealthCard({ onOpen }: { onOpen: () => void }) {
  const { t } = useI18n();
  const { allTransactions } = useWallet();
  const { assets, goals, prefs } = usePlanner();
  const net = useNetWorth();
  const goalShare = useMemo(() => {
    if (!goals.length) return null;
    const ps = goals.map((g) => goalProgress(g, allTransactions));
    return Math.round((ps.reduce((s, p) => s + p.share, 0) / ps.length) * 100);
  }, [goals, allTransactions]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="card press group flex min-h-[72px] w-full items-center gap-3 p-4 text-start hover:border-line-strong"
    >
      <span className="coin grid size-10 shrink-0 place-items-center rounded-xl" aria-hidden>
        <Gem className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{t('wealth.cardTitle')}</span>
        <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-3">
          {assets.length || goals.length
            ? [
                assets.length ? t('wealth.assetCount', { count: assets.length }) : '',
                goalShare !== null ? t('wealth.goalShare', { count: goals.length, pct: goalShare }) : '',
              ]
                .filter(Boolean)
                .join(' · ')
            : t('wealth.cardHint')}
        </span>
      </span>
      {(assets.length > 0 || prefs.netWorth) && (
        <span className="flex shrink-0 flex-col items-end leading-tight">
          {prefs.netWorth && <span className="text-[11px] text-ink-3">{t('wealth.netWorth')}</span>}
          <Money value={prefs.netWorth ? net.total : net.assets} className="font-display text-[17px]" />
        </span>
      )}
      <ChevronLeft
        className="size-4 shrink-0 text-ink-3 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  );
}

function ActionButton({ label, hue, icon, onClick }: { label: string; hue: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card press group flex min-h-[76px] flex-col items-center justify-center gap-1.5 transition-transform duration-300 hover:-translate-y-0.5 hover:border-line-strong"
    >
      <span
        className="grid size-9 place-items-center rounded-full transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-0.5 group-hover:scale-110"
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
