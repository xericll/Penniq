import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CloudSettings } from '../lib/cloud';
import { useI18n } from '../i18n/LanguageContext';
import { celebrateMilestone } from '../lib/confetti';
import { DEFAULT_CURRENCY } from '../lib/currency';
import { computeBalances, isWallet, moneyPlaces, newId, roundMoney, touchesAccount, type Balances } from '../lib/ledger';
import { applyRules } from '../lib/rules';
import { DEFAULT_EXPENSE_SOURCES, DEFAULT_INCOME_SOURCES } from '../lib/sources';
import {
  DEFAULT_QUICK_AMOUNTS,
  KEYS,
  loadBudget,
  loadEssentials,
  loadQuickAmounts,
  loadStringList,
  loadTransactions,
  read,
  removeKey,
  write,
} from '../lib/storage';
import {
  MAIN_WORKSPACE,
  MAX_WORKSPACES,
  defaultWorkspaces,
  inWorkspace,
  loadActiveWorkspace,
  loadWorkspaces,
  mergeWorkspaces,
  sameWorkspaces,
  saveWorkspaces,
  type Workspace,
} from '../lib/workspaces';
import type { AccountType, Essential, Ledger, QuickAmounts, Transaction } from '../types';
import { useAuth } from './AuthContext';
import { useCloudSync, type CloudHost, type CloudValue } from './useCloudSync';
import { usePlanner } from './PlannerContext';

export type ResetTarget = 'all' | 'cash' | 'bank';

/** Stored in Arabic like every built-in reason; translated on display through PHRASES. */
const CORRECTION_REASON: Record<Ledger, string> = {
  cash: 'تصحيح رصيد الكاش',
  bank: 'تصحيح رصيد البنك',
  vault: 'تصحيح رصيد الخزنة',
  loans: 'تصحيح الديون',
  owed: 'تصحيح ديون عليك',
};

/** A balance change, used to drive the floating "+20 €" chips and glow rings. */
export interface Pulse {
  id: string;
  target: 'total' | AccountType;
  delta: number;
}

export type NewTransaction = Omit<Transaction, 'id' | 'timestamp'> & {
  timestamp?: string;
  /** Leave the automation rules out (an entry the user already reviewed field by field). */
  skipRules?: boolean;
};

/** Puts an entry (or an essential) in a workspace; the first one is stored without an id, like every older entry. */
function tag<T extends { workspace?: string }>(item: T, workspace: string | undefined): T {
  const out = { ...item };
  if (workspace && workspace !== MAIN_WORKSPACE) out.workspace = workspace;
  else delete out.workspace;
  return out;
}

export type WorkspaceDraft = Omit<Workspace, 'id'>;

interface WalletValue {
  /** The entries of the open workspace: everything on screen is worked out from these. */
  transactions: Transaction[];
  /** Entries of every workspace (savings goals follow their own transfers wherever they are). */
  allTransactions: Transaction[];
  balances: Balances;
  workspaces: Workspace[];
  /** The open workspace. */
  workspace: Workspace;
  setWorkspace: (id: string) => void;
  addWorkspace: (draft: WorkspaceDraft) => Workspace | null;
  editWorkspace: (ws: Workspace) => void;
  /** Deletes a workspace with all its entries and essentials; the first one cannot be deleted. */
  removeWorkspace: (id: string) => void;
  /** Number of entries in a workspace. */
  workspaceCount: (id: string) => number;
  lastUpdated: string | null;
  /** True when the last save to this device failed — entries then live in memory only. */
  saveFailed: boolean;
  incomeSources: string[];
  expenseSources: string[];
  budget: number | null;
  quickAmounts: QuickAmounts;
  /** Fixed monthly incomes and costs the user keeps as a list. */
  essentials: Essential[];
  pulses: Pulse[];
  /** Account sync: status, pending uploads and the first sign-in decision. */
  cloud: CloudValue;

