import { memo } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { signedAmount } from '../../lib/ledger';
import type { AccountType, Transaction } from '../../types';
import { Money } from '../ui/Money';
import { TxGlyph, useDescribe } from './describe';

interface TxRowProps {
  tx: Transaction;
  onOpen: (tx: Transaction) => void;
  /** Show the amount's effect on this account (transfers become + or −). */
  account?: AccountType;
  showTime?: boolean;
}

export const TxRow = memo(function TxRow({ tx, onOpen, account, showTime = true }: TxRowProps) {
  const describe = useDescribe();
  const { timeLabel } = useI18n();
  const view = describe(tx);
  const date = new Date(tx.timestamp);
  const value = account ? signedAmount(tx, account) : tx.type === 'transfer' ? tx.amount : signedAmount(tx);

  return (
    <button
      type="button"
      onClick={() => onOpen(tx)}
      className="press group flex w-full items-center gap-3 rounded-[22px] px-2 py-2.5 text-start hover:bg-white/25 focus-visible:bg-white/25"
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
        sign={tx.type !== 'transfer' || !!account}
        tone={(tx.type !== 'transfer' || !!account) && !view.adjustment}
        className={`shrink-0 text-[15px] font-semibold ${tx.type === 'transfer' && !account ? 'text-ink-2' : ''} ${view.adjustment ? 'text-ink-2' : ''}`}
      />
    </button>
  );
});
