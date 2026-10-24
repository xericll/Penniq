import type { SupabaseClient } from '@supabase/supabase-js';
import type { TranslationKey } from '../i18n/translations';
import type { Essential, Transaction } from '../types';
import { resolveCategory } from './categories';
import {
  byNewest,
  categoryBreakdown,
  daysLeftInMonth,
  debtsOf,
  flowBetween,
  isFlow,
  roundMoney,
  startOfMonth,
  type Balances,
} from './ledger';

/* ---------- Answers --------------------------------------------------------
   The assistant's ready-made questions are answered on the device, straight from
   the ledger, so the figures are exact and nothing leaves the phone. An answer is
   a list of lines; a line mixes text with amounts the bubble renders as <Money>. */

export type Part = string | { money: number; sign?: boolean };
export type Line = Part[];

export type Topic = 'month' | 'categories' | 'budget' | 'compare' | 'biggest' | 'balances' | 'debts' | 'tips';
export const TOPICS: Topic[] = ['month', 'categories', 'budget', 'compare', 'biggest', 'balances', 'debts', 'tips'];

export interface WalletView {
  transactions: Transaction[];
  balances: Balances;
  budget: number | null;
  essentials: Essential[];
}

/** The pieces of the language context an answer needs. */
export interface Speaker {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  localize: (text: string) => string;
  dayLabel: (date: Date) => string;
}

const amount = (money: number, sign = false): Part => ({ money, sign });

