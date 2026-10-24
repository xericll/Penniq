import { Landmark, Wallet } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { haptic } from '../../lib/haptics';
import { round2 } from '../../lib/ledger';
import { useToast } from '../../state/ToastContext';
import { useWallet } from '../../state/WalletContext';
import type { AccountType } from '../../types';
import { Money } from '../ui/Money';
import { Sheet } from '../ui/Sheet';
import { parseAmount } from './EditSheet';

/* ---------- Correct one balance ---------- */

export function CorrectBalanceSheet({ account, onClose }: { account: AccountType | null; onClose: () => void }) {
  const { t, accountName, money } = useI18n();
  const { balances, setBalance } = useWallet();
  const toast = useToast();
  const [value, setValue] = useState('');
  const id = useId();
  const last = useRef<AccountType>('cash');
  if (account) last.current = account;
  const a = account ?? last.current;

  useEffect(() => {
    if (account) setValue(String(balances[account]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  const parsed = parseAmount(value);
  const valid = Number.isFinite(parsed) && parsed >= 0;
  const diff = valid ? round2(parsed - balances[a]) : 0;

  const save = () => {
    if (!valid) return;
    const d = setBalance(a, round2(parsed));
    haptic(d === 0 ? 'tap' : 'success');
    toast.show({ message: d === 0 ? t('toast.balanceSame') : t('toast.balanceSet', { account: accountName(a), amount: money(parsed) }) });
    onClose();
  };

  return (
    <Sheet
      open={account !== null}
      onClose={onClose}
      title={t('setBalance.title', { account: accountName(a) })}
      footer={
        <button
          type="submit"
          form="correct-form"
          disabled={!valid}
          className="btn-primary press min-h-[54px] w-full rounded-full text-[16px] font-semibold disabled:opacity-50"
        >
          {t('setBalance.save')}
        </button>
      }
    >
      <p className="text-[15px] leading-relaxed text-ink-2">{t('setBalance.hint')}</p>
      <form
        id="correct-form"
        onKeyDown={(e) => {
          // The submit button lives in the sheet footer, so handle Enter here.
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault();
            save();
          }
        }}
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label htmlFor={id} className="sr-only">
          {t('setBalance.title', { account: accountName(a) })}
        </label>
        <div className="relative" dir="ltr">
          <input
            id={id}
            data-autofocus
            className="field font-display min-h-16 pe-12 text-center text-[32px] tabular"
            inputMode="decimal"
            dir="ltr"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
          />
          <span className="pointer-events-none absolute end-5 top-1/2 -translate-y-1/2 text-[20px] text-accent">€</span>
        </div>
      </form>
      <dl className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="inset p-3.5">
          <dt className="eyebrow">{t('setBalance.current')}</dt>
          <dd className="mt-1">
            <Money value={balances[a]} className="text-[17px] font-semibold" />
          </dd>
        </div>
        <div className="inset p-3.5">
          <dt className="eyebrow">{t('setBalance.diff')}</dt>
          <dd className="mt-1">
            <Money value={diff} sign tone className="text-[17px] font-semibold" />
          </dd>
        </div>
      </dl>
    </Sheet>
  );
}

/* ---------- First-run opening balances ---------- */

export function OpeningSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, accountName } = useI18n();
  const { setBalance } = useWallet();
  const toast = useToast();
  const [cash, setCash] = useState('');
  const [bank, setBank] = useState('');

  useEffect(() => {
    if (open) {
      setCash('');
      setBank('');
    }
  }, [open]);

  const save = () => {
    const c = parseAmount(cash || '0');
    const b = parseAmount(bank || '0');
    if (Number.isFinite(c) && c > 0) setBalance('cash', round2(c), 'رصيد كاش افتتاحي');
    if (Number.isFinite(b) && b > 0) setBalance('bank', round2(b), 'رصيد بنكي افتتاحي');
    haptic('success');
    toast.show({ message: t('toast.saved'), tone: 'in' });
    onClose();
  };

  const field = (a: AccountType, value: string, set: (v: string) => void, first: boolean) => {
    const Icon = a === 'cash' ? Wallet : Landmark;
    const hue = a === 'cash' ? 'var(--cash)' : 'var(--bank)';
    return (
      <label className="inset flex items-center gap-3 rounded-[24px] p-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-full"
          style={{ background: `color-mix(in oklab, ${hue} 18%, transparent)`, color: hue }}
          aria-hidden
        >
          <Icon className="size-5" />
        </span>
        <span className="w-16 shrink-0 text-[15px] font-medium">{accountName(a)}</span>
        <span className="relative flex-1" dir="ltr">
          <input
            {...(first ? { 'data-autofocus': true } : {})}
            className="field font-display bg-surface pe-10 text-[22px] tabular"
            inputMode="decimal"
            dir="ltr"
            placeholder="0"
            value={value}
            onChange={(e) => set(e.target.value)}
          />
          <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-accent">€</span>
        </span>
      </label>
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('opening.title')}
      footer={
        <button type="submit" form="opening-form" className="btn-primary press min-h-[54px] w-full rounded-full text-[16px] font-semibold">
          {t('opening.save')}
        </button>
      }
    >
      <p className="text-[15px] leading-relaxed text-ink-2">{t('opening.hint')}</p>
      <form
        id="opening-form"
        onKeyDown={(e) => {
          // The submit button lives in the sheet footer, so handle Enter here.
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault();
            save();
          }
        }}
        className="mt-5 space-y-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {field('cash', cash, setCash, true)}
        {field('bank', bank, setBank, false)}
      </form>
    </Sheet>
  );
}
