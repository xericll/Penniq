import type { SupabaseClient } from '@supabase/supabase-js';
import type { NewTransaction } from '../state/WalletContext';
import type { AccountType, TransactionType } from '../types';
import { payloadOf } from './assistant';
import { categoryById, isCategoryId, type CategoryId } from './categories';
import { roundMoney } from './ledger';
import { DEFAULT_REASON } from './sources';

/* ------------------------------------------------------------------------
   Voice entry: the user says what they spent or received, the model (through
   the app's own `assistant` function) turns it into draft entries, and the
   user reviews them before anything is recorded. The recording is sent once
   and never stored; without an account a typed sentence is read on the device.
   ------------------------------------------------------------------------ */

/** Longest recording, in seconds. */
export const MAX_SECONDS = 45;
export const TEXT_MAX_LENGTH = 600;

/** One entry the user is still reviewing. */
export interface VoiceDraft {
  key: string;
  type: TransactionType;
  amount: number;
  /** Where the money came from (for a transfer: the account it left); unspecified until the user or the speech says. */
  account: AccountType | 'unspecified';
  category: CategoryId;
  /** Income only: one of the user's income sources, or ''. */
  source: string;
  note: string;
  daysAgo: number;
}

let keys = 0;
const nextKey = () => `d${++keys}`;

/* ---------- Recording (16 kHz mono WAV, which every model and browser handles) ---------- */

export interface Recording {
  data: string;
  mime: string;
  seconds: number;
}

export interface Recorder {
  /** Loudness of the last few milliseconds, 0–1. */
  level: () => number;
  stop: () => Promise<Recording>;
  cancel: () => void;
}

export function canRecord(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    !!(window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  );
}

/** Starts recording; must be called from a tap (browsers allow sound only after one). */
export async function startRecording(): Promise<Recorder> {
  const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const ctx = new Ctx();
  if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
  const input = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  // ScriptProcessor is old but the one capture path every browser (Safari included) still has without extra files.
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  processor.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  input.connect(analyser);
  input.connect(processor);
  // Silent output: the processor only runs while it is connected to the destination.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  processor.connect(mute);
  mute.connect(ctx.destination);
  const buffer = new Uint8Array(analyser.fftSize);
  const started = performance.now();

  const release = () => {
    processor.onaudioprocess = null;
    try {
      input.disconnect();
      processor.disconnect();
      mute.disconnect();
    } catch {
      // Already disconnected.
    }
    stream.getTracks().forEach((track) => track.stop());
    void ctx.close().catch(() => undefined);
  };

  return {
    level() {
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = (buffer[i] - 128) / 128;
        sum += v * v;
      }
      return Math.min(1, Math.sqrt(sum / buffer.length) * 3.2);
    },
    async stop() {
      const rate = ctx.sampleRate;
      release();
      const seconds = (performance.now() - started) / 1000;
      const wav = encodeWav(downsample(join(chunks), rate, 16000), 16000);
      return { data: toBase64(wav), mime: 'audio/wav', seconds };
    },
    cancel: release,
  };
}

