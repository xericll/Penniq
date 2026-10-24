import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_CURRENCY, currencyFormat, isCurrency } from '../lib/currency';
import { setMoneyPlaces } from '../lib/ledger';
import { KEYS, read, write } from '../lib/storage';
import type { Ledger } from '../types';
import { PHRASES, translations, type TranslationKey } from './translations';
import { LANGUAGES, type Language, type LanguageInfo } from './types';

export interface MoneyOptions {
  /** Prefix "+" for positive values (negatives always get a true minus sign). */
  sign?: boolean;
  /** 'auto' hides ",00" on whole numbers; 'always' keeps the currency's decimals. */
  decimals?: 'auto' | 'always';
}

export interface MoneyParts {
  sign: string;
  prefix: string;
  number: string;
  suffix: string;
}

interface LanguageContextValue {
  lang: Language;
  info: LanguageInfo;
  dir: 'rtl' | 'ltr';
  setLang: (lang: Language) => void;
  /** ISO code of the one currency the wallet is shown in. */
  currency: string;
  /** What is printed next to amounts: "€", "$", "د.ع"… */
  currencySymbol: string;
  /** English puts the symbol before the number; Arabic and German after it. */
  symbolFirst: boolean;
  /** Changes the currency on this device only — use the wallet's setCurrency so the account follows. */
  setCurrency: (code: string) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  money: (amount: number, opts?: MoneyOptions) => string;
  moneyParts: (amount: number, opts?: MoneyOptions) => MoneyParts;
  localize: (text: string) => string;
  accountName: (account: Ledger) => string;
  dayLabel: (date: Date) => string;
  timeLabel: (date: Date) => string;
  dateLabel: (date: Date) => string;
  monthLabel: (date: Date) => string;
  weekdayShort: (date: Date) => string;
}

const MINUS = '−';
const NBSP = ' ';
const AR_WEEKDAYS_SHORT = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

function detectLanguage(): Language {
  const saved = read(KEYS.language);
  if (saved === 'ar' || saved === 'de' || saved === 'en') return saved;
  const nav = (typeof navigator !== 'undefined' ? navigator.language : '').toLowerCase();
  if (nav.startsWith('de')) return 'de';
  if (nav.startsWith('en')) return 'en';
  return 'ar';
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(detectLanguage);
  const info = LANGUAGES[lang];
  const [currency, setCurrencyState] = useState(() => {
    const saved = read(KEYS.currency);
    return isCurrency(saved) ? saved : DEFAULT_CURRENCY;
  });
  const format = useMemo(() => currencyFormat(currency, lang), [currency, lang]);
  const symbolFirst = lang === 'en';
  // Two places for most currencies (also for those that usually show none), three for the dinars and the Omani rial.
  const places = Math.max(2, format.digits);
  // Set while rendering, before any child adds up balances with the new precision.
  setMoneyPlaces(places);

  const setCurrency = useCallback((code: string) => {
    const next = isCurrency(code) ? code : DEFAULT_CURRENCY;
    setCurrencyState(next);
    write(KEYS.currency, next);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = info.dir;
  }, [lang, info.dir]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    write(KEYS.language, next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      let text = translations[lang][key] ?? translations.ar[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
      }
      return text;
    },
    [lang],
  );

  const numberFormat = useMemo(() => {
    const locale = lang === 'de' ? 'de-DE' : 'en-US';
    return {
      auto: new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: places }),
      // A currency without decimals (Iraqi dinar, yen) never gets ".00"; entered cents are still shown.
      always: new Intl.NumberFormat(locale, { minimumFractionDigits: format.digits, maximumFractionDigits: places }),
    };
  }, [lang, format.digits, places]);

  const moneyParts = useCallback(
    (amount: number, opts: MoneyOptions = {}): MoneyParts => {
      const factor = 10 ** places;
      // Less than half of the smallest unit is nothing: never "−0".
      const value = Math.abs(amount) * factor < 0.5 ? 0 : amount;
      const abs = Math.abs(value);
      const fmt =
        opts.decimals === 'always' || !Number.isInteger(Math.round(abs * factor) / factor) ? numberFormat.always : numberFormat.auto;
      const number = fmt.format(abs);
      const sign = value < 0 ? MINUS : opts.sign && value > 0 ? '+' : '';
      // "$12" and "€12", but "IQD 12": a symbol that ends in a letter needs a space.
      const gap = /\p{L}$/u.test(format.symbol) ? NBSP : '';
      return symbolFirst
        ? { sign, prefix: `${format.symbol}${gap}`, number, suffix: '' }
        : { sign, prefix: '', number, suffix: `${NBSP}${format.symbol}` };
    },
    [symbolFirst, format.symbol, numberFormat, places],
  );

  const money = useCallback(
    (amount: number, opts?: MoneyOptions) => {
      const p = moneyParts(amount, opts);
      return `${p.sign}${p.prefix}${p.number}${p.suffix}`;
    },
    [moneyParts],
  );

  const localize = useCallback(
    (text: string) => {
      if (lang === 'ar' || !text) return text;
      // Reasons may combine a preset and a note: "preset — note".
      return text
        .split(' — ')
        .map((part) => PHRASES[part.trim()]?.[lang] ?? part)
        .join(' — ');
    },
    [lang],
  );

  const accountName = useCallback((a: Ledger) => t(`common.${a}`), [t]);

  const formatters = useMemo(() => {
    const loc = info.dateLocale;
    return {
      day: new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }),
      dayWithYear: new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      time: new Intl.DateTimeFormat(loc, { hour: 'numeric', minute: '2-digit' }),
      date: new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric' }),
      month: new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }),
      weekday: new Intl.DateTimeFormat(loc, { weekday: 'short' }),
    };
  }, [info.dateLocale]);

  const dayLabel = useCallback(
    (date: Date) => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const diff = Math.round((today - target) / 86_400_000);
      if (diff === 0) return t('day.today');
      if (diff === 1) return t('day.yesterday');
      return (date.getFullYear() === now.getFullYear() ? formatters.day : formatters.dayWithYear).format(date);
    },
    [formatters, t],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      info,
      dir: info.dir,
      setLang,
      currency,
      currencySymbol: format.symbol,
      symbolFirst,
      setCurrency,
      t,
      money,
      moneyParts,
      localize,
      accountName,
      dayLabel,
      timeLabel: (d) => formatters.time.format(d),
      dateLabel: (d) => formatters.date.format(d),
      monthLabel: (d) => formatters.month.format(d),
      weekdayShort: (d) => (lang === 'ar' ? AR_WEEKDAYS_SHORT[d.getDay()] : formatters.weekday.format(d)),
    }),
    [
      lang,
      info,
      setLang,
      currency,
      format.symbol,
      symbolFirst,
      setCurrency,
      t,
      money,
      moneyParts,
      localize,
      accountName,
      dayLabel,
      formatters,
    ],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useI18n must be used inside <LanguageProvider>');
  return ctx;
}
