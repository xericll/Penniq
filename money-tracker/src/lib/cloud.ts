import type { SupabaseClient } from '@supabase/supabase-js';
import type { Essential, QuickAmounts, Transaction } from '../types';
import { isCurrency } from './currency';
import { roundMoney } from './ledger';
import { KEYS, parseEssentials, readJSON, write } from './storage';

/* ---------- Outbox ---------------------------------------------------------
   Changes made on this device that the account has not received yet. Each entry
   carries a stamp, so a change made while an upload is running is not lost. */

export interface Outbox {
  /** id → stamp of transactions to upload. */
  dirty: Record<string, number>;
  /** id → stamp of transactions to delete from the account. */
  deleted: Record<string, number>;
  /** Stamp of the last unsent settings change; 0 when settings are in sync. */
  settings: number;
}

export const EMPTY_OUTBOX: Outbox = { dirty: {}, deleted: {}, settings: 0 };

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function stampMap(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object') {
    for (const [k, s] of Object.entries(v)) if (typeof s === 'number') out[k] = s;
  }
  return out;
}

export function loadOutbox(): Outbox {
  const p = readJSON(KEYS.cloudOutbox) as Partial<Outbox> | null;
  if (!p || typeof p !== 'object') return EMPTY_OUTBOX;
  return { dirty: stampMap(p.dirty), deleted: stampMap(p.deleted), settings: typeof p.settings === 'number' ? p.settings : 0 };
}

export function saveOutbox(outbox: Outbox): void {
  write(KEYS.cloudOutbox, JSON.stringify(outbox));
}

export function pendingCount(outbox: Outbox): number {
  return Object.keys(outbox.dirty).length + Object.keys(outbox.deleted).length + (outbox.settings ? 1 : 0);
}

let lastStamp = 0;

/** Strictly increasing, also across reloads. */
export function nextStamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

/* ---------- Rows ----------------------------------------------------------- */

interface TxRow {
  id: string;
  amount: number;
  type: Transaction['type'];
  account: Transaction['account'];
  to_account: Transaction['account'] | null;
  reason: string;
  category: string | null;
  occurred_at: string;
  kind: NonNullable<Transaction['kind']> | null;
  person: string | null;
  debt_id: string | null;
}

const TX_COLUMNS = 'id, amount, type, account, to_account, reason, category, occurred_at, kind, person, debt_id';
const LEDGERS: readonly unknown[] = ['cash', 'bank', 'vault', 'loans', 'owed'];
const KINDS: readonly unknown[] = ['adjustment', 'loan', 'borrow', 'repayment'];

function toRow(tx: Transaction): TxRow {
  const when = new Date(tx.timestamp);
  return {
    id: tx.id.slice(0, 80),
    amount: roundMoney(Number(tx.amount) || 0),
    type: tx.type,
    account: tx.account,
    to_account: tx.type === 'transfer' && tx.toAccount && LEDGERS.includes(tx.toAccount) ? tx.toAccount : null,
    reason: (tx.reason || '').slice(0, 2000),
    category: tx.category ? tx.category.slice(0, 120) : null,
    occurred_at: (Number.isNaN(when.getTime()) ? new Date() : when).toISOString(),
    kind: tx.kind && KINDS.includes(tx.kind) ? tx.kind : null,
    person: tx.person ? tx.person.slice(0, 120) : null,
    debt_id: tx.debtId ? tx.debtId.slice(0, 80) : null,
  };
}

function fromRow(row: TxRow): Transaction {
  const tx: Transaction = {
    id: row.id,
    amount: Number(row.amount) || 0,
    type: row.type,
    account: row.account,
    reason: row.reason ?? '',
    timestamp: new Date(row.occurred_at).toISOString(),
  };
  if (row.to_account) tx.toAccount = row.to_account;
  if (row.category) tx.category = row.category;
  if (row.kind) tx.kind = row.kind;
  if (row.person) tx.person = row.person;
  if (row.debt_id) tx.debtId = row.debt_id;
  return tx;
}

/** Two transactions with the same fingerprint are the same row in the account. */
function fingerprint(tx: Transaction): string {
  return JSON.stringify(toRow(tx));
}

/* ---------- Merging (pure) ------------------------------------------------- */

function newestFirst(a: Transaction, b: Transaction): number {
  return (new Date(b.timestamp).getTime() || 0) - (new Date(a.timestamp).getTime() || 0);
}

/** Records in the outbox what changed between two versions of the local list. */
export function trackChanges(outbox: Outbox, prev: Transaction[], next: Transaction[], stamp: number): Outbox {
  const before = new Map(prev.map((t) => [t.id, t]));
  const dirty = { ...outbox.dirty };
  const deleted = { ...outbox.deleted };
  for (const tx of next) {
    const old = before.get(tx.id);
    before.delete(tx.id);
    if (old === tx || (old && fingerprint(old) === fingerprint(tx))) continue;
    dirty[tx.id] = stamp;
    delete deleted[tx.id];
  }
  for (const id of before.keys()) {
    deleted[id] = stamp;
    delete dirty[id];
  }
  return { ...outbox, dirty, deleted };
}