function join(chunks: Float32Array[]): Float32Array {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

function downsample(samples: Float32Array, from: number, to: number): Float32Array {
  if (from <= to) return samples;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function encodeWav(samples: Float32Array, rate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/* ---------- The model, through the app's own function ---------- */

export type VoiceFailure = 'off' | 'limit' | 'refused' | 'network' | 'unreadable';

export async function readEntries(
  sb: SupabaseClient,
  request: { lang: string; currency: string; incomeSources: string[]; audio?: Recording; text?: string },
): Promise<{ ok: true; transcript: string; drafts: VoiceDraft[] } | { ok: false; reason: VoiceFailure }> {
  const { audio, ...rest } = request;
  const { data, error } = await sb.functions.invoke('assistant', {
    body: { mode: 'entries', ...rest, audio: audio ? { data: audio.data, mime: audio.mime } : undefined },
  });
  const { status, body } = await payloadOf(data, error);
  if (status === 200 && Array.isArray(body.entries)) {
    const drafts = (body.entries as Record<string, unknown>[]).map((e): VoiceDraft => ({
      key: nextKey(),
      type: e.type === 'income' || e.type === 'transfer' ? e.type : 'expense',
      amount: roundMoney(Math.abs(Number(e.amount)) || 0),
      account: e.account === 'cash' || e.account === 'bank' ? e.account : 'unspecified',
      category: isCategoryId(e.category) ? e.category : 'other',
      source: typeof e.source === 'string' && request.incomeSources.includes(e.source) ? e.source : '',
      note: typeof e.note === 'string' ? e.note.trim() : '',
      daysAgo: Number.isInteger(e.daysAgo) ? Math.max(0, Number(e.daysAgo)) : 0,
    }));
    return { ok: true, transcript: typeof body.transcript === 'string' ? body.transcript : '', drafts: drafts.filter((d) => d.amount > 0) };
  }
  if (status === 404 || body.error === 'not_configured') return { ok: false, reason: 'off' };
  if (status === 429 && body.error === 'limit') return { ok: false, reason: 'limit' };
  if (body.error === 'refused') return { ok: false, reason: 'refused' };
  if (body.error === 'unreadable') return { ok: false, reason: 'unreadable' };
  return { ok: false, reason: 'network' };
}

/* ---------- On the device: a typed sentence, read with simple rules ---------- */

const DIGITS: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٫': '.',
  '٬': '',
};

const INCOME =
  /راتب|معاش|قبضت|استلمت|دخل|ربحت|وصلني|اجاني|إجاني|بعت|مبيع|salary|income|received|got paid|earned|sold|gehalt|lohn|einnahme|bekommen|erhalten|verkauft/i;
const TRANSFER =
  /حولت|حوّلت|نقلت|سحبت|اودعت|أودعت|ودعت|إيداع|ايداع|سحب|صراف|transfer|withdr|deposit|atm|abgehoben|eingezahlt|geldautomat|umgebucht/i;
const FROM_BANK = /سحبت|سحب|صراف|withdr|atm|abgehoben|geldautomat|من البنك|from (the )?bank|vom konto/i;
const BANK =
  /بنك|بطاق|كرت|كارت|فيزا|ماستر|اونلاين|أونلاين|باي بال|visa|master|card|bank|karte|konto|paypal|apple ?pay|google ?pay|online|überweis/i;
const CASH = /كاش|نقد|نقدي|نقدا|بالإيد|بالايد|cash|\bbar\b|bargeld/i;
const YESTERDAY = /مبارح|امبارح|إمبارح|أمس|امس|البارحة|yesterday|gestern/i;

const CATEGORY_WORDS: [CategoryId, RegExp][] = [
  [
    'dining',
    /قهو|كافي|مطعم|غدا|عشا|فطور|شاورم|فلافل|بيتزا|برغر|سندويش|كنافة|حلو|coffee|cafe|café|restaurant|lunch|dinner|breakfast|pizza|burger|kaffee|essen gehen|mittag|abendessen|döner/i,
  ],
  [
    'groceries',
    /بقال|سوبر|خضر|فواكه|لحم|دجاج|خبز|حليب|مونة|groceries|supermarket|grocery|bread|milk|lebensmittel|einkauf|rewe|aldi|lidl|edeka|netto/i,
  ],
  [
    'transport',
    /بنزين|وقود|قود|مازوت|تاكسي|تكسي|سرفيس|باص|مواصلات|قطار|ترين|اوبر|أوبر|كريم|موقف|fuel|gas|petrol|taxi|uber|bus|train|parking|ticket|tanken|benzin|bahn|fahrkarte|parken/i,
  ],
  ['shopping', /تياب|ثياب|ملابس|حذاء|صباط|جاكيت|موبايل|هدية|clothes|shoes|gift|phone|amazon|kleidung|schuhe|geschenk/i],
  ['rent', /إيجار|ايجار|أجار|اجار|rent|miete/i],
  ['bills', /كهرب|ماء|مي\b|مية|غاز|فاتورة|انترنت|إنترنت|نت\b|رصيد|electric|water|internet|phone bill|bill|strom|wasser|rechnung|handy/i],
  ['subscriptions', /اشتراك|نتفلكس|نتفليكس|سبوتيفاي|نادي|جيم|netflix|spotify|subscription|gym|abo|fitness/i],
  ['health', /صيدلي|دوا|دواء|دكتور|طبيب|مشفى|مستشفى|pharmacy|doctor|medicine|hospital|apotheke|arzt|medikament/i],
  ['maintenance', /تصليح|صيانة|صلحت|repair|fix|reparatur/i],
  ['salaries', /رواتب|أجرة العامل|wages|löhne/i],
  ['goods', /بضاعة|بضاعه|stock|ware/i],
];

/** Words that say how or when, not what: left out of the note. Whole words only. */
const FILLER = new RegExp(
  `(?<=^|\\s)(?:${[
    'euro',
    'euros',
    'eur',
    'dollar',
    'dollars',
    'usd',
    'lira',
    'dinar',
    'dirham',
    'riyal',
    'pound',
    '€',
    '\\$',
    '£',
    'for',
    'für',
    'on',
    'auf',
    'with',
    'mit',
    'the',
    'a',
    'an',
    'i',
    'ich',
    'paid',
    'spent',
    'bought',
    'bezahlt',
    'ausgegeben',
    'gekauft',
    'today',
    'heute',
    'yesterday',
    'gestern',
    'cash',
    'bar',
    'card',
    'by',
    'per',
    'karte',
    'bank',
    'in',
    'يورو',
    'اليورو',
    'دولار',
    'ليرة',
    'ليرات',
    'دينار',
    'درهم',
    'ريال',
    'جنيه',
    'دفعت',
    'صرفت',
    'اشتريت',
    'شريت',
    'حطيت',
    'عطيت',
    'على',
    'عال',
    'اليوم',
    'مبارح',
    'امبارح',
    'أمس',
    'كاش',
    'نقدي',
    'نقدا',
    'بالبطاقة',
    'بطاقة',
    'بالكرت',
    'البنك',
    'بنك',
    'من',
    'ب',
    'بـ',
    'في',
    'ع',
    'سحبت',
    'حولت',
    'حوّلت',
    'نقلت',
    'قبضت',
    'استلمت',
    'وصلني',
    'اجاني',
    'أودعت',
    'اودعت',
    'withdrew',
    'transferred',
    'received',
    'got',
    'abgehoben',
    'überwiesen',
    'bekommen',
    'erhalten',
  ].join('|')})(?=\\s|$)`,
  'gi',
);

function plainDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹٫٬]/g, (ch) => DIGITS[ch] ?? ch);
}

