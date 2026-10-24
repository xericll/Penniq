/* Receipt scanning. Two separate parts, so either can be swapped:
   - a ReceiptReader turns a photo into text. The default one is Tesseract running in the browser,
     with its program and the German language data served by the app itself (public/ocr/): the photo
     never leaves the device. A vision model could be plugged in behind the same interface.
   - parseReceipt() finds the total, the shop and the date in that text. It is tuned for German
     supermarket receipts (Lidl, Aldi, Rewe, Edeka…: "Summe", "Gesamt", "zu zahlen", "EUR"). */

import type { CategoryId } from './categories';

export interface ReceiptReader {
  id: string;
  /** Text of the photo; onProgress gets 0…1 while it works. */
  read: (image: Blob, onProgress?: (share: number) => void) => Promise<string>;
}

/** Tesseract.js, loaded only when the first receipt is scanned. */
export const tesseractReader: ReceiptReader = {
  id: 'tesseract',
  async read(image, onProgress) {
    const { createWorker, OEM } = await import('tesseract.js');
    const base = new URL('ocr/', document.baseURI).href;
    const worker = await createWorker('deu', OEM.LSTM_ONLY, {
      workerPath: `${base}worker.min.js`,
      corePath: base,
      langPath: base,
      gzip: true,
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') onProgress?.(m.progress);
      },
    });
    try {
      const { data } = await worker.recognize(image);
      return data.text;
    } finally {
      await worker.terminate();
    }
  },
};

/** The single-file build (Claude artifact) ships no OCR files. */
export const OCR_AVAILABLE = import.meta.env.MODE !== 'artifact';

export interface ParsedReceipt {
  amount: number | null;
  store: string | null;
  /** "YYYY-MM-DD" */
  date: string | null;
  category: CategoryId | null;
}

const STORES: { name: string; match: RegExp; category: CategoryId }[] = [
  { name: 'Lidl', match: /\blidl\b/i, category: 'groceries' },
  { name: 'Aldi', match: /\baldi\b/i, category: 'groceries' },
  { name: 'Rewe', match: /\brewe\b/i, category: 'groceries' },
  { name: 'Edeka', match: /\bedeka\b/i, category: 'groceries' },
  { name: 'Netto', match: /\bnetto\b(?!\s*\d)/i, category: 'groceries' },
  { name: 'Penny', match: /\bpenny\b/i, category: 'groceries' },
  { name: 'Kaufland', match: /\bkaufland\b/i, category: 'groceries' },
  { name: 'Norma', match: /\bnorma\b/i, category: 'groceries' },
  { name: 'Globus', match: /\bglobus\b/i, category: 'groceries' },
  { name: 'Tegut', match: /\btegut\b/i, category: 'groceries' },
  { name: 'Marktkauf', match: /\bmarktkauf\b/i, category: 'groceries' },
  { name: 'dm', match: /\bdm[- ]?(drogerie|markt)\b/i, category: 'health' },
  { name: 'Rossmann', match: /\brossmann\b/i, category: 'health' },
  { name: 'Müller', match: /\bm[üu]ller\b/i, category: 'shopping' },
  { name: 'Apotheke', match: /\bapotheke\b/i, category: 'health' },
  { name: 'IKEA', match: /\bikea\b/i, category: 'shopping' },
  { name: 'Shell', match: /\bshell\b/i, category: 'transport' },
  { name: 'Aral', match: /\baral\b/i, category: 'transport' },
  { name: 'Esso', match: /\besso\b/i, category: 'transport' },
  { name: 'Deutsche Bahn', match: /\bdb\s?(fernverkehr|regio|vertrieb)|deutsche bahn\b/i, category: 'transport' },
  { name: "McDonald's", match: /mc\s?donald/i, category: 'dining' },
  { name: 'Burger King', match: /burger\s?king/i, category: 'dining' },
  { name: 'Starbucks', match: /starbucks/i, category: 'dining' },
];

/** "1.234,56", "12,50", "12.50", "12,50-" → a number. */
function toNumber(s: string): number | null {
  const clean = s.replace(/\s/g, '').replace(/-$/, '');
  const m = clean.match(/^(\d{1,3}(?:[.']\d{3})*|\d+)[.,](\d{2})$/);
  if (!m) return null;
  const n = Number(`${m[1].replace(/[.']/g, '')}.${m[2]}`);
  return Number.isFinite(n) ? n : null;
}

const AMOUNT = /(\d{1,3}(?:[.']\d{3})*[.,]\d{2}|\d+[.,]\d{2})(?!\d)/g;
const TOTAL_WORDS =
  /(summe|gesamt(betrag|summe)?|zu\s*zahlen|zahlbetrag|endbetrag|total|betrag\s*eur|bar\b|ec[- ]?karte|kartenzahlung|girocard)/i;
const NOT_TOTAL = /(mwst|ust|steuer|netto|brutto\s*\d|rückgeld|rueckgeld|gegeben|zwischensumme|pfand|rabatt|%)/i;

export function parseReceipt(text: string): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // The total: the amount on a "Summe / Gesamt / zu zahlen" line, the first such line wins.
  let amount: number | null = null;
  for (let i = 0; i < lines.length && amount === null; i++) {
    const line = lines[i];
    if (!TOTAL_WORDS.test(line) || NOT_TOTAL.test(line)) continue;
    const found = [...line.matchAll(AMOUNT)].map((m) => toNumber(m[1])).filter((n): n is number => n !== null);
    // "SUMME EUR" with the figure on the next line is common on narrow receipts.
    const next = found.length
      ? found
      : [...(lines[i + 1] ?? '').matchAll(AMOUNT)].map((m) => toNumber(m[1])).filter((n): n is number => n !== null);
    if (next.length) amount = next[next.length - 1];
  }
  // Otherwise the largest amount on the receipt that is not on a tax or change line.
  if (amount === null) {
    const all = lines
      .filter((l) => !NOT_TOTAL.test(l))
      .flatMap((l) => [...l.matchAll(AMOUNT)].map((m) => toNumber(m[1])))
      .filter((n): n is number => n !== null && n < 100000);
    if (all.length) amount = Math.max(...all);
  }

  // The shop: a known chain anywhere, else a heading above the first priced line that is mostly
  // letters — never an address, a phone line or an item.
  const known = STORES.find((s) => s.match.test(text));
  let store = known?.name ?? null;
  if (!store) {
    const priced = new RegExp(AMOUNT.source);
    const firstPrice = lines.findIndex((l) => priced.test(l));
    const header = lines.slice(0, firstPrice < 0 ? 4 : Math.min(firstPrice, 6));
    const head = header.find((l) => {
      const letters = (l.match(/\p{L}/gu) ?? []).length;
      return (
        letters >= 3 &&
        letters / l.length > 0.6 &&
        !/(str\.|straße|strasse|weg\b|platz\b|allee\b|\b\d{5}\b|tel|fax|www|@|gmbh\s*&|kasse|bon\b|ust|steuer)/i.test(l)
      );
    });
    store = head ? head.slice(0, 40) : null;
  }

  // The date: dd.mm.yy(yy), the first one that is a real day not in the future.
  let date: string | null = null;
  for (const m of text.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g)) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const at = new Date(y, mo - 1, d);
    if (at.getFullYear() === y && at.getMonth() === mo - 1 && at.getDate() === d && at <= new Date() && y > 2000) {
      date = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      break;
    }
  }

  return { amount, store, date, category: known?.category ?? null };
}
