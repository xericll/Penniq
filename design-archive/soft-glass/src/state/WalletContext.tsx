import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { celebrateMilestone } from '../lib/confetti';
import { computeBalances, newId, round2, touchesAccount, type Balances } from '../lib/ledger';
import { DEFAULT_EXPENSE_SOURCES, DEFAULT_INCOME_SOURCES } from '../lib/sources';
import { KEYS, loadBudget, loadQuickAmounts, loadStringList, loadTransactions, read, removeKey, write } from '../lib/storage';
import type { AccountType, QuickAmounts, Transaction } from '../types';

export type ResetTarget = 'all' | 'cash' | 'bank';

/** A balance change, used to drive the floating "+20 €" chips and glow rings. */
export interface Pulse {
  id: string;
  target: 'total' | AccountType;
  delta: number;
}

export type NewTransaction = Omit<Transaction, 'id' | 'timestamp'> & { timestamp?: string };

interface WalletValue {
  transactions: Transaction[];
  balances: Balances;
  lastUpdated: string | null;
  incomeSources: string[];
  expenseSources: string[];
  budget: number | null;
  quickAmounts: QuickAmounts;
  pulses: Pulse[];

  add: (tx: NewTransaction) => Transaction;
  update: (tx: Transaction) => void;
  remove: (id: string) => Transaction | undefined;
  restore: (txs: Transaction[]) => void;
  replaceAll: (txs: Transaction[]) => void;
  reset: (target: ResetTarget) => Transaction[];
  countFor: (target: ResetTarget) => number;
  setBalance: (account: AccountType, value: number, reason?: string) => number;

  setIncomeSources: (list: string[]) => void;
  setExpenseSources: (list: string[]) => void;
  setBudget: (value: number | null) => void;
  setQuickAmounts: (q: QuickAmounts) => void;
}

const WalletContext = createContext<WalletValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>(loadTransactions);
  const [lastUpdated, setLastUpdated] = useState<string | null>(() => read(KEYS.updated));
  const [incomeSources, setIncomeSourcesState] = useState(() => loadStringList(KEYS.incomeSources, DEFAULT_INCOME_SOURCES));
  const [expenseSources, setExpenseSourcesState] = useState(() => loadStringList(KEYS.expenseSources, DEFAULT_EXPENSE_SOURCES));
  const [budget, setBudgetState] = useState<number | null>(loadBudget);
  const [quickAmounts, setQuickAmountsState] = useState<QuickAmounts>(loadQuickAmounts);
  const [pulses, setPulses] = useState<Pulse[]>([]);

  const balances = useMemo(() => computeBalances(transactions), [transactions]);

  // Keep a ref so callbacks always read the latest list without re-creating.
  const txRef = useRef(transactions);
  txRef.current = transactions;

  const commit = useCallback((next: Transaction[]) => {
    const before = computeBalances(txRef.current);
    const after = computeBalances(next);
    txRef.current = next;
    setTransactions(next);

    const now = new Date().toISOString();
    setLastUpdated(now);
    write(KEYS.transactions, JSON.stringify(next));
    write(KEYS.updated, now);
    // Legacy mirrors, kept for older builds reading the same storage.
    write(KEYS.cash, String(after.cash));
    write(KEYS.bank, String(after.bank));
    write(KEYS.legacyBalance, String(after.cash));

    const fresh: Pulse[] = [];
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    (['total', 'cash', 'bank'] as const).forEach((target) => {
      const delta = round2(after[target] - before[target]);
      if (delta !== 0) fresh.push({ id: `${stamp}-${target}`, target, delta });
    });
    if (fresh.length) {
      setPulses((p) => [...p, ...fresh]);
      window.setTimeout(() => setPulses((p) => p.filter((x) => !fresh.includes(x))), 1400);
    }
    return { before, after };
  }, []);

  const add = useCallback(
    (input: NewTransaction) => {
      const tx: Transaction = {
        ...input,
        amount: round2(input.amount),
        id: newId(),
        timestamp: input.timestamp ?? new Date().toISOString(),
      };
      if (tx.type !== 'transfer') delete tx.toAccount;
      const { before, after } = commit([tx, ...txRef.current]);
      if (tx.kind !== 'adjustment') celebrateMilestone(before.total, after.total);
      return tx;
    },
    [commit],
  );

  const update = useCallback(
    (tx: Transaction) => commit(txRef.current.map((t) => (t.id === tx.id ? { ...tx, amount: round2(tx.amount) } : t))),
    [commit],
  );

  const remove = useCallback(
    (id: string) => {
      const found = txRef.current.find((t) => t.id === id);
      if (found) commit(txRef.current.filter((t) => t.id !== id));
      return found;
    },
    [commit],
  );

  const restore = useCallback(
    (txs: Transaction[]) => {
      const ids = new Set(txRef.current.map((t) => t.id));
      commit([...txs.filter((t) => !ids.has(t.id)), ...txRef.current]);
    },
    [commit],
  );

  const replaceAll = useCallback((txs: Transaction[]) => commit(txs), [commit]);

  const countFor = useCallback(
    (target: ResetTarget) => (target === 'all' ? txRef.current.length : txRef.current.filter((t) => touchesAccount(t, target)).length),
    [],
  );

  const reset = useCallback(
    (target: ResetTarget) => {
      const snapshot = txRef.current;
      commit(target === 'all' ? [] : snapshot.filter((t) => !touchesAccount(t, target)));
      return snapshot;
    },
    [commit],
  );

  const setBalance = useCallback(
    (account: AccountType, value: number, reason?: string) => {
      const current = computeBalances(txRef.current)[account];
      const diff = round2(value - current);
      if (diff !== 0) {
        add({
          amount: Math.abs(diff),
          type: diff > 0 ? 'income' : 'expense',
          account,
          reason: reason ?? (account === 'cash' ? 'تصحيح رصيد الكاش' : 'تصحيح رصيد البنك'),
          category: diff < 0 ? 'متفرقات' : undefined,
          kind: 'adjustment',
        });
      }
      return diff;
    },
    [add],
  );

  const setIncomeSources = useCallback((list: string[]) => {
    setIncomeSourcesState(list);
    write(KEYS.incomeSources, JSON.stringify(list));
  }, []);

  const setExpenseSources = useCallback((list: string[]) => {
    setExpenseSourcesState(list);
    write(KEYS.expenseSources, JSON.stringify(list));
  }, []);

  const setBudget = useCallback((value: number | null) => {
    setBudgetState(value);
    if (value && value > 0) write(KEYS.budget, String(value));
    else removeKey(KEYS.budget);
  }, []);

  const setQuickAmounts = useCallback((q: QuickAmounts) => {
    setQuickAmountsState(q);
    write(KEYS.quickAmounts, JSON.stringify(q));
  }, []);

  // Sync when another tab edits the same wallet.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEYS.transactions) setTransactions(loadTransactions());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<WalletValue>(
    () => ({
      transactions,
      balances,
      lastUpdated,
      incomeSources,
      expenseSources,
      budget,
      quickAmounts,
      pulses,
      add,
      update,
      remove,
      restore,
      replaceAll,
      reset,
      countFor,
      setBalance,
      setIncomeSources,
      setExpenseSources,
      setBudget,
      setQuickAmounts,
    }),
    [
      transactions,
      balances,
      lastUpdated,
      incomeSources,
      expenseSources,
      budget,
      quickAmounts,
      pulses,
      add,
      update,
      remove,
      restore,
      replaceAll,
      reset,
      countFor,
      setBalance,
      setIncomeSources,
      setExpenseSources,
      setBudget,
      setQuickAmounts,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}