const NUMBER = /\d+(?:[.,]\d{1,3})?/;

/** Reads a typed sentence ("قهوة 3.5 كاش و بنزين 40 بالبطاقة") into drafts, one per amount. */
export function readLocally(text: string, incomeSources: string[]): VoiceDraft[] {
  const plain = plainDigits(text);
  const clauses = plain
    .split(/[\n،,;؛]+|\s+(?:و|and|und|then|ثم|بعدين)\s+|\s+و(?=[ء-ي]{2,})/i)
    .map((c) => c.trim())
    .filter(Boolean);
  // A clause without an amount describes its neighbour ("قهوة" then "3 يورو").
  const merged: string[] = [];
  let pending = '';
  for (const clause of clauses) {
    if (NUMBER.test(clause)) {
      merged.push(pending ? `${pending} ${clause}` : clause);
      pending = '';
    } else pending = pending ? `${pending} ${clause}` : clause;
  }
  if (pending && merged.length) merged[merged.length - 1] += ` ${pending}`;
  const yesterday = YESTERDAY.test(plain);

  return merged.flatMap((clause): VoiceDraft[] => {
    const found = clause.match(NUMBER);
    if (!found) return [];
    const amount = roundMoney(parseFloat(found[0].replace(',', '.')));
    if (!(amount > 0)) return [];
    const type: TransactionType = TRANSFER.test(clause) ? 'transfer' : INCOME.test(clause) ? 'income' : 'expense';
    let account: VoiceDraft['account'] = BANK.test(clause) ? 'bank' : CASH.test(clause) ? 'cash' : 'unspecified';
    if (type === 'transfer') account = FROM_BANK.test(clause) ? 'bank' : 'cash';
    const category = type === 'expense' ? (CATEGORY_WORDS.find(([, re]) => re.test(clause))?.[0] ?? 'other') : 'other';
    const source = type === 'income' ? (incomeSources.find((s) => clause.includes(s)) ?? '') : '';
    const note = clause.replace(found[0], ' ').replace(FILLER, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 4).join(' ');
    return [{ key: nextKey(), type, amount, account, category, source, note: note.length > 1 ? note : '', daysAgo: yesterday ? 1 : 0 }];
  });
}

/* ---------- From a reviewed draft to an entry ---------- */

export function draftAccount(d: VoiceDraft, fallback: AccountType): AccountType {
  return d.account === 'unspecified' ? fallback : d.account;
}

export function draftEntry(d: VoiceDraft, fallback: AccountType, now = new Date()): NewTransaction {
  const account = draftAccount(d, fallback);
  const note = d.note.trim();
  let timestamp: string | undefined;
  if (d.daysAgo > 0) {
    const day = new Date(now);
    day.setDate(day.getDate() - d.daysAgo);
    day.setHours(12, 0, 0, 0);
    timestamp = day.toISOString();
  }
  if (d.type === 'transfer') {
    const to: AccountType = account === 'cash' ? 'bank' : 'cash';
    return {
      amount: d.amount,
      type: 'transfer',
      account,
      toAccount: to,
      reason: note || DEFAULT_REASON[account === 'cash' ? 'cash_to_bank' : 'bank_to_cash'],
      timestamp,
      skipRules: true,
    };
  }
  if (d.type === 'income') {
    const base = d.source || DEFAULT_REASON.income;
    return {
      amount: d.amount,
      type: 'income',
      account,
      reason: d.source && note ? `${d.source} — ${note}` : note || base,
      timestamp,
      skipRules: true,
    };
  }
  const cat = categoryById(d.category);
  return { amount: d.amount, type: 'expense', account, reason: note || cat.stored, category: cat.stored, timestamp, skipRules: true };
}

export function blankDraft(): VoiceDraft {
  return { key: nextKey(), type: 'expense', amount: 0, account: 'unspecified', category: 'other', source: '', note: '', daysAgo: 0 };
}
