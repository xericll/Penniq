import { useEffect, useState } from 'react';
import { useI18n, type MoneyOptions } from '../../i18n/LanguageContext';
import { SPLASH_MS, SPLASH_ON_LOAD } from '../../lib/boot';

interface MoneyProps extends MoneyOptions {
  value: number;
  className?: string;
  /** Colour the figure by sign (income green / expense red). */
  tone?: boolean;
}

/** Static amount. Always isolated LTR so signs and € never get re-ordered inside Arabic text. */
export function Money({ value, className = '', tone = false, ...opts }: MoneyProps) {
  const { money } = useI18n();
  const color = tone ? (value > 0 ? 'text-in' : value < 0 ? 'text-out' : '') : '';
  return (
    <span dir="ltr" className={`money tabular ${color} ${className}`}>
      {money(value, opts)}
    </span>
  );
}

interface OdometerProps {
  value: number;
  className?: string;
  /** Classes for the decimals (",40") — usually smaller and quieter. */
  decimalsClassName?: string;
  currencyClassName?: string;
  sign?: boolean;
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const BOOT = typeof performance !== 'undefined' ? performance.now() : 0;
/** Only counters that appear right after launch roll up from zero. */
const INTRO_WINDOW_MS = 3000;

/**
 * Mechanical-counter numerals: each digit is a strip that rolls to its value.
 * Rolls up from zero once at launch; respects reduced motion through CSS.
 */
export function Odometer({ value, className = '', decimalsClassName = '', currencyClassName = '', sign = false }: OdometerProps) {
  const { moneyParts, money, lang } = useI18n();
  const [ready, setReady] = useState(() => performance.now() - BOOT > INTRO_WINDOW_MS);

  useEffect(() => {
    if (ready) return;
    // Start the roll once the launch splash has lifted.
    const id = window.setTimeout(() => setReady(true), SPLASH_ON_LOAD ? SPLASH_MS - 150 : 60);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parts = moneyParts(value, { decimals: 'always', sign });
  const decimalSep = lang === 'de' ? ',' : '.';
  const [intPart, decPart = ''] = parts.number.split(decimalSep);
  const chars = intPart.split('');

  const renderChar = (ch: string, keyFromEnd: number, delayIndex: number) => {
    if (!/\d/.test(ch)) {
      return (
        <span key={`s-${keyFromEnd}`} className="inline-block">
          {ch}
        </span>
      );
    }
    const d = ready ? Number(ch) : 0;
    return (
      <span key={`d-${keyFromEnd}`} className="odo-col">
        <span className="odo-strip" style={{ transform: `translateY(-${d * 10}%)`, transitionDelay: `${delayIndex * 45}ms` }}>
          {DIGITS.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </span>
      </span>
    );
  };

  return (
    <span className={`money tabular ${className}`}>
      <span className="sr-only">{money(value, { decimals: 'always', sign })}</span>
      <span className="odo" aria-hidden>
        {parts.sign && <span>{parts.sign}</span>}
        {parts.prefix && <span className={currencyClassName}>{parts.prefix}</span>}
        {chars.map((ch, i) => renderChar(ch, chars.length - i + 2, i))}
        <span className={`odo ${decimalsClassName}`}>
          <span>{decimalSep}</span>
          {decPart.split('').map((ch, i) => renderChar(ch, -i, chars.length + i))}
        </span>
        {parts.suffix && <span className={currencyClassName}>{parts.suffix}</span>}
      </span>
    </span>
  );
}