/** Puts values into the {placeholders} of a translated sentence, keeping amounts as parts. */
function fill(template: string, values: Record<string, Part | number> = {}): Line {
  return template
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((chunk) => {
      const key = /^\{(\w+)\}$/.exec(chunk)?.[1];
      if (!key || !(key in values)) return chunk;
      const value = values[key];
      return typeof value === 'number' ? String(value) : value;
    });
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

interface Figures {
  now: Date;
  month: ReturnType<typeof flowBetween>;
  last: ReturnType<typeof flowBetween>;
  /** Average spent per day: this month so far, and over the whole of last month. */
  dailyNow: number;
  dailyLast: number;
  toYou: number;
  fromYou: number;
}

function figures(view: WalletView, now: Date): Figures {
  const from = startOfMonth(now);
  const lastFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = flowBetween(view.transactions, from);
  const last = flowBetween(view.transactions, lastFrom, from);
  const lastDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  let toYou = 0;
  let fromYou = 0;
  for (const d of debtsOf(view.transactions)) {
    if (d.side === 'lent') toYou += d.remaining;
    else fromYou += d.remaining;
  }
  return {
    now,
    month,
    last,
    dailyNow: roundMoney(month.expense / now.getDate()),
    dailyLast: roundMoney(last.expense / lastDays),
    toYou: roundMoney(toYou),
    fromYou: roundMoney(fromYou),
  };
}

function tips(view: WalletView, f: Figures, say: Speaker): Line[] {
  const { t } = say;
  const out: Line[] = [];
  const { month } = f;
  const top = categoryBreakdown(view.transactions, startOfMonth(f.now)).slices[0];
  const monthShare = pct(f.now.getDate(), f.now.getDate() + daysLeftInMonth(f.now) - 1);

  if (month.income > 0 && month.expense > month.income) {
    out.push(fill(t('assistant.tip.overspend'), { amount: amount(roundMoney(month.expense - month.income)) }));
  }
  if (view.budget && pct(month.expense, view.budget) > monthShare + 10) {
    out.push(fill(t('assistant.tip.pace'), { month: monthShare, spent: pct(month.expense, view.budget) }));
  }
  if (top && top.share >= 0.4 && month.count >= 3) {
    out.push(fill(t('assistant.tip.topCat'), { name: t(top.category.labelKey), pct: Math.round(top.share * 100) }));
  }
  if (f.dailyLast > 0 && f.dailyNow > f.dailyLast * 1.15) {
    out.push(fill(t('assistant.tip.rising'), { pct: pct(f.dailyNow - f.dailyLast, f.dailyLast) }));
  }
  if (f.fromYou > 0) out.push(fill(t('assistant.tip.owed'), { amount: amount(f.fromYou) }));
  if (month.net > 0) out.push(fill(t('assistant.tip.save'), { amount: amount(month.net) }));
  if (!view.budget) out.push(fill(t('assistant.tip.noBudget')));

  const picked = out.slice(0, 3);
  if (picked.length < 2) picked.push(fill(t('assistant.tip.habit')));
  return [...picked.map((line): Line => ['• ', ...line]), fill(t('assistant.tip.note'))];
}

/** The answer to one of the ready-made questions. */
export function answer(topic: Topic, view: WalletView, say: Speaker, now = new Date()): Line[] {
  const { t } = say;
  const f = figures(view, now);
  const { month } = f;

  switch (topic) {
    case 'month': {
      if (month.count === 0) return [fill(t('assistant.a.monthEmpty'))];
      return [
        fill(t('assistant.a.month'), { income: amount(month.income), expense: amount(month.expense), net: amount(month.net, true) }),
        fill(t('assistant.a.monthPace'), { count: month.count, daily: amount(f.dailyNow) }),
      ];
    }

    case 'categories': {
      const { slices } = categoryBreakdown(view.transactions, startOfMonth(now));
      if (!slices.length) return [fill(t('assistant.a.catsEmpty'))];
      return [
        fill(t('assistant.a.cats')),
        ...slices
          .slice(0, 4)
          .map((s) =>
            fill(t('assistant.a.catLine'), { name: t(s.category.labelKey), amount: amount(s.amount), pct: Math.round(s.share * 100) }),
          ),
      ];
    }

    case 'biggest': {
      const from = startOfMonth(now);
      const list = view.transactions
        .filter((tx) => tx.type === 'expense' && isFlow(tx) && new Date(tx.timestamp) >= from)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);
      if (!list.length) return [fill(t('assistant.a.catsEmpty'))];
      return [
        fill(t('assistant.a.biggest')),
        ...list.map((tx) =>
          fill(t('assistant.a.biggestLine'), {
            reason: say.localize(tx.reason) || t(resolveCategory(tx.category).labelKey),
            amount: amount(tx.amount),
            date: say.dayLabel(new Date(tx.timestamp)),
          }),
        ),
      ];
    }

    case 'budget': {
      if (!view.budget) return [fill(t('assistant.a.budgetNone'))];
      const left = roundMoney(view.budget - month.expense);
      const days = daysLeftInMonth(now);
      return [
        fill(t('assistant.a.budget'), {
          budget: amount(view.budget),
          spent: amount(month.expense),
          pct: pct(month.expense, view.budget),
        }),
        left >= 0
          ? fill(t('assistant.a.budgetLeft'), { left: amount(left), daily: amount(roundMoney(left / days)), days })
          : fill(t('assistant.a.budgetOver'), { over: amount(-left) }),
      ];
    }

    case 'balances': {
      const b = view.balances;
      const lines = [fill(t('assistant.a.balances'), { total: amount(b.total), cash: amount(b.cash), bank: amount(b.bank) })];
      if (b.vault !== 0) lines.push(fill(t('assistant.a.vault'), { vault: amount(b.vault) }));
      if (f.toYou > 0 || f.fromYou > 0) {
        lines.push(fill(t('assistant.a.debtsShort'), { toYou: amount(f.toYou), fromYou: amount(f.fromYou) }));
      }
      return lines;
    }

    case 'debts': {
      const open = debtsOf(view.transactions).filter((d) => d.remaining > 0);
      if (!open.length) return [fill(t('assistant.a.debtsNone'))];
      const lines: Line[] = [];
      for (const side of ['lent', 'borrowed'] as const) {
        const list = open.filter((d) => d.side === side);
        if (!list.length) continue;
        lines.push(
          fill(t(side === 'lent' ? 'assistant.a.debtsLent' : 'assistant.a.debtsBorrowed'), {
            total: amount(side === 'lent' ? f.toYou : f.fromYou),
          }),
        );
        for (const d of list.slice(0, 6)) {
          lines.push(fill(t('assistant.a.debtLine'), { person: d.person || t('debt.someone'), amount: amount(d.remaining) }));
        }
      }
      return lines;
    }

    case 'compare': {
      if (f.last.expense === 0) return [fill(t('assistant.a.compareNone'))];
      const change = pct(f.dailyNow - f.dailyLast, f.dailyLast);
      const values = { avgNow: amount(f.dailyNow), avgLast: amount(f.dailyLast), pct: Math.abs(change) };
      return [
        fill(t('assistant.a.compare'), { now: amount(month.expense), last: amount(f.last.expense) }),
        fill(
          t(Math.abs(change) < 5 ? 'assistant.a.compareSame' : change > 0 ? 'assistant.a.compareUp' : 'assistant.a.compareDown'),
          values,
        ),
      ];
    }

    case 'tips':
      return tips(view, f, say);
  }
}

