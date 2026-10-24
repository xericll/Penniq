import { ArrowDownToLine, ArrowUpFromLine, ChevronLeft, Scale, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { haptic } from '../../lib/haptics';
import { byNewest, roundMoney, touchesAccount } from '../../lib/ledger';
import { useToast } from '../../state/ToastContext';
import { useWallet } from '../../state/WalletContext';
import type { AccountType, Ledger, Transaction } from '../../types';
import { TxRow } from '../tx/TxRow';
import { AmountField } from '../ui/AmountField';
import { Money, Odometer } from '../ui/Money';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { CorrectBalanceSheet } from './BalanceSheets';
import { parseAmount } from './EditSheet';

type Direction = 'in' | 'out';

/* ---------- The vault: money kept aside ---------- */

export function VaultSheet({ open, onClose, onOpenTx }: { open: boolean; onClose: () => void; onOpenTx: (tx: Transaction) => void }) {
  const { t } = useI18n();
  const { balances, transactions } = useWallet();
  const [moving, setMoving] = useState<Direction | null>(null);
  const [setting, setSetting] = useState(false);
  const recent = useMemo(
    () =>
      transactions
        .filter((tx) => touchesAccount(tx, 'vault'))
        .sort(byNewest)
        .slice(0, 8),
    [transactions],
  );
  const untouched = recent.length === 0;

  return (
    <Sheet open={open} onClose={onClose} eyebrow={t('vault.eyebrow')} title={t('common.vault')}>
      <div className="relative -mt-1 pb-5">
        <Odometer
          value={balances.vault}
          className="font-display text-[44px] leading-tight font-light"
          decimalsClassName="text-[0.5em] text-ink-3"
          currencyClassName="text-[0.55em] mx-1"
        />
        <span className="absolute bottom-3 h-0.5 w-12 rounded-full bg-foil start-0" aria-hidden />
      </div>

      {untouched && <p className="mb-4 text-[15px] leading-relaxed text-ink-2">{t('vault.intro')}</p>}

      <div className="grid grid-cols-2 gap-2">
        <VaultAction icon={ArrowDownToLine} label={t('vault.deposit')} onClick={() => setMoving('in')} />
        <VaultAction icon={ArrowUpFromLine} label={t('vault.withdraw')} onClick={() => setMoving('out')} disabled={balances.vault <= 0} />
      </div>

      <button
        type="button"
        onClick={() => setSetting(true)}
        className={`press mt-2 flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 text-start ${
          untouched ? 'foil' : 'bg-surface-2 hover:bg-surface-2/70'
        }`}
      >
        <Scale className={`size-[18px] shrink-0 ${untouched ? '' : 'text-ink-2'}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{t('vault.set')}</span>
          <span className={`block text-[13px] ${untouched ? 'opacity-80' : 'text-ink-3'}`}>{t('vault.setHint')}</span>
        </span>
        <ChevronLeft className={`size-4 shrink-0 ltr:rotate-180 ${untouched ? '' : 'text-ink-3'}`} aria-hidden />
      </button>

      <dl className="mt-5 space-y-2.5 rounded-2xl bg-surface-2 p-4 text-[15px]">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-2">{t('vault.wallet')}</dt>
          <dd>
            <Money value={balances.total} className="font-medium" />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-2">{t('common.vault')}</dt>
          <dd>
            <Money value={balances.vault} className="font-medium" />
          </dd>
        </div>
        <div className="dashed-rule" />
        <div className="flex items-baseline justify-between gap-4">
          <dt className="font-semibold">{t('reserves.wealth')}</dt>
          <dd>
            <Money value={roundMoney(balances.total + balances.vault)} className="font-display text-[19px]" />
          </dd>
        </div>
      </dl>

      <h3 className="eyebrow mt-6 mb-1">{t('vault.activity')}</h3>
      {untouched ? (
        <p className="py-5 text-center text-[14px] text-ink-3">{t('vault.none')}</p>
      ) : (
        <div className="-mx-2">
          {recent.map((tx) => (
            <TxRow key={tx.id} tx={tx} onOpen={onOpenTx} account="vault" />
          ))}
        </div>
      )}

      <MoveSheet direction={moving} onClose={() => setMoving(null)} />
      <CorrectBalanceSheet account={setting ? 'vault' : null} onClose={() => setSetting(false)} />
    </Sheet>
  );
}

function VaultAction({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="press flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-line px-2 text-center hover:border-line-strong disabled:opacity-40"
    >
      <span
        className="grid size-9 place-items-center rounded-full text-foil"
        style={{ background: 'color-mix(in oklab, var(--foil) 16%, transparent)' }}
        aria-hidden
      >
        <Icon className="size-5" />
      </span>
      <span className="text-[14px] leading-tight font-medium">{label}</span>
    </button>
  );
}

/* ---------- Move money between the wallet and the vault ---------- */

function MoveSheet({ direction, onClose }: { direction: Direction | null; onClose: () => void }) {
  const { t, accountName, money } = useI18n();
  const { balances, add, remove } = useWallet();
  const toast = useToast();
  const [dir, setDir] = useState<Direction>('in');
  const [account, setAccount] = useState<AccountType>('cash');
  const [raw, setRaw] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!direction) return;
    setDir(direction);
    setRaw('');
    setTried(false);
    // Start from the account that actually has money in it.
    if (direction === 'in') setAccount(balances.cash <= 0 && balances.bank > 0 ? 'bank' : 'cash');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  const source: Ledger = dir === 'in' ? account : 'vault';
  const target: Ledger = dir === 'in' ? 'vault' : account;
  const available = Math.max(0, balances[source]);
  const amount = roundMoney(parseAmount(raw) || 0);
  const over = amount > available + 0.001;
  const error = over
    ? t('composer.over', { account: accountName(source), amount: money(available) })
    : tried && amount <= 0
      ? t('edit.errAmount')
      : undefined;

  const submit = () => {
    setTried(true);
    if (amount <= 0 || over) return haptic('warning');
    const tx = add({
      amount,
      type: 'transfer',
      account: source,
      toAccount: target,
      reason: dir === 'in' ? 'إيداع في الخزنة' : 'سحب من الخزنة',
    });
    haptic('money');
    toast.show({
      message:
        dir === 'in'
          ? t('vault.toast.in', { amount: money(amount) })
          : t('vault.toast.out', { amount: money(amount), account: accountName(account) }),
      tone: 'neutral',
      action: { label: t('common.undo'), onAction: () => remove(tx.id) },
    });
    onClose();
  };

  return (
    <Sheet
      open={direction !== null}
      onClose={onClose}
      title={t(dir === 'in' ? 'vault.deposit' : 'vault.withdraw')}
      footer={
        <button type="submit" form="move-form" className="foil press min-h-13 w-full rounded-2xl text-[16px] font-semibold">
          {t(dir === 'in' ? 'move.submit.in' : 'move.submit.out')}
        </button>
      }
    >
      <form
        id="move-form"
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Segmented
          label={t('common.vault')}
          value={dir}
          onChange={(d: Direction) => setDir(d)}
          options={[
            { value: 'in', label: t('vault.deposit'), icon: <ArrowDownToLine className="size-4" aria-hidden /> },
            { value: 'out', label: t('vault.withdraw'), icon: <ArrowUpFromLine className="size-4" aria-hidden /> },
          ]}
        />

        <div>
          <span className="eyebrow mb-2 block">{t(dir === 'in' ? 'composer.from' : 'composer.to')}</span>
          <Segmented
            label={t('composer.account')}
            value={account}
            onChange={(a: AccountType) => setAccount(a)}
            options={[
              { value: 'cash', label: accountName('cash') },
              { value: 'bank', label: accountName('bank') },
            ]}
          />
        </div>

        <AmountField
          label={t('composer.amount')}
          value={raw}
          onChange={setRaw}
          autoFocus
          error={error}
          hint={
            <span className="flex items-center justify-between gap-3">
              <span>
                {t('move.available', { account: accountName(source) })} <Money value={available} className="font-medium text-ink-2" />
              </span>
              {available > 0 && (
                <button type="button" className="font-medium text-foil hover:underline" onClick={() => setRaw(String(available))}>
                  {t('composer.all')}
                </button>
              )}
            </span>
          }
        />
      </form>
    </Sheet>
  );
}
