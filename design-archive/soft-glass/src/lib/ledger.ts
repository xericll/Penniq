import type { AccountType, PeriodFilter, Transaction } from '../types';
import { resolveCategory, type Category } from './categories';

export interface Balances {
  cash: number;
  bank: number;
  total: number;
}

/** Balances are always derived from the ledger — never stored as the source of truth. */
export function computeBalances(transactions: Transaction[]): Balances {
  let cash = 0;
  let bank = 0;
  const apply = (account: AccountType | undefined, delta: number) => {
    if (account === 'cash') cash += delta;
    else if (account === 'bank') bank += delta;
  };

  for (const tx of transactions) {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') apply(tx.account, amt);
    else if (tx.type === 'expense') apply(tx.account, -amt);
    else if (tx.type === 'transfer') {
      apply(tx.account, -amt);
      apply(tx.toAccount ?? (tx.account === 'cash' ? 'bank' : 'cash'), amt);
    }
  }
  return { cash: round2(cash), bank: round2(bank), total: round2(cash + bank) };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Opening balances and manual corrections move money but are not real income or spending. */
export function isAdjustment(tx: Transaction): boolean {
  if (tx.kind === 'adjustment') return true;
  const r = tx.reason || '';
  return r.startsWith('تعديل رصيد يدوي') || r === 'رصيد كاش افتتاحي' || r === 'رصيد بنكي افتتاحي';
}

/** Signed effect of a transaction on one account (or on the total when account is omitted). */
export function signedAmount(tx: Transaction, account?: AccountType): number {
  const amt = Number(tx.amount) || 0;
  if (tx.type === 'income') return !account || tx.account === account ? amt : 0;
  if (tx.type === 'expense') return !account || tx.account === account ? -amt : 0;
  if (!account) return 0;
  if (tx.account === account) return -amt;
  if (tx.toAccount === account) return amt;
  return 0;
}

export function touchesAccount(tx: Transaction, account: AccountType): boolean {
  return tx.account === account || tx.toAccount === account;
}

// ---------- Dates ----------------------------------------------------------

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function daysLeftInMonth(d = new Date()): number {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return last - d.getDate() + 1;
}

/** Arabic calendars start the week on Saturday; German and English on Monday. */
export function startOfWeek(d: Date, weekStartsOn: number): Date {
  const today = startOfDay(d);
  const diff = (today.getDay() - weekStartsOn + 7) % 7;
  return addDays(today, -diff);
}

export function inPeriod(timestamp: string, filter: PeriodFilter, now = new Date()): boolean {
  if (filter === 'all') return true;
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return false;
  const today = startOfDay(now);
  if (filter === 'today') return d >= today;
  if (filter === '7days') return d >= addDays(today, -6);
  return d >= startOfMonth(now);
}

// ---------- Summaries -----------------------------------------------------

export interface FlowStats {
  income: number;
  expense: number;
  net: number;
  count: number;
}

function flowBetween(transactions: Transaction[], from: Date, to?: Date): FlowStats {
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const tx of transactions) {
    if (tx.type === 'transfer' || isAdjustment(tx)) continue;
    const d = new Date(tx.timestamp);
    if (Number.isNaN(d.getTime()) || d < from || (to && d >= to)) continue;
    if (tx.type === 'income') income += tx.amount;
    else expense += tx.amount;
    count++;
  }
  return { income: round2(income), expense: round2(expense), net: round2(income - expense), count };
}

export interface PeriodSummary {
  today: FlowStats;
  yesterday: FlowStats;
  week: FlowStats;
  month: FlowStats;
}

export function periodSummary(transactions: Transaction[], weekStartsOn: number, now = new Date()): PeriodSummary {
  const today = startOfDay(now);
  return {
    today: flowBetween(transactions, today),
    yesterday: flowBetween(transactions, addDays(today, -1), today),
    week: flowBetween(transactions, startOfWeek(now, weekStartsOn)),
    month: flowBetween(transactions, startOfMonth(now)),
  };
}

export interface DayPoint {
  date: Date;
  key: string;
  income: number;
  expense: number;
}

export function lastDays(transactions: Transaction[], days = 7, now = new Date()): DayPoint[] {
  const today = startOfDay(now);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - (days - 1));
    const s = flowBetween(transactions, date, addDays(date, 1));
    return { date, key: dayKey(date), income: s.income, expense: s.expense };
  });
}

export interface CategorySlice {
  category: Category;
  amount: number;
  count: number;
  share: number;
}

export function categoryBreakdown(transactions: Transaction[], since?: Date): { slices: CategorySlice[]; total: number } {
  const map = new Map<string, CategorySlice>();
  let total = 0;
  for (const tx of transactions) {
    if (tx.type !== 'expense' || isAdjustment(tx)) continue;
    if (since && new Date(tx.timestamp) < since) continue;
    const category = resolveCategory(tx.category);
    const slice = map.get(category.id) ?? { category, amount: 0, count: 0, share: 0 };
    slice.amount += tx.amount;
    slice.count += 1;
    map.set(category.id, slice);
    total += tx.amount;
  }
  const slices = [...map.values()]
    .map((s) => ({ ...s, amount: round2(s.amount), share: total > 0 ? s.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
  return { slices, total: round2(total) };
}

export interface DayGroup {
  key: string;
  date: Date;
  items: Transaction[];
  income: number;
  expense: number;
}

export function byNewest(a: Transaction, b: Transaction): number {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}

export function groupByDay(transactions: Transaction[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const tx of [...transactions].sort(byNewest)) {
    const d = new Date(tx.timestamp);
    if (Number.isNaN(d.getTime())) continue;
    const key = dayKey(d);
    let g = groups.get(key);
    if (!g) {
      g = { key, date: startOfDay(d), items: [], income: 0, expense: 0 };
      groups.set(key, g);
    }
    g.items.push(tx);
    if (!isAdjustment(tx)) {
      if (tx.type === 'income') g.income += tx.amount;
      else if (tx.type === 'expense') g.expense += tx.amount;
    }
  }
  return [...groups.values()];
}

/** Stable, human-friendly receipt numbers: the oldest transaction is № 1. */
export function serialNumbers(transactions: Transaction[]): Map<string, number> {
  const sorted = [...transactions].sort((a, b) => {
    const d = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
  return new Map(sorted.map((t, i) => [t.id, i + 1]));
}

export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
