import { motion } from 'motion/react';
import { Check, Pencil, Target } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Money } from '../components/ui/Money';
import { Segmented } from '../components/ui/Segmented';
import { useI18n } from '../i18n/LanguageContext';
import { haptic } from '../lib/haptics';
import { categoryBreakdown, daysLeftInMonth, lastDays, periodSummary, startOfMonth, type FlowStats } from '../lib/ledger';
import { useToast } from '../state/ToastContext';
import { useWallet } from '../state/WalletContext';
import { ScreenHeader } from './ScreenHeader';

export function Insights() {
  const { t, info, monthLabel } = useI18n();
  const { transactions } = useWallet();
  const summary = useMemo(() => periodSummary(transactions, info.weekStartsOn), [transactions, info.weekStartsOn]);

  return (
    <div className="space-y-4">
      <ScreenHeader title={t('insights.title')} subtitle={monthLabel(new Date())} />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <BudgetCard spent={summary.month.expense} />
          <PeriodGrid summary={summary} />
        </div>
        <div className="space-y-4">
          <WeekChart />
          <CategoryCard />
        </div>
      </div>
    </div>
  );
}

function Card({ title, action, children, className = '' }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      <div className="mb-4 flex min-h-8 items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ---------------- Budget ---------------- */

function BudgetCard({ spent }: { spent: number }) {
  const { t, money } = useI18n();
  const { budget, setBudget } = useWallet();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const startEdit = () => {
    setValue(budget ? String(budget) : '');
    setEditing(true);
  };

  const save = () => {
    const n = parseFloat(value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return;
    setBudget(Math.round(n * 100) / 100);
    setEditing(false);
    haptic('success');
    toast.show({ message: t('toast.budgetSaved') });
  };

  const editor = (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="relative flex-1" dir="ltr">
        <span className="sr-only">{t('budget.inputLabel')}</span>
        <input
          className="field pe-10 tabular"
          inputMode="decimal"
          dir="ltr"
          autoFocus
          value={value}
          placeholder={t('budget.placeholder')}
          onChange={(e) => setValue(e.target.value)}
        />
        <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-ink-3">€</span>
      </label>
      <button
        type="submit"
        className="btn-primary press grid min-h-12 min-w-12 place-items-center rounded-[14px]"
        aria-label={t('common.save')}
      >
        <Check className="size-5" strokeWidth={2.5} />
      </button>
    </form>
  );

  if (!budget) {
    return (
      <Card title={t('budget.title')}>
        <div className="flex items-start gap-3">
          <span className="glass-pill grid size-11 shrink-0 place-items-center rounded-full text-accent" aria-hidden>
            <Target className="size-5" />
          </span>
          <p className="text-[15px] leading-relaxed text-ink-2">{t('budget.empty')}</p>
        </div>
        <div className="mt-4">
          {editing ? (
            editor
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="btn-primary press min-h-[52px] w-full rounded-full text-[15px] font-semibold"
            >
              {t('budget.set')}
            </button>
          )}
        </div>
      </Card>
    );
  }

  const pct = spent / budget;
  const left = budget - spent;
  const days = daysLeftInMonth();
  const status = pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok';
  const color = status === 'over' ? 'var(--out)' : status === 'warn' ? 'var(--accent)' : 'var(--in)';
  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <Card
      title={t('budget.title')}
      action={
        !editing && (
          <button
            type="button"
            onClick={startEdit}
            className="press glass-pill -me-1 grid size-10 place-items-center rounded-full text-ink-2"
            aria-label={t('common.edit')}
          >
            <Pencil className="size-4" />
          </button>
        )
      }
    >
      <div className="flex items-center gap-5">
        <div className="relative size-[132px] shrink-0">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
            <motion.circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={color}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={C}
              initial={{ strokeDashoffset: C }}
              animate={{ strokeDashoffset: C * (1 - Math.min(1, pct)) }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-display text-[26px] leading-none tabular">{Math.round(pct * 100)}%</span>
            <span className="mt-1 text-[12px] text-ink-3">{t('budget.spent')}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold"
            style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color: `color-mix(in oklab, ${color} 85%, var(--ink))` }}
          >
            {status === 'over' ? t('budget.overStatus') : status === 'warn' ? t('budget.warn') : t('budget.ok')}
          </span>
          <div>
            <div className="eyebrow">{left >= 0 ? t('budget.left') : t('budget.over')}</div>
            <Money value={Math.abs(left)} className="font-display text-[26px] leading-tight" />
          </div>
          <div className="text-[13px] text-ink-3">
            <Money value={spent} /> {t('budget.of', { amount: '' })}
            <Money value={budget} />
          </div>
        </div>
      </div>
      {left > 0 && (
        <p className="inset mt-4 rounded-[20px] px-4 py-3 text-[14px] text-ink-2">
          {t('budget.daily', { amount: money(left / days) })} · {t('budget.daysLeft', { days })}
        </p>
      )}
      {editing && <div className="mt-4">{editor}</div>}
    </Card>
  );
}

/* ---------------- Periods ---------------- */

