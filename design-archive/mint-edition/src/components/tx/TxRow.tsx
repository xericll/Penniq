import { memo } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { leavesWallet, signedAmount, walletEffect } from '../../lib/ledger';
import type { Ledger, Transaction } from '../../types';
import { Money } from '../ui/Money';
import { TxGlyph, useDescribe } from './describe';

interface TxRowProps {
  tx: Transaction;
  onOpen: (tx: Transaction) => void;
  /** Show the amount's effect on this account (transfers become + or −). */
  account?: Ledger;
  showTime?: boolean;
}

export const TxRow = memo(function TxRow({ tx, onOpen, account, showTime = true }: TxRowProps) {
  const describe = useDescribe();
  const { timeLabel } = useI18n();
  const view = describe(tx);
  const date = new Date(tx.timestamp);
  // Without an account in focus: moves inside the wallet, and entries that never touch it
  // (a loan noted on the side, a vault correction), are shown as a plain amount.
  const effect = leavesWallet(tx) ? walletEffect(tx) : tx.type === 'transfer' ? 0 : signedAmount(tx);
  const plain = !account && effect === 0;
  const value = account ? signedAmount(tx, account) : plain ? tx.amount : effect;

  return (
    <button
      type="button"
      onClick={() => onOpen(tx)}
      className="press group flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-start hover:bg-surface-2/70 focus-visible:bg-surface-2"
    >
      <TxGlyph view={view} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] leading-snug font-medium text-ink">{view.title}</span>
        <span className="mt-0.5 block truncate text-[13px] leading-snug text-ink-3">
          {view.meta}
          {showTime && !Number.isNaN(date.getTime()) && <> · {timeLabel(date)}</>}
        </span>
      </span>
      <Money
        value={value}
        sign={!plain}
        tone={!plain && !view.adjustment}
        className={`shrink-0 text-[15px] font-semibold ${plain || view.adjustment ? 'text-ink-2' : ''}`}
      />
    </button>
  );
});
