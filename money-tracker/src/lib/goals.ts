/* Savings goals. A goal is a name, a picture, a target and a date. Money put towards it is an ordinary
   transfer from the wallet into the vault, and the goal keeps the ids of those entries: what is saved is
   always worked out from the ledger, so deleting such an entry takes it off the goal as well. */

import type { Transaction } from '../types';
import { roundMoney, startOfMonth } from './ledger';

export const GOAL_ICONS = [
  'travel',
  'car',
  'wedding',
  'home',
  'phone',
  'laptop',
  'study',
  'baby',
  'gift',
  'safety',
  'health',
  'star',
] as const;
export type GoalIcon = (typeof GOAL_ICONS)[number];

export interface Goal {
  id: string;
  name: string;
  icon: GoalIcon;
  /** A small photo the user picked (a JPEG data URL, about 256 px); shown instead of the icon. */
  photo?: string;
  target: number;
  /** "YYYY-MM-DD", optional. */
  targetDate?: string;
  /** Ids of the vault transfers that went towards this goal. */
  contributions: string[];
  createdAt: string;
  /** Set once the target was first reached, for the achievement and the points. */
  reachedAt?: string;
}

export interface GoalProgress {
  saved: number;
  remaining: number;
  /** 0…1 */
  share: number;
  reached: boolean;
  /** Whole months left until the target date (at least 1), or null without a date. */
  monthsLeft: number | null;
  /** What to put aside each month to reach it on time; null without a date or once reached. */
  perMonth: number | null;
  overdue: boolean;
}

export function goalProgress(goal: Goal, transactions: Transaction[], now = new Date()): GoalProgress {
  const ids = new Set(goal.contributions);
  const paid = transactions.filter((tx) => ids.has(tx.id));
  const saved = roundMoney(paid.reduce((sum, tx) => sum + tx.amount, 0));
  // Once something went in this month, the rest is spread over the months still to come.
  const paidThisMonth = paid.some((tx) => new Date(tx.timestamp) >= startOfMonth(now));
  const remaining = Math.max(0, roundMoney(goal.target - saved));
  const reached = goal.target > 0 && saved >= goal.target;
  let monthsLeft: number | null = null;
  let overdue = false;
  if (goal.targetDate) {
    const end = new Date(`${goal.targetDate}T23:59:59`);
    if (!Number.isNaN(end.getTime())) {
      const months =
        (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth()) + (end.getDate() >= now.getDate() ? 0 : -1);
      overdue = end < now;
      monthsLeft = Math.max(1, months + (paidThisMonth ? 0 : 1));
    }
  }
  return {
    saved,
    remaining,
    share: goal.target > 0 ? Math.min(1, saved / goal.target) : 0,
    reached,
    monthsLeft,
    perMonth: monthsLeft !== null && !reached ? roundMoney(remaining / monthsLeft) : null,
    overdue: overdue && !reached,
  };
}

export function parseGoals(v: unknown): Goal[] {
  if (!Array.isArray(v)) return [];
  const out: Goal[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const g = raw as Record<string, unknown>;
    const target = Number(g.target);
    if (typeof g.id !== 'string' || typeof g.name !== 'string' || !Number.isFinite(target) || target <= 0) continue;
    out.push({
      id: g.id,
      name: g.name.slice(0, 50),
      icon: GOAL_ICONS.includes(g.icon as GoalIcon) ? (g.icon as GoalIcon) : 'star',
      photo: typeof g.photo === 'string' && g.photo.startsWith('data:image/') ? g.photo : undefined,
      target,
      targetDate: typeof g.targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g.targetDate) ? g.targetDate : undefined,
      contributions: Array.isArray(g.contributions) ? g.contributions.filter((x): x is string => typeof x === 'string') : [],
      createdAt: typeof g.createdAt === 'string' ? g.createdAt : new Date().toISOString(),
      reachedAt: typeof g.reachedAt === 'string' ? g.reachedAt : undefined,
    });
  }
  return out;
}

/** Shrinks a picked photo to a small square JPEG so it fits comfortably in the device storage. */
export async function photoToDataUrl(file: File, size = 256): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}
