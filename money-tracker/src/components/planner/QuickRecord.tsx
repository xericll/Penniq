import { Pencil, Plus, Zap } from 'lucide-react';
import { useCallback } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { categoryById } from '../../lib/categories';
import { haptic } from '../../lib/haptics';
import { recurringEntry, type Occurrence } from '../../lib/recurring';
import { templateEntry } from '../../lib/templates';
import { usePlanner } from '../../state/PlannerContext';
import { useToast } from '../../state/ToastContext';
import { useTools } from '../../state/ToolsContext';
import { useWallet } from '../../state/WalletContext';
import type { Transaction } from '../../types';
import { Money } from '../ui/Money';
import { isolate } from '../../lib/bidi';

/**
 * Records an income or expense the way every quick path does (quick buttons, recurring payments,
 * scanned receipts): a toast with Undo, and the income split offered for an income when it is on.
 */
export function useRecord() {
  const { t, money, accountName } = useI18n();
  const { add, remove } = useWallet();
  const { allocation } = usePlanner();
  const toast = useToast();
  const tools = useTools();
  return useCallback(
    (entry: Parameters<typeof add>[0], after?: (tx: Transaction) => void, onUndo?: (tx: Transaction) => void) => {
      const tx = add(entry);
      haptic('money');
      toast.show({
        message: t(tx.type === 'income' ? 'toast.income' : 'toast.expense', {
          amount: isolate(money(tx.amount)),
          account: accountName(tx.account),
        }),
        tone: tx.type === 'income' ? 'in' : 'out',
        action: {
          label: t('common.undo'),
          onAction: () => {
            remove(tx.id);
            onUndo?.(tx);
            haptic('select');
          },
        },
      });
      after?.(tx);
      if (tx.type === 'income' && allocation.enabled) window.setTimeout(() => tools.open({ name: 'split', tx }), 450);
      return tx;
    },
    [add, remove, toast, t, money, accountName, allocation.enabled, tools],
  );
}

/** One tap records the entry. Shown on Home under the expense / income buttons. */
export function TemplateRail() {
  const { t } = useI18n();
  const { templates } = usePlanner();
  const tools = useTools();
  const record = useRecord();

  return (
    <div className="no-scrollbar rail-fade -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5" role="group" aria-label={t('templates.title')}>
      {templates.map((tpl) => {
        const cat = tpl.type === 'expense' ? categoryById(tpl.category ?? 'other') : null;
        const Icon = cat?.icon ?? Zap;
        return (
          <button
            key={tpl.id}
            type="button"
            onClick={() => record(templateEntry(tpl))}
            aria-label={t('templates.recordLabel', { name: tpl.name })}
            className="chip press shrink-0 bg-surface !text-ink hover:border-foil"
          >
            <Icon className="size-4 shrink-0" style={{ color: cat?.hue ?? 'var(--in)' }} aria-hidden />
            <span className="max-w-[9rem] truncate">{tpl.name}</span>
            <Money
              value={tpl.type === 'expense' ? -tpl.amount : tpl.amount}
              sign={tpl.type === 'income'}
              className="text-[13px] text-ink-3"
            />
          </button>
        );
      })}
      <button type="button" onClick={() => tools.open({ name: 'templates' })} className="chip press shrink-0 border-dashed text-ink-3">
        {templates.length ? <Pencil className="size-3.5" aria-hidden /> : <Plus className="size-4" aria-hidden />}
        {templates.length ? t('templates.manage') : t('templates.addFirst')}
      </button>
    </div>
  );
}

/** Records one occurrence of a recurring payment and remembers which entry did it. */
export function useRecordOccurrence() {
  const record = useRecord();
  const { setRecurring } = usePlanner();
  return (o: Occurrence) =>
    record(
      recurringEntry(o.item, o.date),
      (tx) => setRecurring((list) => list.map((r) => (r.id === o.item.id ? { ...r, paid: { ...r.paid, [o.key]: tx.id } } : r))),
      () =>
        setRecurring((list) =>
          list.map((r) => {
            if (r.id !== o.item.id) return r;
            const paid = { ...r.paid };
            delete paid[o.key];
            return { ...r, paid };
          }),
        ),
    );
}
