import { motion, useReducedMotion } from 'motion/react';
import { ArrowDown, ArrowUp, Award, PiggyBank, Share2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { celebrate } from '../../lib/confetti';
import { goalProgress } from '../../lib/goals';
import { haptic } from '../../lib/haptics';
import { savingsRate } from '../../lib/insights';
import { LEVELS, POINTS, progressOf } from '../../lib/levels';
import { usePlanner } from '../../state/PlannerContext';
import { useToast } from '../../state/ToastContext';
import { useTools } from '../../state/ToolsContext';
import { useWallet } from '../../state/WalletContext';
import { Money } from '../ui/Money';

/** What share of this month's income was kept, compared with last month. Transfers never count. */
export function SavingsRateCard() {
  const { t } = useI18n();
  const { transactions } = useWallet();
  const tools = useTools();
  const reduced = useReducedMotion();
  const s = useMemo(() => savingsRate(transactions), [transactions]);
  const diff = s.rate !== null && s.lastRate !== null ? Math.round(s.rate - s.lastRate) : null;

  return (
    <section className="card p-5" aria-labelledby="savings-rate">
      <div className="flex items-center gap-2">
        <PiggyBank className="size-5 text-foil" aria-hidden />
        <h2 id="savings-rate" className="flex-1 text-[16px] font-semibold">
          {t('savings.title')}
        </h2>
        {s.rate !== null && s.rate > 0 && (
          <button
            type="button"
            onClick={() => tools.open({ name: 'achievement', kind: 'savings' })}
            aria-label={t('achievement.share')}
            className="press -me-2 grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
          >
            <Share2 className="size-4" />
          </button>
        )}
      </div>
      {s.rate === null ? (
        <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{t('savings.noIncome')}</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
            <motion.span
              key={Math.round(s.rate)}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`font-display text-[52px] leading-none tabular ${s.rate < 0 ? 'text-out' : ''}`}
              dir="ltr"
            >
              {Math.round(s.rate)}%
            </motion.span>
            {diff !== null && diff !== 0 && (
              <span
                className="mb-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold"
                style={{
                  background: `color-mix(in oklab, ${diff > 0 ? 'var(--in)' : 'var(--out)'} 16%, transparent)`,
                  color: `color-mix(in oklab, ${diff > 0 ? 'var(--in)' : 'var(--out)'} 85%, var(--ink))`,
                }}
              >
                {diff > 0 ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />}
                {t('savings.points', { n: Math.abs(diff) })}
              </span>
            )}
          </div>
          <p className="mt-2 text-[13px] text-ink-3">
            {s.rate >= 0 ? t('savings.kept', { amount: '' }) : t('savings.overspent', { amount: '' })}
            <Money value={Math.abs(s.income - s.expense)} className="font-medium text-ink-2" /> · {t('savings.of')}{' '}
            <Money value={s.income} />
          </p>
          <p className="mt-1 text-[12px] text-ink-3">
            {s.lastRate === null ? t('savings.noLast') : t('savings.last', { pct: Math.round(s.lastRate) })}
          </p>
        </>
      )}
    </section>
  );
}

function useProgress() {
  const { transactions, allTransactions, budget } = useWallet();
  const { goals } = usePlanner();
  const { info } = useI18n();
  const reached = useMemo(() => goals.filter((g) => goalProgress(g, allTransactions).reached).length, [goals, allTransactions]);
  return useMemo(() => progressOf(transactions, budget, reached, info.weekStartsOn), [transactions, budget, reached, info.weekStartsOn]);
}

/** Points and the level they reach, with the bar to the next one. */
export function LevelCard() {
  const { t } = useI18n();
  const { prefs } = usePlanner();
  const tools = useTools();
  const reduced = useReducedMotion();
  const p = useProgress();
  if (!prefs.levels) return null;

  return (
    <section className="card relative overflow-hidden p-5" aria-labelledby="level-title">
      <div className="flex items-center gap-3">
        <span className="coin grid size-12 shrink-0 place-items-center rounded-full font-display text-[20px]" aria-hidden>
          {p.level.index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{t('level.title')}</p>
          <h2 id="level-title" className="font-display truncate text-[22px] leading-tight">
            {t(p.level.key)}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => tools.open({ name: 'achievement', kind: 'level' })}
          aria-label={t('achievement.share')}
          className="press -me-2 grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
        >
          <Share2 className="size-4" />
        </button>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, var(--coin-lo), var(--coin), var(--coin-hi))' }}
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${p.share * 100}%` }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <p className="mt-2 flex justify-between gap-3 text-[13px] text-ink-3">
        <span>{t('achievement.points', { points: p.points })}</span>
        <span>{p.next ? t('level.toNext', { points: p.next.from - p.points, level: t(p.next.key) }) : t('level.max')}</span>
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
        {(
          [
            ['level.why.days', p.breakdown.days, POINTS.day],
            ['level.why.budget', p.breakdown.budgetMonths, POINTS.budgetMonth],
            ['level.why.weeks', p.breakdown.calmWeeks, POINTS.calmWeek],
            ['level.why.goals', p.breakdown.goals, POINTS.goal],
          ] as const
        ).map(([key, count, each]) => (
          <li key={key} className="inset flex min-w-0 items-center gap-2 px-3 py-2">
            <Award className="size-3.5 shrink-0 text-foil" aria-hidden />
            <span className="min-w-0 flex-1 leading-snug text-ink-2">{t(key, { count })}</span>
            <span className="shrink-0 font-semibold tabular" dir="ltr">
              +{count * each}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-ink-3">{t('level.ladder', { levels: LEVELS.map((l) => t(l.key)).join(' → ') })}</p>
    </section>
  );
}

/** Celebrates a new level once (a light burst and a toast); the first reading only remembers the level. */
export function useLevelWatcher(active: boolean) {
  const { t } = useI18n();
  const { prefs, setPrefs } = usePlanner();
  const toast = useToast();
  const tools = useTools();
  const p = useProgress();

  useEffect(() => {
    if (!active || !prefs.levels) return;
    const level = p.level.index;
    if (prefs.levelSeen < 0) return setPrefs({ levelSeen: level });
    if (level <= prefs.levelSeen) return;
    setPrefs({ levelSeen: level });
    const id = window.setTimeout(() => {
      haptic('success');
      celebrate();
      toast.show({
        message: t('level.up', { level: t(p.level.key) }),
        duration: 8000,
        action: {
          label: t('achievement.shareShort'),
          onAction: () => tools.open({ name: 'achievement', kind: 'level' }),
          icon: <Share2 className="size-4" aria-hidden />,
        },
      });
    }, 900);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, prefs.levels, p.level.index]);
}