/** Marks every local transaction for upload (first sign-in on a device that already has data). */
export function markAll(outbox: Outbox, local: Transaction[], stamp: number): Outbox {
  const dirty = { ...outbox.dirty };
  for (const tx of local) dirty[tx.id] = stamp;
  return { ...outbox, dirty };
}

/** The account is the truth; changes this device has not uploaded yet are laid on top. */
export function replay(remote: Transaction[], local: Transaction[], outbox: Outbox): Transaction[] {
  const pending = local.filter((t) => has(outbox.dirty, t.id));
  const kept = remote.filter((t) => !has(outbox.dirty, t.id) && !has(outbox.deleted, t.id));
  return [...pending, ...kept].sort(newestFirst);
}

/** Drops what an upload sent, keeping entries that were touched again meanwhile. */
export function settle(current: Outbox, sent: Outbox): Outbox {
  const keep = (now: Record<string, number>, was: Record<string, number>) =>
    Object.fromEntries(Object.entries(now).filter(([id, stamp]) => was[id] !== stamp));
  return {
    dirty: keep(current.dirty, sent.dirty),
    deleted: keep(current.deleted, sent.deleted),
    settings: current.settings === sent.settings ? 0 : current.settings,
  };
}

export function sameList(a: Transaction[], b: Transaction[]): boolean {
  return a.length === b.length && a.every((tx, i) => tx === b[i] || fingerprint(tx) === fingerprint(b[i]));
}

/* ---------- Requests ------------------------------------------------------- */

const PAGE = 1000;
const UPSERT_CHUNK = 500;
const DELETE_CHUNK = 150;

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export async function pullTransactions(sb: SupabaseClient): Promise<Transaction[]> {
  const all: Transaction[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('transactions')
      .select(TX_COLUMNS)
      .order('occurred_at', { ascending: false })
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data as TxRow[]).map(fromRow));
    if (data.length < PAGE) return all;
  }
}

export async function pushTransactions(sb: SupabaseClient, userId: string, txs: Transaction[]): Promise<void> {
  for (const part of chunks(txs, UPSERT_CHUNK)) {
    const rows = part.map((tx) => ({ user_id: userId, ...toRow(tx) }));
    const { error } = await sb.from('transactions').upsert(rows, { onConflict: 'user_id,id' });
    if (error) throw error;
  }
}

export async function deleteTransactions(sb: SupabaseClient, ids: string[]): Promise<void> {
  for (const part of chunks(ids, DELETE_CHUNK)) {
    const { error } = await sb.from('transactions').delete().in('id', part);
    if (error) throw error;
  }
}

/** Per-account preferences. A null field means "nothing usable stored", so the device keeps its own value. */
export interface CloudSettings {
  incomeSources: string[] | null;
  expenseSources: string[] | null;
  budget: number | null;
  quickAmounts: QuickAmounts | null;
  essentials: Essential[] | null;
  /** ISO code; null on accounts created before currencies could be chosen (they are in euros). */
  currency: string | null;
}

function stringList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const list = v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  return list.length ? list : null;
}

function quickAmounts(v: unknown): QuickAmounts | null {
  const p = v as Partial<QuickAmounts> | null;
  if (!p || !Array.isArray(p.cash) || !Array.isArray(p.bank) || p.cash.length !== 2 || p.bank.length !== 2) return null;
  const n = [...p.cash, ...p.bank].map(Number);
  return n.every((x) => Number.isFinite(x) && x > 0) ? { cash: [n[0], n[1]], bank: [n[2], n[3]] } : null;
}

/** null when the account has no settings row yet. */
export async function pullSettings(sb: SupabaseClient): Promise<CloudSettings | null> {
  const { data, error } = await sb
    .from('user_settings')
    .select('income_sources, expense_sources, budget, quick_amounts, essentials, currency')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const budget = Number(data.budget);
  return {
    incomeSources: stringList(data.income_sources),
    expenseSources: stringList(data.expense_sources),
    budget: Number.isFinite(budget) && budget > 0 ? budget : null,
    quickAmounts: quickAmounts(data.quick_amounts),
    essentials: parseEssentials(data.essentials),
    currency: isCurrency(data.currency) ? data.currency : null,
  };
}

export async function pushSettings(sb: SupabaseClient, userId: string, s: CloudSettings): Promise<void> {
  const { error } = await sb.from('user_settings').upsert({
    user_id: userId,
    income_sources: s.incomeSources,
    expense_sources: s.expenseSources,
    budget: s.budget,
    quick_amounts: s.quickAmounts,
    essentials: s.essentials,
    currency: s.currency,
  });
  if (error) throw error;
}

/** Erases the signed-in account together with everything stored for it. */
export async function deleteAccount(sb: SupabaseClient): Promise<void> {
  const { error } = await sb.rpc('delete_account');
  if (error) throw error;
}