  add: (tx: NewTransaction) => Transaction;
  update: (tx: Transaction) => void;
  remove: (id: string) => Transaction | undefined;
  /** Removes several entries at once (a loan with its repayments) and returns them for undo. */
  removeMany: (ids: string[]) => Transaction[];
  restore: (txs: Transaction[]) => void;
  replaceAll: (txs: Transaction[]) => void;
  reset: (target: ResetTarget) => Transaction[];
  countFor: (target: ResetTarget) => number;
  setBalance: (account: Ledger, value: number, reason?: string) => number;

  setIncomeSources: (list: string[]) => void;
  setExpenseSources: (list: string[]) => void;
  setBudget: (value: number | null) => void;
  setQuickAmounts: (q: QuickAmounts) => void;
  setEssentials: (list: Essential[]) => void;
  /** Changes the currency everything is shown in (amounts are not converted) and syncs the choice. */
  setCurrency: (code: string) => void;
}

const WalletContext = createContext<WalletValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [allTransactions, setTransactions] = useState<Transaction[]>(loadTransactions);
  const [workspaces, setWorkspacesState] = useState<Workspace[]>(loadWorkspaces);
  const [workspaceId, setWorkspaceId] = useState(() => loadActiveWorkspace(loadWorkspaces()));
  const [lastUpdated, setLastUpdated] = useState<string | null>(() => read(KEYS.updated));
  const [saveFailed, setSaveFailed] = useState(false);
  const [incomeSources, setIncomeSourcesState] = useState(() => loadStringList(KEYS.incomeSources, DEFAULT_INCOME_SOURCES));
  const [expenseSources, setExpenseSourcesState] = useState(() => loadStringList(KEYS.expenseSources, DEFAULT_EXPENSE_SOURCES));
  const [budget, setBudgetState] = useState<number | null>(loadBudget);
  const [quickAmounts, setQuickAmountsState] = useState<QuickAmounts>(loadQuickAmounts);
  const [allEssentials, setEssentialsState] = useState<Essential[]>(loadEssentials);
  const [pulses, setPulses] = useState<Pulse[]>([]);

  // Sums are rounded to the precision of the wallet currency, so they are redone when it changes.
  const places = moneyPlaces();
  const transactions = useMemo(() => allTransactions.filter((t) => inWorkspace(t, workspaceId)), [allTransactions, workspaceId]);
  const essentials = useMemo(() => allEssentials.filter((e) => inWorkspace(e, workspaceId)), [allEssentials, workspaceId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const balances = useMemo(() => computeBalances(transactions), [transactions, places]);

  // Keep refs so callbacks always read the latest list (of every workspace) without re-creating.
  const txRef = useRef(allTransactions);
  txRef.current = allTransactions;
  const wsRef = useRef(workspaceId);
  wsRef.current = workspaceId;
  /** The entries of the open workspace in a list. */
  const scoped = useCallback((list: Transaction[]) => list.filter((t) => inWorkspace(t, wsRef.current)), []);

  const { user } = useAuth();
  const { rulesRef } = usePlanner();
  const { localize } = useI18n();
  const localizeRef = useRef(localize);
  localizeRef.current = localize;
  const host = useRef<CloudHost>(null!);
  const { cloud, track, touchSettings } = useCloudSync(user?.id ?? null, host);

  /** Saves a list on this device. Shared by local changes and by rows arriving from the account. */
  const store = useCallback((next: Transaction[]) => {
    // Older builds reading the same storage know only the first workspace.
    const after = computeBalances(next.filter((t) => inWorkspace(t, MAIN_WORKSPACE)));
    txRef.current = next;
    setTransactions(next);

    const now = new Date().toISOString();
    setLastUpdated(now);
    setSaveFailed(!write(KEYS.transactions, JSON.stringify(next)));
    write(KEYS.updated, now);
    // Legacy mirrors, kept for older builds reading the same storage.
    write(KEYS.cash, String(after.cash));
    write(KEYS.bank, String(after.bank));
    write(KEYS.legacyBalance, String(after.cash));
  }, []);

  const commit = useCallback(
    (next: Transaction[]) => {
      const prev = txRef.current;
      const before = computeBalances(scoped(prev));
      store(next);
      const after = computeBalances(scoped(next));
      track(prev, next);

      const fresh: Pulse[] = [];
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      (['total', 'cash', 'bank'] as const).forEach((target) => {
        const delta = roundMoney(after[target] - before[target]);
        if (delta !== 0) fresh.push({ id: `${stamp}-${target}`, target, delta });
      });
      if (fresh.length) {
        setPulses((p) => [...p, ...fresh]);
        window.setTimeout(() => setPulses((p) => p.filter((x) => !fresh.includes(x))), 1400);
      }
      return { before, after };
    },
    [store, scoped, track],
  );

  const add = useCallback(
    ({ skipRules, ...input }: NewTransaction) => {
      // The automation rules see every new income and expense; transfers, debts and corrections are left alone.
      const ruled = skipRules || input.kind || input.type === 'transfer' ? input : applyRules(input, rulesRef.current, localizeRef.current);
      const tx: Transaction = tag(
        {
          ...ruled,
          amount: roundMoney(ruled.amount),
          id: newId(),
          timestamp: ruled.timestamp ?? new Date().toISOString(),
        },
        wsRef.current,
      );
      if (tx.type !== 'transfer') delete tx.toAccount;
      const { before, after } = commit([tx, ...txRef.current]);
      if (tx.kind !== 'adjustment') celebrateMilestone(before.total, after.total);
      return tx;
    },
    [commit],
  );

  const update = useCallback(
    // An edited entry stays in the workspace it was recorded in.
    (tx: Transaction) =>
      commit(txRef.current.map((t) => (t.id === tx.id ? tag({ ...tx, amount: roundMoney(tx.amount) }, t.workspace) : t))),
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

  const removeMany = useCallback(
    (ids: string[]) => {
      const gone = new Set(ids);
      const found = txRef.current.filter((t) => gone.has(t.id));
      if (found.length) commit(txRef.current.filter((t) => !gone.has(t.id)));
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

  /** Entries of the open workspace a reset would remove. */
  const resetList = useCallback(
    (target: ResetTarget) => scoped(txRef.current).filter((t) => target === 'all' || touchesAccount(t, target)),
    [scoped],
  );

  const countFor = useCallback((target: ResetTarget) => resetList(target).length, [resetList]);

  /** Empties the open workspace (or one of its accounts) and returns what was removed, for undo. */
  const reset = useCallback(
    (target: ResetTarget) => {
      const gone = resetList(target);
      const ids = new Set(gone.map((t) => t.id));
      commit(txRef.current.filter((t) => !ids.has(t.id)));
      return gone;
    },
    [commit, resetList],
  );

  const setBalance = useCallback(
    (account: Ledger, value: number, reason?: string) => {
      const current = computeBalances(scoped(txRef.current))[account];
      const diff = roundMoney(value - current);
      if (diff !== 0) {
        add({
          amount: Math.abs(diff),
          type: diff > 0 ? 'income' : 'expense',
          account,
          reason: reason ?? CORRECTION_REASON[account],
          category: diff < 0 && isWallet(account) ? 'متفرقات' : undefined,
          kind: 'adjustment',
        });
      }
      return diff;
    },
    [add, scoped],
  );

  // Read by the sync engine, so an upload always carries the latest preferences.
  const { currency, setCurrency: showCurrency } = useI18n();
  const settingsRef = useRef<CloudSettings>({
    incomeSources,
    expenseSources,
    budget,
    quickAmounts,
    essentials: allEssentials,
    currency,
    workspaces,
  });

  const openWorkspace = useCallback((id: string) => {
    wsRef.current = id;
    setWorkspaceId(id);
    if (id === MAIN_WORKSPACE) removeKey(KEYS.workspace);
    else write(KEYS.workspace, id);
  }, []);

  /** Applies preferences on this device only; a null list goes back to its default. */
  const storeSettings = useCallback(
    (s: Partial<CloudSettings>) => {
      const next = { ...settingsRef.current };
      if (s.incomeSources !== undefined) {
        next.incomeSources = s.incomeSources ?? DEFAULT_INCOME_SOURCES;
        setIncomeSourcesState(next.incomeSources);
        if (s.incomeSources) write(KEYS.incomeSources, JSON.stringify(s.incomeSources));
        else removeKey(KEYS.incomeSources);
      }
      if (s.expenseSources !== undefined) {
        next.expenseSources = s.expenseSources ?? DEFAULT_EXPENSE_SOURCES;
        setExpenseSourcesState(next.expenseSources);
        if (s.expenseSources) write(KEYS.expenseSources, JSON.stringify(s.expenseSources));
        else removeKey(KEYS.expenseSources);
      }
      if (s.budget !== undefined) {
        next.budget = s.budget && s.budget > 0 ? s.budget : null;
        setBudgetState(next.budget);
        if (next.budget) write(KEYS.budget, String(next.budget));
        else removeKey(KEYS.budget);
      }
      if (s.quickAmounts !== undefined) {
        next.quickAmounts = s.quickAmounts ?? DEFAULT_QUICK_AMOUNTS;
        setQuickAmountsState(next.quickAmounts);
        if (s.quickAmounts) write(KEYS.quickAmounts, JSON.stringify(s.quickAmounts));
        else removeKey(KEYS.quickAmounts);
      }
      if (s.essentials !== undefined) {
        next.essentials = s.essentials ?? [];
        setEssentialsState(next.essentials);
        if (s.essentials) write(KEYS.essentials, JSON.stringify(s.essentials));
        else removeKey(KEYS.essentials);
      }
      if (s.currency !== undefined) {
        next.currency = s.currency ?? DEFAULT_CURRENCY;
        showCurrency(next.currency);
      }
      if (s.workspaces !== undefined) {
        next.workspaces = s.workspaces ?? defaultWorkspaces();
        setWorkspacesState(next.workspaces);
        if (s.workspaces) saveWorkspaces(s.workspaces);
        else removeKey(KEYS.workspaces);
        // The open workspace was deleted (here or on another device): back to the first one.
        if (!next.workspaces.some((w) => w.id === wsRef.current)) openWorkspace(MAIN_WORKSPACE);
      }
      settingsRef.current = next;
    },
    [showCurrency, openWorkspace],
  );

  const changeSettings = useCallback(
    (s: Partial<CloudSettings>) => {
      storeSettings(s);
      touchSettings();
    },
    [storeSettings, touchSettings],
  );

  const setIncomeSources = useCallback((list: string[]) => changeSettings({ incomeSources: list }), [changeSettings]);
  const setExpenseSources = useCallback((list: string[]) => changeSettings({ expenseSources: list }), [changeSettings]);
  const setBudget = useCallback((value: number | null) => changeSettings({ budget: value }), [changeSettings]);
  const setQuickAmounts = useCallback((q: QuickAmounts) => changeSettings({ quickAmounts: q }), [changeSettings]);
  /** Replaces the essentials of the open workspace; the other workspaces keep theirs. */
  const setEssentials = useCallback(
    (list: Essential[]) => {
      const others = (settingsRef.current.essentials ?? []).filter((e) => !inWorkspace(e, wsRef.current));
      changeSettings({ essentials: [...others, ...list.map((e) => tag(e, wsRef.current))] });
    },
    [changeSettings],
  );
  const setCurrency = useCallback((code: string) => changeSettings({ currency: code }), [changeSettings]);

  const listWorkspaces = () => settingsRef.current.workspaces ?? defaultWorkspaces();

  const setWorkspace = useCallback(
    (id: string) => {
      if (listWorkspaces().some((w) => w.id === id)) openWorkspace(id);
    },
    [openWorkspace],
  );

  const addWorkspace = useCallback(
    (draft: WorkspaceDraft) => {
      const list = listWorkspaces();
      if (list.length >= MAX_WORKSPACES) return null;
      const ws: Workspace = { ...draft, name: draft.name.trim().slice(0, 40), id: `ws-${newId()}` };
      changeSettings({ workspaces: [...list, ws] });
      openWorkspace(ws.id);
      return ws;
    },
    [changeSettings, openWorkspace],
  );

  const editWorkspace = useCallback(
    (ws: Workspace) =>
      changeSettings({
        workspaces: listWorkspaces().map((w) => (w.id === ws.id ? { ...ws, name: ws.name.trim().slice(0, 40) } : w)),
      }),
    [changeSettings],
  );

  const removeWorkspace = useCallback(
    (id: string) => {
      if (id === MAIN_WORKSPACE) return;
      const kept = txRef.current.filter((t) => !inWorkspace(t, id));
      if (kept.length !== txRef.current.length) commit(kept);
      if (wsRef.current === id) openWorkspace(MAIN_WORKSPACE);
      changeSettings({
        workspaces: listWorkspaces().filter((w) => w.id !== id),
        essentials: (settingsRef.current.essentials ?? []).filter((e) => !inWorkspace(e, id)),
      });
    },
    [commit, changeSettings, openWorkspace],
  );

  const workspaceCount = useCallback((id: string) => txRef.current.filter((t) => inWorkspace(t, id)).length, []);

  const workspace = workspaces.find((w) => w.id === workspaceId) ?? workspaces[0];

  host.current = {
    getTransactions: () => txRef.current,
    applyTransactions: store,
    getSettings: () => settingsRef.current,
    applySettings: (s) => {
      if (!s)
        return storeSettings({
          incomeSources: null,
          expenseSources: null,
          budget: null,
          quickAmounts: null,
          essentials: null,
          workspaces: null,
        });
      // Arrives after the entries, so every workspace they are in is still on the list.
      const workspaces = mergeWorkspaces(s.workspaces, listWorkspaces(), txRef.current);
      // Lists the account has no usable value for stay as they are on this device.
      storeSettings({
        budget: s.budget,
        // An account without a stored currency dates from the euro-only days.
        currency: s.currency ?? DEFAULT_CURRENCY,
        ...(s.incomeSources && { incomeSources: s.incomeSources }),
        ...(s.expenseSources && { expenseSources: s.expenseSources }),
        ...(s.quickAmounts && { quickAmounts: s.quickAmounts }),
        ...(s.essentials && { essentials: s.essentials }),
        workspaces,
      });
      // The account's list was missing some (or all) of them: send the full one back.
      if (!s.workspaces || !sameWorkspaces(s.workspaces, workspaces)) touchSettings();
    },
  };

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
      allTransactions,
      balances,
      workspaces,
      workspace,
      setWorkspace,
      addWorkspace,
      editWorkspace,
      removeWorkspace,
      workspaceCount,
      lastUpdated,
      saveFailed,
      incomeSources,
      expenseSources,
      budget,
      quickAmounts,
      essentials,
      pulses,
      cloud,
      add,
      update,
      remove,
      removeMany,
      restore,
      replaceAll,
      reset,
      countFor,
      setBalance,
      setIncomeSources,
      setExpenseSources,
      setBudget,
      setQuickAmounts,
      setEssentials,
      setCurrency,
    }),
    [
      transactions,
      allTransactions,
      balances,
      workspaces,
      workspace,
      setWorkspace,
      addWorkspace,
      editWorkspace,
      removeWorkspace,
      workspaceCount,
      lastUpdated,
      saveFailed,
      incomeSources,
      expenseSources,
      budget,
      quickAmounts,
      essentials,
      pulses,
      cloud,
      add,
      update,
      remove,
      removeMany,
      restore,
      replaceAll,
      reset,
      countFor,
      setBalance,
      setIncomeSources,
      setExpenseSources,
      setBudget,
      setQuickAmounts,
      setEssentials,
      setCurrency,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}