/** Words that point at a topic, in the three languages. The first match wins, so the narrow topics come first. */
const HINTS: [Topic, RegExp][] = [
  ['debts', /دين|ديون|دَين|استدن|سداد|schuld|geliehen|verliehen|debt|owe|lent|borrow|loan/i],
  ['budget', /ميزاني|budget/i],
  ['compare', /قارن|مقارن|الماضي|السابق|vergleich|vormonat|letzte[nr]? monat|compare|last month|previous/i],
  ['biggest', /[أا]كبر|[أا]غلى|größte|höchste|teuerste|biggest|largest|highest/i],
  ['tips', /نصيح|نصائح|وف[ّ]?ر|توفير|ادخار|[أا]دخر|tipp|spar|rat\b|tips?\b|advice|save|saving/i],
  ['categories', /[أا]ين|وين|تصنيف|فئ[ةا]|wohin|kategor|wofür|where|categor/i],
  [
    'balances',
    /رصيد|[أا]رصد|كم معي|كم عندي|خزن|kontostand|guthaben|wie viel (geld )?habe ich(?!.*(ausgegeben|verdient|eingenommen))|balance|how much (money )?do i have|vault/i,
  ],
  ['month', /شهر|صرف|مصروف|مصاريف|دخل|صافي|monat|ausgab|ausgegeben|einnahm|month|spen[dt]|income|expens/i],
];

export function matchTopic(text: string): Topic | null {
  return HINTS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

/** An answer as plain text, for the conversation history sent to the model. */
export function linesText(lines: Line[], money: (value: number, opts?: { sign?: boolean }) => string): string {
  return lines.map((line) => line.map((p) => (typeof p === 'string' ? p : money(p.money, { sign: p.sign }))).join('')).join('\n');
}

/* ---------- The model ------------------------------------------------------
   Free-form questions go to the `assistant` edge function of the app's own
   Supabase project, which holds the AI key. The device sends the question with
   a digest of the wallet: totals, categories and recent entries, never the
   names of the people in the debts. */

const MONTHS_BACK = 6;
const RECENT_ENTRIES = 40;

export function walletDigest(view: WalletView, currency: string, now = new Date()) {
  const f = figures(view, now);
  const months = Array.from({ length: MONTHS_BACK }, (_, i) => {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const flow = flowBetween(view.transactions, from, new Date(from.getFullYear(), from.getMonth() + 1, 1));
    return { month: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`, income: flow.income, expense: flow.expense };
  });
  const b = view.balances;
  return {
    today: now.toISOString().slice(0, 10),
    currency,
    balances: { cash: b.cash, bank: b.bank, wallet: b.total, vault: b.vault },
    debts: { owedToUser: f.toYou, owedByUser: f.fromYou },
    monthlyBudget: view.budget,
    months,
    categoriesThisMonth: categoryBreakdown(view.transactions, startOfMonth(now)).slices.map((s) => ({
      category: s.category.id,
      amount: s.amount,
    })),
    fixedMonthly: view.essentials.map((e) => ({ name: e.name.slice(0, 60), type: e.type, amount: e.amount })),
    recent: view.transactions
      .filter(isFlow)
      .sort(byNewest)
      .slice(0, RECENT_ENTRIES)
      .map((tx) => ({
        date: tx.timestamp.slice(0, 10),
        type: tx.type,
        amount: tx.amount,
        account: tx.account,
        ...(tx.type === 'expense' && { category: resolveCategory(tx.category).id }),
        note: tx.reason.slice(0, 80),
      })),
  };
}

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export type AssistantFailure = 'off' | 'limit' | 'refused' | 'network';

/** Reads the function's JSON answer whether the call succeeded or came back as an HTTP error. */
async function payloadOf(data: unknown, error: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!error) return { status: 200, body: (data ?? {}) as Record<string, unknown> };
  const response = (error as { context?: unknown }).context;
  if (!(response instanceof Response)) return { status: 0, body: {} };
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body: body && typeof body === 'object' ? body : {} };
}

/** Whether free-form questions can be answered right now. Sends no wallet data. */
export async function assistantReady(sb: SupabaseClient): Promise<boolean> {
  const { data, error } = await sb.functions.invoke('assistant', { body: { ping: true } });
  const { status, body } = await payloadOf(data, error);
  return status === 200 && body.ready === true;
}

export async function askAssistant(
  sb: SupabaseClient,
  request: { lang: string; turns: Turn[]; wallet: ReturnType<typeof walletDigest> },
): Promise<{ ok: true; text: string } | { ok: false; reason: AssistantFailure }> {
  const { data, error } = await sb.functions.invoke('assistant', { body: request });
  const { status, body } = await payloadOf(data, error);
  if (status === 200 && typeof body.text === 'string' && body.text.trim()) return { ok: true, text: body.text.trim() };
  // Not deployed, or deployed without a key: the ready-made answers carry on alone.
  if (status === 404 || body.error === 'not_configured') return { ok: false, reason: 'off' };
  if (status === 429 && body.error === 'limit') return { ok: false, reason: 'limit' };
  if (body.error === 'refused') return { ok: false, reason: 'refused' };
  return { ok: false, reason: 'network' };
}

export const QUESTION_MAX_LENGTH = 500;
/** Turns of the conversation the model gets to see. */
export const HISTORY_TURNS = 12;
