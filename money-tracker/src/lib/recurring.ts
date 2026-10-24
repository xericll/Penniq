/* Recurring payments: rent, subscriptions, insurance, phone… each with an amount, a day and a frequency.
   They live on this device. Each occurrence ("2026-11-01") can be recorded once as a normal entry; the
   payment remembers which entry recorded which date. */

import type { AccountType, Transaction } from '../types';
import { addDays, dayKey, startOfDay } from './ledger';
import { categoryById, isCategoryId, type CategoryId } from './categories';

export type Frequency = 'monthly' | 'weekly' | 'yearly';

export interface Recurring {
  id: string;
  name: string;
  amount: number;
  type: 'expense' | 'income';
  account: AccountType;
  category?: CategoryId;
  frequency: Frequency;
  /** Monthly: day of the month (1–31, clamped to the month's length). Weekly: weekday 0–6 (Sunday = 0). Yearly: day of the month. */
  day: number;
  /** Yearly only: month 0–11. */
  month?: number;
  /** Remind this many days before (0 = on the day). */
  remindBefore: number;
  /** "YYYY-MM-DD" → id of the entry that recorded that occurrence. */
  paid: Record<string, string>;
  createdAt: string;
}

export interface Occurrence {
  item: Recurring;
  date: Date;
  key: string;
  /** The entry that recorded it, if it was recorded and still exists. */
  txId?: string;
}

function lastDayOf(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Every date the payment falls on between from and to (both inclusive). */
export function occurrencesBetween(item: Recurring, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const start = startOfDay(from);
  const end = startOfDay(to);
  const first = start;
  if (item.frequency === 'weekly') {
    let d = first;
    while (d.getDay() !== item.day) d = addDays(d, 1);
    for (; d <= end; d = addDays(d, 7)) out.push(d);
    return out;
  }
  for (let y = first.getFullYear(), m = first.getMonth(); new Date(y, m, 1) <= end; m++) {
    if (m > 11) {
      m = 0;
      y++;
    }
    if (item.frequency === 'yearly' && m !== (item.month ?? 0)) continue;
    const d = new Date(y, m, Math.min(item.day, lastDayOf(y, m)));
    if (d >= first && d <= end) out.push(d);
  }
  return out;
}

export function occurrences(items: Recurring[], from: Date, to: Date, transactions: Transaction[]): Occurrence[] {
  const ids = new Set(transactions.map((t) => t.id));
  return items
    .flatMap((item) =>
      occurrencesBetween(item, from, to).map((date) => {
        const key = dayKey(date);
        const txId = item.paid[key];
        return { item, date, key, txId: txId && ids.has(txId) ? txId : undefined };
      }),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** The entry an occurrence records. */
export function recurringEntry(item: Recurring, date: Date) {
  const now = new Date();
  // Recorded on its own day, at the current time when that day is today.
  const at = dayKey(date) === dayKey(now) ? now : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  return {
    amount: item.amount,
    type: item.type,
    account: item.account,
    reason: item.name,
    category: item.type === 'expense' ? categoryById(item.category ?? 'bills').stored : undefined,
    timestamp: at.toISOString(),
  } as const;
}

export function parseRecurring(v: unknown): Recurring[] {
  if (!Array.isArray(v)) return [];
  const out: Recurring[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const x = raw as Record<string, unknown>;
    const amount = Number(x.amount);
    if (typeof x.id !== 'string' || typeof x.name !== 'string' || !x.name.trim() || !Number.isFinite(amount) || amount <= 0) continue;
    const frequency: Frequency = x.frequency === 'weekly' || x.frequency === 'yearly' ? x.frequency : 'monthly';
    const day = Math.round(Number(x.day));
    const type = x.type === 'income' ? 'income' : 'expense';
    const paid: Record<string, string> = {};
    if (x.paid && typeof x.paid === 'object') {
      for (const [k, id] of Object.entries(x.paid as Record<string, unknown>)) if (typeof id === 'string') paid[k] = id;
    }
    out.push({
      id: x.id,
      name: x.name.trim().slice(0, 50),
      amount,
      type,
      account: x.account === 'cash' ? 'cash' : 'bank',
      category: type === 'expense' && isCategoryId(x.category) ? x.category : undefined,
      frequency,
      day: frequency === 'weekly' ? Math.min(6, Math.max(0, day || 0)) : Math.min(31, Math.max(1, day || 1)),
      month: frequency === 'yearly' ? Math.min(11, Math.max(0, Math.round(Number(x.month)) || 0)) : undefined,
      remindBefore: [0, 1, 2, 3, 7].includes(Number(x.remindBefore)) ? Number(x.remindBefore) : 1,
      paid,
      createdAt: typeof x.createdAt === 'string' ? x.createdAt : new Date().toISOString(),
    });
  }
  return out;
}
