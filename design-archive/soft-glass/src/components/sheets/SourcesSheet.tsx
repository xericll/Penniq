import { AnimatePresence, motion } from 'motion/react';
import { Plus, RotateCcw, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { haptic } from '../../lib/haptics';
import { DEFAULT_EXPENSE_SOURCES, DEFAULT_INCOME_SOURCES } from '../../lib/sources';
import { useWallet } from '../../state/WalletContext';
import { Sheet } from '../ui/Sheet';

interface SourcesSheetProps {
  kind: 'income' | 'expense' | null;
  onClose: () => void;
}

/** Edit the preset chips offered in the composer. Changes save instantly. */
export function SourcesSheet({ kind, onClose }: SourcesSheetProps) {
  const { t, localize } = useI18n();
  const { incomeSources, expenseSources, setIncomeSources, setExpenseSources } = useWallet();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  const k = kind ?? 'income';
  const list = k === 'income' ? incomeSources : expenseSources;
  const setList = k === 'income' ? setIncomeSources : setExpenseSources;
  const defaults = k === 'income' ? DEFAULT_INCOME_SOURCES : DEFAULT_EXPENSE_SOURCES;
  const isDefault = list.length === defaults.length && list.every((s, i) => s === defaults[i]);

  useEffect(() => {
    setName('');
    setError(null);
  }, [kind]);

  const add = () => {
    const value = name.trim();
    if (!value) return setError(t('sources.errEmpty'));
    if (list.some((s) => s.toLowerCase() === value.toLowerCase() || localize(s).toLowerCase() === value.toLowerCase())) {
      return setError(t('sources.errDup'));
    }
    setList([...list, value]);
    setName('');
    setError(null);
    haptic('success');
  };

  const removeItem = (item: string) => {
    if (list.length <= 1) return setError(t('sources.errLast'));
    setList(list.filter((s) => s !== item));
    setError(null);
    haptic('tap');
  };

  return (
    <Sheet open={kind !== null} onClose={onClose} title={k === 'income' ? t('settings.incomeSources') : t('settings.expenseReasons')}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          {t('sources.placeholder')}
        </label>
        <input
          id={inputId}
          className="field flex-1"
          value={name}
          maxLength={40}
          placeholder={t('sources.placeholder')}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-err` : undefined}
        />
        <button
          type="submit"
          className="btn-primary press flex min-h-[50px] items-center gap-1.5 rounded-full px-5 text-[15px] font-semibold"
        >
          <Plus className="size-4" strokeWidth={2.5} aria-hidden />
          {t('sources.add')}
        </button>
      </form>
      {error && (
        <p id={`${inputId}-err`} role="alert" className="mt-2 text-[13px] font-medium text-out">
          {error}
        </p>
      )}

      <ul className="mt-4 flex flex-wrap gap-2">
        <AnimatePresence initial={false}>
          {list.map((item) => (
            <motion.li
              key={item}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18 }}
              className="glass-pill flex min-h-11 items-center gap-1 rounded-full ps-4 pe-1 text-[15px]"
            >
              <span>{localize(item)}</span>
              <button
                type="button"
                onClick={() => removeItem(item)}
                className="press grid size-9 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-out"
                aria-label={t('sources.remove', { name: localize(item) })}
              >
                <X className="size-4" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {!isDefault && (
        <button
          type="button"
          onClick={() => {
            setList(defaults);
            setError(null);
            haptic('select');
          }}
          className="press mt-6 flex min-h-11 items-center gap-2 rounded-xl text-[14px] font-medium text-ink-2 hover:text-ink"
        >
          <RotateCcw className="size-4" aria-hidden />
          {t('sources.restore')}
        </button>
      )}
    </Sheet>
  );
}
