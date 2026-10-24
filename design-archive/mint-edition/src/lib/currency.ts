import type { Language } from '../i18n/types';

/** The wallet started as a euro app; accounts and devices without a stored choice are in euros. */
export const DEFAULT_CURRENCY = 'EUR';

/** Listed first in the picker: the euro, the dollar and the currencies of the Arabic-speaking world and its neighbours. */
export const COMMON_CURRENCIES = [
  'EUR',
  'USD',
  'IQD',
  'SYP',
  'SAR',
  'AED',
  'JOD',
  'EGP',
  'KWD',
  'QAR',
  'BHD',
  'OMR',
  'LBP',
  'YER',
  'LYD',
  'TND',
  'DZD',
  'MAD',
  'SDG',
  'TRY',
  'GBP',
  'CHF',
];

/** Used only when the browser cannot list currencies itself. */
const FALLBACK_CURRENCIES = [
  ...COMMON_CURRENCIES,
  'AFN',
  'AUD',
  'BDT',
  'BRL',
  'CAD',
  'CNY',
  'CZK',
  'DKK',
  'HUF',
  'IDR',
  'ILS',
  'INR',
  'IRR',
  'JPY',
  'KRW',
  'MRU',
  'MXN',
  'MYR',
  'NGN',
  'NOK',
  'NZD',
  'PKR',
  'PLN',
  'RON',
  'RUB',
  'SEK',
  'SGD',
  'SOS',
  'THB',
  'UAH',
  'ZAR',
];

const LOCALE: Record<Language, string> = { ar: 'ar', de: 'de', en: 'en' };

/** Every currency the browser knows (ISO 4217 codes), without duplicates. */
export function allCurrencies(): string[] {
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('currency');
    if (supported?.length) return [...new Set([...COMMON_CURRENCIES, ...supported.map((c) => c.toUpperCase())])];
  } catch {
    // older browser — fall through
  }
  return FALLBACK_CURRENCIES;
}

export function isCurrency(code: unknown): code is string {
  if (typeof code !== 'string' || !/^[A-Z]{3}$/.test(code)) return false;
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: code });
    return true;
  } catch {
    return false;
  }
}

export interface CurrencyFormat {
  code: string;
  /** What is printed next to an amount: "€", "$", "د.ع" or the code itself. */
  symbol: string;
  /** Decimals the currency normally shows: 0 for the Iraqi dinar or the yen, 3 for the Kuwaiti dinar or the Omani rial. */
  digits: number;
}

/**
 * Locales print "US$", "UK£" or "JP¥" to tell currencies apart, and "TRY" for the lira.
 * The wallet has a single currency, so the plain, familiar sign reads better.
 */
const PLAIN_SIGN: Record<string, string> = { USD: '$', GBP: '£', JPY: '¥', TRY: '₺' };

export function currencyFormat(code: string, lang: Language): CurrencyFormat {
  let symbol = code;
  let digits = 2;
  try {
    const parts = new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency: code }).formatToParts(1);
    // Arabic symbols come wrapped in direction marks, which would upset the left-to-right amount.
    symbol = (parts.find((p) => p.type === 'currency')?.value ?? code).replace(/[‎‏؜]/g, '').trim() || code;
    // "د.ع." → "د.ع": without its marks the closing dot would jump to the wrong side of a left-to-right amount.
    if (/[؀-ۿ]/.test(symbol)) symbol = symbol.replace(/\.$/, '');
    digits = Math.min(3, new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2);
  } catch {
    // unknown code: print it as it is
  }
  return { code, symbol: PLAIN_SIGN[code] ?? symbol, digits };
}

export function currencyName(code: string, lang: Language): string {
  try {
    return new Intl.DisplayNames([LOCALE[lang]], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}
