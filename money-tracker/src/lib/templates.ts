/* Quick buttons: an entry the user records often ("Morning coffee, 3.50, Dining, Cash"), saved once and
   recorded with one tap. The order of the list is the order of the buttons. */

import type { AccountType } from '../types';
import { categoryById, isCategoryId, type CategoryId } from './categories';

export interface Template {
  id: string;
  name: string;
  amount: number;
  type: 'expense' | 'income';
  account: AccountType;
  /** Expenses only. */
  category?: CategoryId;
}

export const MAX_TEMPLATES = 12;

export function parseTemplates(v: unknown): Template[] {
  if (!Array.isArray(v)) return [];
  const out: Template[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const x = raw as Record<string, unknown>;
    const amount = Number(x.amount);
    if (typeof x.id !== 'string' || typeof x.name !== 'string' || !x.name.trim() || !Number.isFinite(amount) || amount <= 0) continue;
    const type = x.type === 'income' ? 'income' : 'expense';
    out.push({
      id: x.id,
      name: x.name.trim().slice(0, 40),
      amount,
      type,
      account: x.account === 'bank' ? 'bank' : 'cash',
      category: type === 'expense' && isCategoryId(x.category) ? x.category : undefined,
    });
  }
  return out.slice(0, MAX_TEMPLATES);
}

/** The entry a template records. */
export function templateEntry(tpl: Template) {
  return {
    amount: tpl.amount,
    type: tpl.type,
    account: tpl.account,
    reason: tpl.name,
    category: tpl.type === 'expense' ? categoryById(tpl.category ?? 'other').stored : undefined,
  } as const;
}
