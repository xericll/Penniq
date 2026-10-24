import type { QuickAmounts, Transaction } from '../types';

/** localStorage keys — unchanged from the previous version so existing data keeps working. */
export const KEYS = {
  transactions: 'my_money_transactions',
  updated: 'my_euro_balance_updated',
  cash: 'my_cash_balance',
  bank: 'my_bank_balance',
  legacyBalance: 'my_euro_balance',
  incomeSources: 'my_custom_income_sources',
  expenseSources: 'my_custom_expense_sources',
  budget: 'my_monthly_budget',
  quickAmounts: 'my_quick_adjust_amounts_v2',
  theme: 'qirsh_app_theme',
  hidden: 'qirsh_amounts_hidden',
  hiddenLegacy: 'my_balance_hidden',
  language: 'qirsh_app_language',
} as const;

export function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage full or unavailable — the in-memory state still works
  }
}

export function readJSON(key: string): unknown {
  const raw = read(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isTransaction(v: unknown): v is Transaction {
  if (!v || typeof v !== 'object') return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    Number.isFinite(Number(t.amount)) &&
    (t.type === 'income' || t.type === 'expense' || t.type === 'transfer') &&
    (t.account === 'cash' || t.account === 'bank') &&
    typeof t.timestamp === 'string'
  );
}

export function loadTransactions(): Transaction[] {
  const parsed = readJSON(KEYS.transactions);
  if (Array.isArray(parsed)) {
    const list = parsed
      .filter(isTransaction)
      .map((t) => ({ ...t, amount: Number(t.amount), reason: typeof t.reason === 'string' ? t.reason : '' }));
    if (list.length > 0) return list;
  }

  // Seed from balances saved by the very first versions of the app.
  const now = new Date().toISOString();
  const seeded: Transaction[] = [];
  const cash = parseFloat(read(KEYS.cash) || read(KEYS.legacyBalance) || '0');
  const bank = parseFloat(read(KEYS.bank) || '0');
  if (cash > 0) {
    seeded.push({
      id: `init-cash-${Date.now()}`,
      amount: cash,
      type: 'income',
      account: 'cash',
      reason: 'رصيد كاش افتتاحي',
      timestamp: now,
      kind: 'adjustment',
    });
  }
  if (bank > 0) {
    seeded.push({
      id: `init-bank-${Date.now() + 1}`,
      amount: bank,
      type: 'income',
      account: 'bank',
      reason: 'رصيد بنكي افتتاحي',
      timestamp: now,
      kind: 'adjustment',
    });
  }
  if (seeded.length) write(KEYS.transactions, JSON.stringify(seeded));
  return seeded;
}

export function loadStringList(key: string, fallback: string[]): string[] {
  const parsed = readJSON(key);
  if (Array.isArray(parsed)) {
    const list = parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    if (list.length > 0) return list;
  }
  return fallback;
}

export function loadBudget(): number | null {
  const n = parseFloat(read(KEYS.budget) || '');
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const DEFAULT_QUICK_AMOUNTS: QuickAmounts = { cash: [10, 20], bank: [20, 50] };

export function loadQuickAmounts(): QuickAmounts {
  const p = readJSON(KEYS.quickAmounts) as Partial<QuickAmounts> | null;
  if (p && Array.isArray(p.cash) && Array.isArray(p.bank) && p.cash.length === 2 && p.bank.length === 2) {
    const nums = [...p.cash, ...p.bank].map(Number);
    if (nums.every((n) => Number.isFinite(n) && n > 0)) {
      return { cash: [nums[0], nums[1]], bank: [nums[2], nums[3]] };
    }
  }
  return DEFAULT_QUICK_AMOUNTS;
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // unavailable
  }
}