function PeriodGrid({ summary }: { summary: ReturnType<typeof periodSummary> }) {
  const { t } = useI18n();
  const items: [string, FlowStats][] = [
    [t('periods.today'), summary.today],
    [t('periods.yesterday'), summary.yesterday],
    [t('periods.week'), summary.week],
    [t('periods.month'), summary.month],
  ];
  return (
    <Card title={t('periods.title')}>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map(([label, s]) => (
          <div key={label} className="inset p-3.5">
            <div className="eyebrow">{label}</div>
            <Money value={s.net} sign tone className="font-display mt-1 block text-[22px] leading-tight" />
            <div className="mt-1.5 flex flex-wrap gap-x-2 text-[12px] text-ink-3">
              <Money value={s.income} sign className="text-in" />
              <Money value={-s.expense} className="text-out" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- 7-day chart ---------------- */

function WeekChart() {
  const { t, money, weekdayShort, dayLabel } = useI18n();
  const { transactions } = useWallet();
  const days = useMemo(() => lastDays(transactions, 7), [transactions]);
  const [selected, setSelected] = useState(days.length - 1);
  const max = Math.max(1, ...days.map((d) => Math.max(d.income, d.expense)));
  const totalIn = days.reduce((s, d) => s + d.income, 0);
  const totalOut = days.reduce((s, d) => s + d.expense, 0);
  const sel = days[selected];
  const empty = totalIn === 0 && totalOut === 0;

  return (
    <Card
      title={t('week.title')}
      action={
        <div className="flex items-center gap-3 text-[12px] text-ink-3" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-[3px] bg-in" />
            {t('common.in')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-[3px] bg-out" />
            {t('common.out')}
          </span>
        </div>
      }
    >
      <p className="sr-only">{t('week.summary', { in: money(totalIn), out: money(totalOut) })}</p>

      <div className="inset mb-3 flex min-h-12 items-end justify-between gap-3 rounded-[20px] px-4 py-2.5">
        <span className="text-[14px] font-medium">{dayLabel(sel.date)}</span>
        <span className="flex gap-3 text-[14px]">
          <Money value={sel.income} sign className="font-semibold text-in" />
          <Money value={-sel.expense} className="font-semibold text-out" />
        </span>
      </div>

      <div role="group" aria-label={t('week.hint')} className="flex h-44 items-stretch gap-1.5">
        {days.map((d, i) => {
          const active = i === selected;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => {
                haptic('tap');
                setSelected(i);
              }}
              aria-pressed={active}
              aria-label={`${dayLabel(d.date)}: ${t('common.in')} ${money(d.income)}, ${t('common.out')} ${money(d.expense)}`}
              className={`group flex flex-1 flex-col items-center rounded-full px-0.5 pt-1 transition-[background-color,box-shadow] duration-300 ${active ? 'glass-pill' : 'hover:bg-white/20'}`}
            >
              <span className="flex w-full flex-1 items-end justify-center">
                <motion.span
                  className="w-[62%] max-w-6 rounded-t-md bg-in"
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.income / max) * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  style={{ opacity: active ? 1 : 0.7, minHeight: d.income > 0 ? 3 : 0 }}
                />
              </span>
              <span className="h-px w-full bg-line-strong" aria-hidden />
              <span className="flex w-full flex-1 items-start justify-center">
                <motion.span
                  className="w-[62%] max-w-6 rounded-b-md bg-out"
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.expense / max) * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  style={{ opacity: active ? 1 : 0.7, minHeight: d.expense > 0 ? 3 : 0 }}
                />
              </span>
              <span className={`mt-1.5 mb-1 text-[11px] ${active ? 'font-semibold text-ink' : 'text-ink-3'}`}>
                {i === days.length - 1 ? t('day.today') : weekdayShort(d.date)}
              </span>
            </button>
          );
        })}
      </div>
      {empty && <p className="mt-3 text-center text-[13px] text-ink-3">{t('week.empty')}</p>}
    </Card>
  );
}

/* ---------------- Categories ---------------- */

function CategoryCard() {
  const { t } = useI18n();
  const { transactions } = useWallet();
  const [range, setRange] = useState<'month' | 'all'>('month');
  const { slices, total } = useMemo(
    () => categoryBreakdown(transactions, range === 'month' ? startOfMonth() : undefined),
    [transactions, range],
  );

  return (
    <Card title={t('cats.title')}>
      <Segmented
        label={t('cats.title')}
        value={range}
        onChange={setRange}
        options={[
          { value: 'month', label: t('cats.month') },
          { value: 'all', label: t('cats.all') },
        ]}
        className="mb-4"
      />
      {slices.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-ink-3">{t('cats.empty')}</p>
      ) : (
        <>
          <div className="flex h-3 gap-[3px] overflow-hidden rounded-full" aria-hidden>
            {slices.map((s) => (
              <motion.span
                key={s.category.id}
                className="h-full first:rounded-s-full last:rounded-e-full"
                style={{ background: s.category.hue }}
                initial={{ flexGrow: 0 }}
                animate={{ flexGrow: s.share }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[13px] text-ink-3">
            <span>{t('common.expense')}</span>
            <Money value={total} className="font-semibold text-ink" />
          </div>
          <ul className="mt-3 space-y-1">
            {slices.map((s) => {
              const Icon = s.category.icon;
              return (
                <li key={s.category.id} className="flex items-center gap-3 py-2">
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-[13px]"
                    style={{
                      background: `color-mix(in oklab, ${s.category.hue} 16%, transparent)`,
                      color: `color-mix(in oklab, ${s.category.hue} 80%, var(--ink))`,
                    }}
                    aria-hidden
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[15px] font-medium">{t(s.category.labelKey)}</span>
                      <Money value={s.amount} className="text-[15px] font-semibold" />
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="inset h-1.5 flex-1 overflow-hidden rounded-full">
                        <span className="block h-full rounded-full" style={{ width: `${s.share * 100}%`, background: s.category.hue }} />
                      </span>
                      <span dir="ltr" className="w-20 text-end text-[12px] text-ink-3 tabular">
                        {Math.round(s.share * 100)}% · {s.count}×
                      </span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
