import { CalendarCheck, Plus, Target, Undo2, Vault, Wallet, X, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import {
  BUCKET_KINDS,
  percentTotal,
  rulesValid,
  suggestSplit,
  type AllocationRules,
  type Bucket,
  type BucketKind,
  type SplitLine,
} from '../../lib/allocation';
import { celebrate } from '../../lib/confetti';
import { goalProgress } from '../../lib/goals';
import { haptic } from '../../lib/haptics';
import { essentialAdded, roundMoney } from '../../lib/ledger';
import { usePlanner } from '../../state/PlannerContext';
import { useToast } from '../../state/ToastContext';
import { useWallet } from '../../state/WalletContext';
import type { Transaction } from '../../types';
import { Money } from '../ui/Money';
import { parseNumber } from '../ui/Pickers';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { Switch } from '../ui/Switch';
import { isolate } from '../../lib/bidi';

const BUCKET_ICON: Record<BucketKind, LucideIcon> = { essentials: CalendarCheck, vault: Vault, goal: Target, free: Wallet };
const BUCKET_HUE: Record<BucketKind, string> = { essentials: 'var(--bank)', vault: 'var(--coin)', goal: 'var(--in)', free: 'var(--cash)' };

/** The rules: how each income should be split, as percentages (adding up to 100) or fixed amounts. */
export function SplitRulesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, currencySymbol } = useI18n();
  const { allocation, setAllocation, goals } = usePlanner();
  const toast = useToast();
  const [draft, setDraft] = useState<AllocationRules>(allocation);
  const [values, setValues] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setDraft(allocation);
    setValues(allocation.buckets.map((b) => String(b.value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const buckets: Bucket[] = draft.buckets.map((b, i) => ({ ...b, value: Math.max(0, parseNumber(values[i] ?? '') || 0) }));
  const current: AllocationRules = { ...draft, buckets };
  const total = percentTotal(current);
  const valid = rulesValid(current) && buckets.every((b) => b.kind !== 'goal' || goals.some((g) => g.id === b.goalId));

  const setBucket = (i: number, patch: Partial<Bucket>) =>
    setDraft((d) => ({ ...d, buckets: d.buckets.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));

  const save = () => {
    if (current.enabled && !valid) return haptic('warning');
    setAllocation(current);
    haptic('success');
    toast.show({ message: t('toast.saved') });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('split.title')}
      footer={
        <button
          type="button"
          onClick={save}
          aria-disabled={current.enabled && !valid}
          className={`press min-h-13 w-full rounded-2xl text-[16px] font-semibold ${current.enabled && !valid ? 'bg-surface-2 text-ink-3' : 'foil'}`}
        >
          {t('common.save')}
        </button>
      }
    >
      <p className="mb-4 text-[14px] leading-relaxed text-ink-2">{t('split.intro')}</p>
      <button
        type="button"
        role="switch"
        aria-checked={draft.enabled}
        onClick={() => setDraft((d) => ({ ...d, enabled: !d.enabled }))}
        className="press mb-5 flex min-h-[60px] w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-start"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{t('split.enable')}</span>
          <span className="mt-0.5 block text-[13px] text-ink-3">{t('split.enableHint')}</span>
        </span>
        <Switch on={draft.enabled} />
      </button>

      <Segmented
        label={t('split.mode')}
        value={draft.mode}
        onChange={(mode) => setDraft((d) => ({ ...d, mode }))}
        options={[
          { value: 'percent', label: t('split.percent') },
          { value: 'fixed', label: t('split.fixed') },
        ]}
      />

      <ul className="mt-4 space-y-2.5">
        {draft.buckets.map((b, i) => {
          const Icon = BUCKET_ICON[b.kind];
          return (
            <li key={i} className="rounded-2xl border border-line p-3">
              <div className="flex items-center gap-2">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-xl"
                  style={{ background: `color-mix(in oklab, ${BUCKET_HUE[b.kind]} 18%, transparent)`, color: BUCKET_HUE[b.kind] }}
                  aria-hidden
                >
                  <Icon className="size-[18px]" />
                </span>
                <select
                  value={b.kind}
                  onChange={(e) =>
                    setBucket(i, { kind: e.target.value as BucketKind, goalId: e.target.value === 'goal' ? goals[0]?.id : undefined })
                  }
                  className="field min-h-11 min-w-0 flex-1 py-0 text-[14px]"
                  aria-label={t('split.bucket')}
                >
                  {BUCKET_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`split.kind.${k}`)}
                    </option>
                  ))}
                </select>
                <label className="relative w-[6.5rem] shrink-0" dir="ltr">
                  <span className="sr-only">{t('split.value')}</span>
                  <input
                    className="field min-h-11 pe-8 text-center tabular"
                    inputMode="decimal"
                    dir="ltr"
                    value={values[i] ?? ''}
                    onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-3">
                    {draft.mode === 'percent' ? '%' : currencySymbol}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setDraft((d) => ({ ...d, buckets: d.buckets.filter((_, j) => j !== i) }));
                    setValues((v) => v.filter((_, j) => j !== i));
                  }}
                  aria-label={t('common.delete')}
                  className="press grid size-10 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
                >
                  <X className="size-4" />
                </button>
              </div>
              {b.kind === 'goal' &&
                (goals.length ? (
                  <select
                    value={b.goalId ?? ''}
                    onChange={(e) => setBucket(i, { goalId: e.target.value })}
                    className="field mt-2 min-h-11 py-0 text-[14px]"
                    aria-label={t('split.whichGoal')}
                  >
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-2 text-[13px] text-out">{t('split.noGoals')}</p>
                ))}
            </li>
          );
        })}
      </ul>
      {draft.buckets.length < 5 && (
        <button
          type="button"
          onClick={() => {
            setDraft((d) => ({ ...d, buckets: [...d.buckets, { kind: 'free', value: 0 }] }));
            setValues((v) => [...v, '0']);
          }}
          className="press mt-2.5 flex min-h-11 items-center gap-1.5 rounded-2xl border border-dashed border-line-strong px-4 text-[14px] font-medium text-ink-2 hover:bg-surface-2"
        >
          <Plus className="size-4" aria-hidden />
          {t('split.addBucket')}
        </button>
      )}
      {draft.mode === 'percent' && (
        <p
          role="status"
          className={`mt-4 rounded-2xl px-4 py-3 text-[14px] font-medium ${Math.abs(total - 100) < 0.001 ? 'bg-surface-2 text-in' : 'bg-surface-2 text-out'}`}
        >
          {t('split.total', { pct: total })}
          {Math.abs(total - 100) >= 0.001 && ` · ${t('split.must100')}`}
        </p>
      )}
    </Sheet>
  );
}

