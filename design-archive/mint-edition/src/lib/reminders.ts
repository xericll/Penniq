import type { Transaction } from '../types';
import { startOfDay } from './ledger';
import { KEYS, readJSON, write } from './storage';

/** When the app should remind the user to log the day's entries. Kept on this device only. */
export interface ReminderConfig {
  enabled: boolean;
  /** Weekdays the reminder runs on: 0 = Sunday … 6 = Saturday. All seven means every day. */
  days: number[];
  /** Times of day as "HH:MM" (24 h), sorted and unique. */
  times: string[];
  /** Stay quiet on a day that already has an entry. */
  skipIfLogged: boolean;
}

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const MAX_REMINDER_TIMES = 6;
export const DEFAULT_REMINDERS: ReminderConfig = { enabled: false, days: ALL_DAYS, times: ['21:00'], skipIfLogged: true };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTime(v: unknown): v is string {
  return typeof v === 'string' && TIME.test(v);
}

/** Sorted, unique and never empty — whatever was stored or picked. */
export function cleanReminders(v: Partial<ReminderConfig> | null): ReminderConfig {
  if (!v || typeof v !== 'object') return DEFAULT_REMINDERS;
  const days = Array.isArray(v.days) ? ALL_DAYS.filter((d) => v.days!.includes(d)) : [];
  const times = Array.isArray(v.times) ? [...new Set(v.times.filter(isTime))].sort().slice(0, MAX_REMINDER_TIMES) : [];
  return {
    enabled: v.enabled === true,
    days: days.length ? days : DEFAULT_REMINDERS.days,
    times: times.length ? times : DEFAULT_REMINDERS.times,
    skipIfLogged: v.skipIfLogged !== false,
  };
}

export function loadReminders(): ReminderConfig {
  return cleanReminders(readJSON(KEYS.reminders) as Partial<ReminderConfig> | null);
}

export function saveReminders(config: ReminderConfig): void {
  write(KEYS.reminders, JSON.stringify(config));
}

/** "21:00" on the given day. */
export function timeOn(day: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

/**
 * Today's latest reminder that came up after `after` and is not in the future, or null.
 * Yesterday's reminders are never returned: a reminder nobody saw in time is simply dropped.
 */
export function dueSlot(config: ReminderConfig, after: Date, now: Date): Date | null {
  if (!config.enabled || !config.days.includes(now.getDay())) return null;
  for (const time of [...config.times].reverse()) {
    const slot = timeOn(now, time);
    if (slot <= now) return slot > after ? slot : null;
  }
  return null;
}

export function loggedToday(transactions: Transaction[], now: Date): boolean {
  const from = startOfDay(now).getTime();
  return transactions.some((tx) => new Date(tx.timestamp).getTime() >= from);
}
