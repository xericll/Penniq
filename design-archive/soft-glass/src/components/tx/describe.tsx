import { ArrowDownLeft, ArrowLeftRight, Scale, type LucideIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { resolveCategory } from '../../lib/categories';
import { isAdjustment } from '../../lib/ledger';
import type { AccountType, Transaction } from '../../types';

export interface TxView {
  title: string;
  /** e.g. "Bills · Cash" or "Cash → Bank" */
  meta: string;
  icon: LucideIcon;
  /** Hue for the icon tile. */
  hue: string;
  adjustment: boolean;
  categoryLabel?: string;
}

/** One place that decides how any transaction is named, coloured and iconised. */
export function useDescribe() {
  const { t, localize, accountName, dir } = useI18n();
  const arrow = dir === 'rtl' ? '←' : '→';

  return useCallback(
    (tx: Transaction): TxView => {
      const adjustment = isAdjustment(tx);
      const title =
        localize(tx.reason) || t(tx.type === 'income' ? 'common.income' : tx.type === 'expense' ? 'common.expense' : 'common.transfer');

      if (tx.type === 'transfer') {
        const to: AccountType = tx.toAccount ?? (tx.account === 'cash' ? 'bank' : 'cash');
        return {
          title,
          meta: `${accountName(tx.account)} ${arrow} ${accountName(to)}`,
          icon: ArrowLeftRight,
          hue: 'var(--bank)',
          adjustment: false,
        };
      }
      if (adjustment) {
        return { title, meta: `${t('receipt.correction')} · ${accountName(tx.account)}`, icon: Scale, hue: 'var(--ink-3)', adjustment };
      }
      if (tx.type === 'income') {
        return { title, meta: `${t('common.income')} · ${accountName(tx.account)}`, icon: ArrowDownLeft, hue: 'var(--in)', adjustment };
      }
      const cat = resolveCategory(tx.category);
      const categoryLabel = t(cat.labelKey);
      return {
        title,
        meta: title === categoryLabel ? accountName(tx.account) : `${categoryLabel} · ${accountName(tx.account)}`,
        icon: cat.icon,
        hue: cat.hue,
        adjustment,
        categoryLabel,
      };
    },
    [t, localize, accountName, arrow],
  );
}

export function TxGlyph({ view, size = 44 }: { view: TxView; size?: number }) {
  const Icon = view.icon;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `color-mix(in oklab, ${view.hue} 17%, var(--glass-top))`,
        color: `color-mix(in oklab, ${view.hue} 80%, var(--ink))`,
        boxShadow: 'inset 0 1px 0 var(--rim-strong), 0 4px 10px -6px rgb(var(--shadow) / 0.35)',
      }}
      aria-hidden
    >
      <Icon className="size-[20px]" strokeWidth={1.9} />
    </span>
  );
}