/** Shown after an income is recorded: the suggested split, which can be changed or skipped. */
export function SplitSheet({ tx, onClose }: { tx: Transaction | null; onClose: () => void }) {
  const { t, money, accountName } = useI18n();
  const { allocation, goals, setGoals } = usePlanner();
  const { add, remove, balances, essentials, transactions } = useWallet();
  const toast = useToast();
  const last = useRef<Transaction | null>(null);
  if (tx) last.current = tx;
  const income = last.current;
  const [lines, setLines] = useState<SplitLine[]>([]);
  const [values, setValues] = useState<string[]>([]);

  useEffect(() => {
    if (!tx) return;
    // The income's own toast would sit over this window; its Undo lives in the header here instead.
    toast.dismiss();
    const s = suggestSplit(allocation, tx.amount);
    setLines(s);
    setValues(s.map((l) => String(l.amount)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx]);

  const openEssentials = useMemo(
    () => roundMoney(essentials.filter((e) => e.type === 'expense' && !essentialAdded(e, transactions)).reduce((s, e) => s + e.amount, 0)),
    [essentials, transactions],
  );

  if (!income) return null;
  const amounts = values.map((v) => roundMoney(Math.max(0, parseNumber(v) || 0)));
  const moving = roundMoney(lines.reduce((s, l, i) => s + (l.kind === 'vault' || l.kind === 'goal' ? amounts[i] : 0), 0));
  const assigned = roundMoney(amounts.reduce((s, a) => s + a, 0));
  const source = income.account === 'bank' ? 'bank' : 'cash';
  const tooMuch = assigned > income.amount + 0.001 || moving > balances[source] + 0.001;

  const apply = () => {
    if (tooMuch) return haptic('warning');
    let reachedAny = false;
    lines.forEach((l, i) => {
      const value = amounts[i];
      if (value <= 0) return;
      if (l.kind === 'vault') add({ amount: value, type: 'transfer', account: source, toAccount: 'vault', reason: 'إيداع في الخزنة' });
      if (l.kind === 'goal') {
        const goal = goals.find((g) => g.id === l.goalId);
        if (!goal) return;
        const before = goalProgress(goal, transactions);
        const moved = add({ amount: value, type: 'transfer', account: source, toAccount: 'vault', reason: goal.name });
        const reached = !before.reached && before.saved + value >= goal.target;
        reachedAny ||= reached;
        setGoals((list) =>
          list.map((g) =>
            g.id === goal.id
              ? {
                  ...g,
                  contributions: [...g.contributions, moved.id],
                  reachedAt: g.reachedAt ?? (reached ? new Date().toISOString() : undefined),
                }
              : g,
          ),
        );
      }
    });
    haptic('success');
    if (reachedAny) celebrate();
    toast.show({ message: t('split.applied'), tone: 'in' });
    onClose();
  };

  return (
    <Sheet
      open={tx !== null}
      onClose={onClose}
      eyebrow={t('split.eyebrow', { amount: isolate(money(income.amount)), account: accountName(source) })}
      title={t('split.suggestTitle')}
      headerExtra={
        <button
          type="button"
          onClick={() => {
            remove(income.id);
            haptic('select');
            toast.show({ message: t('toast.deleted') });
            onClose();
          }}
          className="press flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3 text-[13px] font-medium text-ink-2 hover:bg-surface-2"
        >
          <Undo2 className="size-4 rtl:-scale-x-100" aria-hidden />
          {t('common.undo')}
        </button>
      }
      footer={
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button
            type="button"
            onClick={onClose}
            className="press min-h-13 rounded-2xl border border-line-strong px-5 text-[15px] font-medium hover:bg-surface-2"
          >
            {t('split.skip')}
          </button>
          <button
            type="button"
            onClick={apply}
            aria-disabled={tooMuch}
            className={`press min-h-13 rounded-2xl text-[16px] font-semibold ${tooMuch ? 'bg-surface-2 text-ink-3' : 'foil'}`}
          >
            {t('split.apply')}
          </button>
        </div>
      }
    >
      {/* The split as one bar */}
      <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        {lines.map((l, i) => (
          <span
            key={i}
            className="h-full transition-[width] duration-500"
            style={{ width: `${income.amount > 0 ? (amounts[i] / income.amount) * 100 : 0}%`, background: BUCKET_HUE[l.kind] }}
          />
        ))}
      </div>
      <ul className="space-y-2.5">
        {lines.map((l, i) => {
          const Icon = BUCKET_ICON[l.kind];
          const goal = l.kind === 'goal' ? goals.find((g) => g.id === l.goalId) : undefined;
          const note =
            l.kind === 'essentials'
              ? openEssentials > 0
                ? t('split.note.essentials', { amount: isolate(money(openEssentials)) })
                : t('split.note.essentialsDone')
              : l.kind === 'vault'
                ? t('split.note.vault')
                : l.kind === 'goal'
                  ? goal
                    ? t('split.note.goal', { name: goal.name })
                    : t('split.noGoals')
                  : t('split.note.free');
          return (
            <li key={i} className="flex items-center gap-3 rounded-2xl border border-line p-3">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-xl"
                style={{ background: `color-mix(in oklab, ${BUCKET_HUE[l.kind]} 18%, transparent)`, color: BUCKET_HUE[l.kind] }}
                aria-hidden
              >
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{goal ? goal.name : t(`split.kind.${l.kind}`)}</span>
                <span className="block text-[12px] leading-snug text-ink-3">{note}</span>
              </span>
              <label className="w-[6.5rem] shrink-0" dir="ltr">
                <span className="sr-only">{t(`split.kind.${l.kind}`)}</span>
                <input
                  className="field min-h-11 text-center tabular"
                  inputMode="decimal"
                  dir="ltr"
                  value={values[i] ?? ''}
                  onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                />
              </label>
            </li>
          );
        })}
      </ul>
      <p className={`mt-4 text-[13px] ${tooMuch ? 'font-medium text-out' : 'text-ink-3'}`} role={tooMuch ? 'alert' : undefined}>
        {tooMuch
          ? t('split.tooMuch', { amount: isolate(money(Math.min(income.amount, balances[source]))) })
          : t('split.moves', { amount: isolate(money(moving)) })}
      </p>
      <p className="mt-1 text-[12px] text-ink-3">
        <Money value={assigned} /> / <Money value={income.amount} />
      </p>
    </Sheet>
  );
}
