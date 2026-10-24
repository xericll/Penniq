/* Figures worked out on the device for the analysis cards: money leaks, the savings rate, the
   averages the "what if" simulator starts from. Only real wallet income and spending count
   (isFlow): transfers, vault moves, debts and corrections never do. */

import type { Transaction } from '../types';
import { resolveCategory, type Category, type CategoryId } from './categories';
import { categoryBreakdown, flowBetween, isFlow, roundMoney, startOfMonth } from './ledger';

export interface Leak {
  /** The description as stored (shown through localize()). */
  reason: string;
  count: number;
  total: number;
  category: Category;
}

export interface LeakReport {
  top: { category: Category; amount: number; share: number; count: number } | null;
  /** Small entries that keep coming back this month ("Coffee: 14 times"). */
  small: Leak[];
  /** Spending so far this month and over the same days of last month. */
  monthToDate: number;
  lastMonthSameDays: number;
  /** The top category's spending over the same days of last month. */
  topLastMonth: number;
}

const key = (reason: string) => reason.split(' — ')[0].trim().toLocaleLowerCase();

export function leakReport(transactions: Transaction[], now = new Date()): LeakReport {
  const from = startOfMonth(now);
  const lastFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // The same stretch of last month, clamped to its length (31 October → 30 September).
  const lastLen = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const lastTo = new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), lastLen) + 1);

  const { slices, total } = categoryBreakdown(transactions, from);
  const top = slices[0] ? { category: slices[0].category, amount: slices[0].amount, share: slices[0].share, count: slices[0].count } : null;

  let topLastMonth = 0;
  const groups = new Map<string, Leak>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !isFlow(tx)) continue;
    const d = new Date(tx.timestamp);
    if (top && d >= lastFrom && d < lastTo && resolveCategory(tx.category).id === top.category.id) topLastMonth += tx.amount;
    if (d < from) continue;
    const category = resolveCategory(tx.category);
    // An entry named only after its category says nothing about a habit.
    if (!tx.reason || category.aliases.includes(tx.reason.trim())) continue;
    const k = key(tx.reason);
    const g = groups.get(k) ?? { reason: tx.reason.split(' — ')[0].trim(), count: 0, total: 0, category };
    g.count += 1;
    g.total += tx.amount;
    groups.set(k, g);
  }

  // Small: each time well under the typical entry of the month, but often enough to add up.
  const entries = slices.reduce((s, x) => s + x.count, 0);
  const typical = entries > 0 ? total / entries : 0;
  const small = [...groups.values()]
    .filter((g) => g.count >= 3 && g.total / g.count <= Math.max(typical, 0.01))
    .map((g) => ({ ...g, total: roundMoney(g.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  return {
    top,
    small,
    monthToDate: total,
    lastMonthSameDays: flowBetween(transactions, lastFrom, lastTo).expense,
    topLastMonth: roundMoney(topLastMonth),
  };
}

export interface SavingsRate {
  income: number;
  expense: number;
  /** Percent of income kept, or null without income. */
  rate: number | null;
  lastRate: number | null;
}

export function savingsRate(transactions: Transaction[], now = new Date()): SavingsRate {
  const from = startOfMonth(now);
  const lastFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const cur = flowBetween(transactions, from);
  const last = flowBetween(transactions, lastFrom, from);
  const rate = (s: { income: number; expense: number }) => (s.income > 0 ? ((s.income - s.expense) / s.income) * 100 : null);
  return { income: cur.income, expense: cur.expense, rate: rate(cur), lastRate: rate(last) };
}

export interface MonthlyAverages {
  income: number;
  expense: number;
  /** Average spending per category per month. */
  byCategory: Map<CategoryId, number>;
  /** How many months the averages are based on (1–6). */
  months: number;
}

/**
 * Average monthly income and spending over the last full months that have entries (up to six),
 * or the current month when nothing older exists.
 */
export function monthlyAverages(transactions: Transaction[], now = new Date()): MonthlyAverages {
  const flows = transactions.filter(isFlow);
  const oldest = flows.reduce((min, tx) => Math.min(min, new Date(tx.timestamp).getTime()), now.getTime());
  const thisMonth = startOfMonth(now);
  const oldestMonth = startOfMonth(new Date(oldest));
  const fullMonths = Math.min(
    6,
    (thisMonth.getFullYear() - oldestMonth.getFullYear()) * 12 + thisMonth.getMonth() - oldestMonth.getMonth(),
  );
  const months = Math.max(1, fullMonths);
  const from = fullMonths > 0 ? new Date(now.getFullYear(), now.getMonth() - months, 1) : thisMonth;
  const to = fullMonths > 0 ? thisMonth : undefined;
  const sum = flowBetween(flows, from, to);
  const byCategory = new Map<CategoryId, number>();
  for (const tx of flows) {
    if (tx.type !== 'expense') continue;
    const d = new Date(tx.timestamp);
    if (d < from || (to && d >= to)) continue;
    const id = resolveCategory(tx.category).id;
    byCategory.set(id, (byCategory.get(id) ?? 0) + tx.amount / months);
  }
  return { income: roundMoney(sum.income / months), expense: roundMoney(sum.expense / months), byCategory, months };
}
