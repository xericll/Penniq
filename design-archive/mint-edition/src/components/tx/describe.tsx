import { ArrowDownLeft, ArrowLeftRight, HandCoins, Scale, Vault, type LucideIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { resolveCategory } from '../../lib/categories';
import { isAdjustment, isWallet, touchesAccount } from '../../lib/ledger';
import type { Ledger, Transaction } from '../../types';

export interface TxView {
  title: string;
  /** e.g. "Bills · Cash" or "Cash → Bank" */
  meta: string;
  icon: LucideIcon;
  /** Hue for the icon tile. */
  hue: string;
  adjustment: boolean;
  categoryLabel?: string;
  /** Replaces the plain "income / expense / transfer" wording on the receipt. */
  label?: string;
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
      const to: Ledger = tx.toAccount ?? (tx.account === 'cash' ? 'bank' : 'cash');
      const route = `${accountName(tx.account)} ${arrow} ${accountName(to)}`;

      if (tx.kind === 'loan' || tx.kind === 'borrow' || tx.kind === 'repayment') {
        const person = tx.person?.trim() || t('debt.someone');
        // A debt the user owes: the borrowing itself, or a repayment that goes into the 'owed' ledger.
        const owing = tx.kind === 'borrow' || (tx.kind === 'repayment' && touchesAccount(tx, 'owed'));
        // A repayment that is not a transfer moved no money: the debt was only lowered.
        const reduction = tx.kind === 'repayment' && tx.type !== 'transfer';
        const more = (tx.kind === 'loan' || tx.kind === 'borrow') && !!tx.debtId;
        const title = reduction
          ? 'debt.tx.reduce'
          : more
            ? tx.kind === 'loan'
              ? 'debt.tx.more.loan'
              : 'debt.tx.more.borrow'
            : tx.kind === 'loan'
              ? 'debt.tx.loan'
              : tx.kind === 'borrow'
                ? 'debt.tx.borrow'
                : owing
                  ? 'debt.tx.payback'
                  : 'debt.tx.repay';
        // Which wallet account the money left or reached; none for a debt that was only noted.
        const meta = isWallet(tx.account)
          ? `${t('composer.from')} ${accountName(tx.account)}`
          : tx.type === 'transfer' && isWallet(tx.toAccount)
            ? `${t('composer.to')} ${accountName(tx.toAccount)}`
            : t('debt.sideMeta');
        return {
          title: t(title, { person }),
          meta,
          icon: HandCoins,
          hue: 'var(--foil)',
          adjustment: false,
          label: t(
            reduction
              ? 'debt.label.reduce'
              : tx.kind === 'repayment'
                ? 'debt.label.repay'
                : more
                  ? 'debt.label.more'
                  : owing
                    ? 'debt.label.borrow'
                    : 'debt.label.loan',
          ),
        };
      }
      if (tx.type === 'transfer') {
        const vault = touchesAccount(tx, 'vault');
        return {
          title,
          meta: route,
          icon: vault ? Vault : ArrowLeftRight,
          hue: vault ? 'var(--foil)' : 'var(--bank)',
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
      className="grid shrink-0 place-items-center rounded-[14px]"
      style={{
        width: size,
        height: size,
        background: `color-mix(in oklab, ${view.hue} 16%, transparent)`,
        color: `color-mix(in oklab, ${view.hue} 80%, var(--ink))`,
      }}
      aria-hidden
    >
      <Icon className="size-[20px]" strokeWidth={1.9} />
    </span>
  );
}
