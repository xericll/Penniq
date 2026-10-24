/* Progress levels. Points are worked out from what is already in the wallet each time, never stored,
   so they can neither be lost nor counted twice:
   - 10 for every day with at least one entry;
   - 50 for every finished month that stayed within the budget;
   - 30 for every finished week without overspending (spending within the weekly share of the budget,
     or — without a budget — no more spent than came in);
   - 100 for every goal reached. */

import type { Transaction } from '../types';
import type { TranslationKey } from '../i18n/translations';
import { addDays, dayKey, flowBetween, startOfDay, startOfMonth, startOfWeek } from './ledger';

export interface Level {
  index: number;
  key: TranslationKey;
  /** Points needed to reach it. */
  from: number;
}

export const LEVELS: Level[] = [
  { index: 0, key: 'level.0', from: 0 },
  { index: 1, key: 'level.1', from: 150 },
  { index: 2, key: 'level.2', from: 500 },
  { index: 3, key: 'level.3', from: 1200 },
  { index: 4, key: 'level.4', from: 2500 },
];

export const POINTS = { day: 10, budgetMonth: 50, calmWeek: 30, goal: 100 } as const;

export interface Progress {
  points: number;
  level: Level;
  next: Level | null;
  /** 0…1 towards the next level (1 at the top). */
  share: number;
  breakdown: { days: number; budgetMonths: number; calmWeeks: number; goals: number };
}

export function progressOf(
  transactions: Transaction[],
  budget: number | null,
  goalsReached: number,
  weekStartsOn: number,
  now = new Date(),
): Progress {
  const days = new Set<string>();
  let oldest = now.getTime();
  for (const tx of transactions) {
    if (tx.kind === 'adjustment') continue;
    const d = new Date(tx.timestamp);
    if (Number.isNaN(d.getTime()) || d > now) continue;
    days.add(dayKey(d));
    oldest = Math.min(oldest, d.getTime());
  }

  let budgetMonths = 0;
  let calmWeeks = 0;
  if (days.size) {
    const thisMonth = startOfMonth(now);
    for (let m = startOfMonth(new Date(oldest)); m < thisMonth; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      const s = flowBetween(transactions, m, next);
      if (budget && s.count > 0 && s.expense <= budget) budgetMonths++;
    }
    const thisWeek = startOfWeek(now, weekStartsOn);
    const weekly = budget ? (budget * 12) / 52 : null;
    for (let w = startOfWeek(new Date(oldest), weekStartsOn); w < thisWeek; w = addDays(w, 7)) {
      const s = flowBetween(transactions, w, addDays(w, 7));
      if (s.count === 0) continue;
      if (weekly !== null ? s.expense <= weekly : s.expense <= s.income) calmWeeks++;
    }
  }

  const points = days.size * POINTS.day + budgetMonths * POINTS.budgetMonth + calmWeeks * POINTS.calmWeek + goalsReached * POINTS.goal;
  const level = [...LEVELS].reverse().find((l) => points >= l.from)!;
  const next = LEVELS[level.index + 1] ?? null;
  return {
    points,
    level,
    next,
    share: next ? (points - level.from) / (next.from - level.from) : 1,
    breakdown: { days: days.size, budgetMonths, calmWeeks, goals: goalsReached },
  };
}

/** Today counts once the first entry of the day is in. */
export function loggedOn(transactions: Transaction[], day: Date): boolean {
  const from = startOfDay(day).getTime();
  const to = addDays(startOfDay(day), 1).getTime();
  return transactions.some((tx) => {
    const t = new Date(tx.timestamp).getTime();
    return t >= from && t < to;
  });
}
