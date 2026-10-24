/* Automation rules: "if the description contains Lidl, then category Groceries". Every condition of a
   rule must match; enabled rules run in list order on each new income or expense (typed, scanned from a
   receipt, recorded from a quick button or a recurring payment). */

import type { AccountType } from '../types';
import { categoryById, isCategoryId, type CategoryId } from './categories';

export type ConditionField = 'description' | 'amountGt' | 'amountLt' | 'account';

export interface Condition {
  field: ConditionField;
  /** Text for 'description', a number for the amounts, 'cash' / 'bank' for 'account'. */
  value: string;
}

export interface RuleActions {
  category?: CategoryId;
  account?: AccountType;
  /** Appended to the description as "description — note". */
  note?: string;
}

export interface Rule {
  id: string;
  enabled: boolean;
  conditions: Condition[];
  actions: RuleActions;
}

export const MAX_CONDITIONS = 3;

/** The part of a new entry the rules look at and may change. */
export interface RuleSubject {
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  account: string;
  reason: string;
  category?: string;
}

const fold = (s: string) => s.toLocaleLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');

export function matches(rule: Rule, tx: RuleSubject, localizedReason = tx.reason): boolean {
  if (!rule.enabled || !rule.conditions.length) return false;
  return rule.conditions.every((c) => {
    if (c.field === 'description') {
      const needle = fold(c.value.trim());
      return needle.length > 0 && (fold(tx.reason).includes(needle) || fold(localizedReason).includes(needle));
    }
    if (c.field === 'account') return tx.account === c.value;
    const n = Number(c.value.replace(',', '.'));
    if (!Number.isFinite(n)) return false;
    return c.field === 'amountGt' ? tx.amount > n : tx.amount < n;
  });
}

/** Runs the rules over a new entry and returns the entry they produce (unchanged when none matched). */
export function applyRules<T extends RuleSubject>(tx: T, rules: Rule[], localize: (s: string) => string = (s) => s): T {
  if (tx.type === 'transfer') return tx;
  let next = { ...tx };
  const original = localize(tx.reason);
  for (const rule of rules) {
    if (!matches(rule, next, original)) continue;
    const { category, account, note } = rule.actions;
    if (category && next.type === 'expense') next = { ...next, category: categoryById(category).stored };
    if (account) next = { ...next, account };
    if (note?.trim() && !next.reason.includes(note.trim())) {
      next = { ...next, reason: next.reason ? `${next.reason} — ${note.trim()}` : note.trim() };
    }
  }
  return next;
}

export function parseRules(v: unknown): Rule[] {
  if (!Array.isArray(v)) return [];
  const fields: ConditionField[] = ['description', 'amountGt', 'amountLt', 'account'];
  const out: Rule[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string') continue;
    const conditions = Array.isArray(r.conditions)
      ? r.conditions
          .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
          .filter((c) => fields.includes(c.field as ConditionField) && typeof c.value === 'string')
          .map((c) => ({ field: c.field as ConditionField, value: String(c.value).slice(0, 60) }))
          .slice(0, MAX_CONDITIONS)
      : [];
    const a = (r.actions && typeof r.actions === 'object' ? r.actions : {}) as Record<string, unknown>;
    const actions: RuleActions = {
      category: isCategoryId(a.category) ? a.category : undefined,
      account: a.account === 'cash' || a.account === 'bank' ? a.account : undefined,
      note: typeof a.note === 'string' && a.note.trim() ? a.note.trim().slice(0, 40) : undefined,
    };
    if (!conditions.length) continue;
    out.push({ id: r.id, enabled: r.enabled !== false, conditions, actions });
  }
  return out;
}
