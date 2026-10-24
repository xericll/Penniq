import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronLeft, Scale } from 'lucide-react';
import { useMemo, useRef, type ReactNode } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { byNewest, touchesAccount } from '../../lib/ledger';
import { useWallet } from '../../state/WalletContext';
import type { AccountType, Transaction, TransactionType } from '../../types';
import { TxRow } from '../tx/TxRow';
import { Odometer } from '../ui/Money';
import { Sheet } from '../ui/Sheet';

interface AccountSheetProps {
  account: AccountType | null;
  onClose: () => void;
  onCompose: (type: TransactionType, account: AccountType, amount?: number) => void;
  onCorrect: (account: AccountType) => void;
  onOpenTx: (tx: Transaction) => void;
  onSeeAll: (account: AccountType) => void;
}

export function AccountSheet({ account, onClose, onCompose, onCorrect, onOpenTx, onSeeAll }: AccountSheetProps) {
  const { t, accountName, money } = useI18n();
  const { balances, transactions, quickAmounts } = useWallet();
  // Keep the last account while the sheet animates out.
  const last = useRef<AccountType>('cash');
  if (account) last.current = account;
  const a = account ?? last.current;
  const recent = useMemo(
    () =>
      transactions
        .filter((tx) => touchesAccount(tx, a))
        .sort(byNewest)
        .slice(0, 6),
    [transactions, a],
  );
  const hue = a === 'cash' ? 'var(--cash)' : 'var(--bank)';

  return (
    <Sheet open={account !== null} onClose={onClose} eyebrow={t('account.current')} title={accountName(a)}>
      <div className="relative -mt-1 pb-5">
        <Odometer
          value={balances[a]}
          className="font-display text-[44px] leading-tight font-light"
          decimalsClassName="text-[0.5em] text-ink-3"
          currencyClassName="text-[0.55em] mx-1"
        />
        <span className="absolute bottom-3 h-0.5 w-12 rounded-full start-0" style={{ background: hue }} aria-hidden />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SheetAction
          label={t('common.income')}
          hue="var(--in)"
          icon={<ArrowDownLeft className="size-5" />}
          onClick={() => onCompose('income', a)}
        />
        <SheetAction
          label={t('common.expense')}
          hue="var(--out)"
          icon={<ArrowUpRight className="size-5" />}
          onClick={() => onCompose('expense', a)}
        />
        <SheetAction
          label={t('common.transfer')}
          hue="var(--bank)"
          icon={<ArrowLeftRight className="size-5" />}
          onClick={() => onCompose('transfer', a)}
        />
      </div>

      <h3 className="eyebrow mt-6 mb-2">{t('account.quick')}</h3>
      <div className="grid grid-cols-4 gap-2">
        {quickAmounts[a].map((q) => (
          <button
            key={`+${q}`}
            type="button"
            onClick={() => onCompose('income', a, q)}
            className="press min-h-11 rounded-xl border border-line text-[14px] font-semibold text-in hover:border-line-strong"
          >
            <span dir="ltr" className="tabular">
              +{money(q)}
            </span>
          </button>
        ))}
        {quickAmounts[a].map((q) => (
          <button
            key={`-${q}`}
            type="button"
            onClick={() => onCompose('expense', a, q)}
            className="press min-h-11 rounded-xl border border-line text-[14px] font-semibold text-out hover:border-line-strong"
          >
            <span dir="ltr" className="tabular">
              −{money(q)}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onCorrect(a)}
        className="press mt-3 flex min-h-12 w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 text-start text-[15px] font-medium hover:bg-surface-2/70"
      >
        <Scale className="size-[18px] text-ink-2" aria-hidden />
        <span className="flex-1">{t('account.correct')}</span>
        <ChevronLeft className="size-4 text-ink-3 ltr:rotate-180" aria-hidden />
      </button>

      <div className="mt-6 mb-1 flex items-center justify-between">
        <h3 className="eyebrow">{t('account.activity')}</h3>
        {recent.length > 0 && (
          <button
            type="button"
            onClick={() => onSeeAll(a)}
            className="press -me-2 flex min-h-11 items-center gap-1 rounded-xl px-2 text-[14px] font-medium text-foil"
          >
            {t('common.seeAll')}
            <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden />
          </button>
        )}
      </div>
      {recent.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-ink-3">{t('account.none')}</p>
      ) : (
        <div className="-mx-2">
          {recent.map((tx) => (
            <TxRow key={tx.id} tx={tx} onOpen={onOpenTx} account={a} />
          ))}
        </div>
      )}
    </Sheet>
  );
}

function SheetAction({ label, hue, icon, onClick }: { label: string; hue: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-line hover:border-line-strong"
    >
      <span
        className="grid size-9 place-items-center rounded-full"
        style={{ background: `color-mix(in oklab, ${hue} 18%, transparent)`, color: `color-mix(in oklab, ${hue} 85%, var(--ink))` }}
        aria-hidden
      >
        {icon}
      </span>
      <span className="text-[14px] font-medium">{label}</span>
    </button>
  );
}
