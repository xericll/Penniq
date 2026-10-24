import { Check, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { COMMON_CURRENCIES, allCurrencies, currencyFormat, currencyName } from '../../lib/currency';
import { haptic } from '../../lib/haptics';
import { useToast } from '../../state/ToastContext';
import { useWallet } from '../../state/WalletContext';
import { Sheet } from '../ui/Sheet';

/** Pick the one currency the whole wallet is shown in. */
export function CurrencySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, currency } = useI18n();
  const { setCurrency } = useWallet();
  const toast = useToast();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  // Built only while the sheet is open: naming ~160 currencies is not free.
  const list = useMemo(() => {
    if (!open) return [];
    const common = new Set(COMMON_CURRENCIES);
    const describe = (code: string) => ({ code, name: currencyName(code, lang), symbol: currencyFormat(code, lang).symbol });
    const rest = allCurrencies()
      .filter((code) => !common.has(code))
      .map(describe)
      .sort((a, b) => a.name.localeCompare(b.name, lang));
    return [...COMMON_CURRENCIES.map(describe), ...rest];
  }, [open, lang]);

  const q = query.trim().toLowerCase();
  const shown = q
    ? list.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q))
    : list;

  const choose = (code: string) => {
    if (code !== currency) {
      setCurrency(code);
      haptic('success');
      toast.show({ message: t('currency.changed', { name: currencyName(code, lang) }) });
    }
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('currency.title')}>
      <p className="text-[14px] leading-relaxed text-ink-2">{t('currency.note')}</p>

      <label className="relative mt-4 block">
        <span className="sr-only">{t('currency.search')}</span>
        <Search className="pointer-events-none absolute start-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('currency.search')}
          className="field ps-11 pe-11 [&::-webkit-search-cancel-button]:hidden"
          enterKeyHint="search"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="press absolute end-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:text-ink"
            aria-label={t('activity.clearSearch')}
          >
            <X className="size-4" />
          </button>
        )}
      </label>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-ink-3">{t('currency.none')}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line" role="listbox" aria-label={t('currency.title')}>
          {shown.map((c) => {
            const active = c.code === currency;
            return (
              <li key={c.code} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => choose(c.code)}
                  className="press flex min-h-14 w-full items-center gap-3 rounded-xl px-1 py-2 text-start hover:bg-surface-2/60"
                >
                  <span
                    className={`grid h-10 min-w-12 shrink-0 place-items-center rounded-xl px-2 text-[14px] font-semibold ${
                      active ? 'foil' : 'bg-surface-2 text-ink-2'
                    }`}
                    dir="ltr"
                    aria-hidden
                  >
                    {c.symbol}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] ${active ? 'font-semibold' : 'font-medium'}`}>{c.name}</span>
                    <span className="serial block text-ink-3">
                      <bdi>{c.code}</bdi>
                    </span>
                  </span>
                  {active && <Check className="size-5 shrink-0 text-foil" strokeWidth={2.5} aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
