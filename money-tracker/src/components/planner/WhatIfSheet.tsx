import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { CATEGORIES, type CategoryId } from '../../lib/categories';
import { goalProgress } from '../../lib/goals';
import { monthlyAverages } from '../../lib/insights';
import { roundMoney } from '../../lib/ledger';
import { usePlanner } from '../../state/PlannerContext';
import { useWallet } from '../../state/WalletContext';
import { Money } from '../ui/Money';
import { parseNumber } from '../ui/Pickers';
import { Sheet } from '../ui/Sheet';
import { isolate } from '../../lib/bidi';

const HORIZONS = [3, 6, 12];

/**
 * "What if I saved 100 more a month, or spent 20 % less on dining?" Starts from the real monthly
 * averages of the last months and shows the money kept (wallet + vault) after 3, 6 and 12 months.
 */
export function WhatIfSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, money } = useI18n();
  const { transactions, allTransactions, balances } = useWallet();
  const { goals } = usePlanner();
  const avg = useMemo(() => monthlyAverages(transactions), [transactions]);
  const spendCats = useMemo(() => CATEGORIES.filter((c) => (avg.byCategory.get(c.id) ?? 0) > 0), [avg]);
  const [extra, setExtra] = useState('0');
  const [category, setCategory] = useState<CategoryId | ''>('');
  const [cut, setCut] = useState(20);
  const [goalId, setGoalId] = useState('');

  useEffect(() => {
    if (!open) return;
    setExtra('0');
    setCut(20);
    setCategory(spendCats.sort((a, b) => (avg.byCategory.get(b.id) ?? 0) - (avg.byCategory.get(a.id) ?? 0))[0]?.id ?? '');
    setGoalId(goals.find((g) => !goalProgress(g, allTransactions).reached)?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const start = roundMoney(balances.total + balances.vault);
  const baseNet = roundMoney(avg.income - avg.expense);
  const extraNum = Math.max(0, parseNumber(extra) || 0);
  const cutAmount = category ? roundMoney(((avg.byCategory.get(category) ?? 0) * cut) / 100) : 0;
  const planNet = roundMoney(baseNet + extraNum + cutAmount);
  const at = (net: number, months: number) => roundMoney(start + net * months);
  const slider = Math.max(100, Math.round((avg.income || avg.expense || 1000) / 2 / 10) * 10);

  const goal = goals.find((g) => g.id === goalId);
  const gp = goal ? goalProgress(goal, allTransactions) : null;
  const monthsTo = (net: number) => (gp && net > 0 ? Math.ceil(gp.remaining / net) : null);

  // Chart: twelve months, both paths.
  const W = 300;
  const H = 120;
  const pts = (net: number) => Array.from({ length: 13 }, (_, m) => at(net, m));
  const base = pts(baseNet);
  const plan = pts(planNet);
  const lo = Math.min(...base, ...plan, 0);
  const hi = Math.max(...base, ...plan, 1);
  const y = (v: number) => H - 8 - ((v - lo) / (hi - lo || 1)) * (H - 16);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${((i / 12) * W).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  return (
    <Sheet open={open} onClose={onClose} title={t('whatif.title')}>
      <p className="text-[14px] leading-relaxed text-ink-2">
        {t('whatif.basis', { months: avg.months, income: isolate(money(avg.income)), expense: isolate(money(avg.expense)) })}
      </p>

      <div className="mt-5 space-y-5">
        <label className="block">
          <span className="flex items-baseline justify-between gap-3">
            <span className="eyebrow">{t('whatif.extra')}</span>
            <Money value={extraNum} className="text-[15px] font-semibold" />
          </span>
          <input
            type="range"
            min={0}
            max={slider}
            step={slider >= 1000 ? 50 : 10}
            value={Math.min(slider, extraNum)}
            onChange={(e) => setExtra(e.target.value)}
            className="mt-2 w-full accent-[var(--foil)]"
            dir="ltr"
          />
        </label>

        {spendCats.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="eyebrow">{t('whatif.cut')}</span>
              <span className="text-[15px] font-semibold tabular" dir="ltr">
                −{cut}%
              </span>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryId)}
              className="field mt-2 min-h-11 py-0 text-[14px]"
              aria-label={t('composer.category')}
            >
              {spendCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(c.labelKey)} · {isolate(money(avg.byCategory.get(c.id) ?? 0))}
                </option>
              ))}
            </select>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={cut}
              onChange={(e) => setCut(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--foil)]"
              dir="ltr"
              aria-label={t('whatif.cut')}
            />
            <p className="text-[12px] text-ink-3">{t('whatif.cutSaves', { amount: isolate(money(cutAmount)) })}</p>
          </div>
        )}
      </div>

      {/* Result */}
      <div className="mt-6 rounded-2xl bg-surface-2 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-ink-3" aria-hidden />
            {t('whatif.now')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-foil" aria-hidden />
            {t('whatif.plan')}
          </span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-[120px] w-full" preserveAspectRatio="none" aria-hidden>
          {lo < 0 && <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--line-strong)" strokeDasharray="4 4" />}
          <path d={path(base)} fill="none" stroke="var(--ink-3)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <motion.path
            key={planNet}
            d={path(plan)}
            fill="none"
            stroke="var(--foil)"
            strokeWidth={2.5}
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {HORIZONS.map((m) => (
            <div key={m} className="min-w-0 rounded-xl bg-surface p-2.5 text-center">
              <div className="text-[11px] leading-tight text-ink-3">{t('whatif.after', { months: m })}</div>
              <Money value={at(planNet, m)} className="font-display mt-1 block truncate text-[16px]" />
              <Money value={roundMoney((planNet - baseNet) * m)} sign tone className="block truncate text-[12px] font-medium" />
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-ink-2">
          {t('whatif.monthly', { now: isolate(money(baseNet)), plan: isolate(money(planNet)) })}
        </p>
      </div>

      {goals.length > 0 && (
        <div className="mt-4">
          <select
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="field min-h-11 py-0 text-[14px]"
            aria-label={t('whatif.goal')}
          >
            <option value="">{t('whatif.noGoal')}</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {goal && gp && (
            <p className="mt-2 rounded-2xl border border-line px-4 py-3 text-[14px] leading-relaxed text-ink-2">
              {gp.reached
                ? t('goal.reached')
                : monthsTo(planNet) === null
                  ? t('whatif.goalNever', { name: goal.name })
                  : t('whatif.goalIn', { name: goal.name, plan: monthsTo(planNet)!, now: monthsTo(baseNet) ?? '∞' })}
            </p>
          )}
        </div>
      )}
      <p className="mt-4 text-[12px] leading-relaxed text-ink-3">{t('whatif.note')}</p>
    </Sheet>
  );
}
