import { Check, ChevronDown, HandCoins, Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { haptic } from '../../lib/haptics';
import { debtsOf, roundMoney, type Debt } from '../../lib/ledger';
import { useToast } from '../../state/ToastContext';
import { useWallet, type NewTransaction } from '../../state/WalletContext';
import type { AccountType } from '../../types';
import { AmountField } from '../ui/AmountField';
import { Guilloche } from '../ui/Engraving';
import { Money, Odometer } from '../ui/Money';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { parseAmount } from './EditSheet';

/** 'lent' — people owe the user; 'borrowed' — the user owes people. */
type Side = Debt['side'];

/* ---------- Debts in both directions ---------- */

export function DebtsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, dateLabel } = useI18n();
  const { transactions, removeMany, restore } = useWallet();
  const toast = useToast();
  const [side, setSide] = useState<Side>('lent');
  const all = useMemo(() => debtsOf(transactions), [transactions]);
  const debts = all.filter((d) => d.side === side);
  const active = debts.filter((d) => d.remaining > 0);
  const settled = debts.filter((d) => d.remaining === 0);
  const total = roundMoney(active.reduce((sum, d) => sum + d.remaining, 0));
  const lent = side === 'lent';

  const [creating, setCreating] = useState(false);
  const [repaying, setRepaying] = useState<Debt | null>(null);
  const [raising, setRaising] = useState<Debt | null>(null);
  const [showSettled, setShowSettled] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!open) setConfirming(null);
    return () => window.clearTimeout(timer.current);
  }, [open]);

  const onDelete = (debt: Debt) => {
    if (confirming !== debt.id) {
      haptic('warning');
      setConfirming(debt.id);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setConfirming(null), 4000);
      return;
    }
    const removed = removeMany([debt.id, ...debt.increases.map((r) => r.id), ...debt.repayments.map((r) => r.id)]);
    setConfirming(null);
    haptic('money');
    toast.show({ message: t('debt.toast.deleted'), action: { label: t('common.undo'), onAction: () => restore(removed) } });
  };

  const deleteHint = t(lent ? 'debt.deleteHint' : 'debt.deleteHint.borrowed');

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('debt.title')}
      footer={
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="foil press flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold"
        >
          <Plus className="size-5" aria-hidden />
          {t('debt.new')}
        </button>
      }
    >
      <Segmented
        label={t('debt.title')}
        value={side}
        onChange={(s: Side) => {
          setSide(s);
          setConfirming(null);
          setShowSettled(false);
        }}
        options={[
          { value: 'lent', label: t('debt.side.lent'), tone: 'var(--in)' },
          { value: 'borrowed', label: t('debt.side.borrowed'), tone: 'var(--out)' },
        ]}
        size="lg"
      />

      <div className="relative mt-4 pb-5">
        <Odometer
          value={total}
          className="font-display text-[44px] leading-tight font-light"
          decimalsClassName="text-[0.5em] text-ink-3"
          currencyClassName="text-[0.55em] mx-1"
        />
        <span
          className="absolute bottom-3 h-0.5 w-12 rounded-full start-0"
          style={{ background: lent ? 'var(--in)' : 'var(--out)' }}
          aria-hidden
        />
      </div>

      {debts.length === 0 ? (
        <div className="flex flex-col items-center px-4 pt-2 pb-6 text-center">
          <Guilloche className="size-20 text-foil opacity-50" density="light" />
          <h3 className="mt-2 text-[17px] font-semibold">{t('debt.empty.title')}</h3>
          <p className="mt-1 max-w-xs text-[15px] leading-relaxed text-ink-2">{t(lent ? 'debt.intro' : 'debt.intro.borrowed')}</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {active.map((d) => {
            const pct = d.amount > 0 ? Math.min(1, d.repaid / d.amount) : 0;
            const asking = confirming === d.id;
            return (
              <li key={d.id} className="rounded-2xl bg-surface-2 p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold">{d.person || t('debt.someone')}</p>
                    <p className="mt-0.5 truncate text-[13px] text-ink-3">
                      {dateLabel(new Date(d.loan.timestamp))}
                      {d.note && <> · {d.note}</>}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <Money value={d.remaining} className="font-display block text-[22px] leading-none" />
                    {(d.repaid > 0 || d.increases.length > 0) && (
                      <span className="mt-1 block text-[12px] text-ink-3">
                        {t('debt.of')} <Money value={d.amount} />
                      </span>
                    )}
                  </div>
                </div>

                {(d.repaid > 0 || d.increases.length > 0) && (
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface" aria-hidden>
                    <div className="h-full rounded-full bg-in transition-[width] duration-700" style={{ width: `${pct * 100}%` }} />
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRepaying(d)}
                    className="press flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-ink text-[14px] font-semibold text-bg"
                  >
                    <HandCoins className="size-4" aria-hidden />
                    {t('debt.repay')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRaising(d)}
                    className="press flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-[14px] font-semibold"
                    style={{ boxShadow: 'inset 0 0 0 1px var(--line-strong)' }}
                  >
                    <Plus className="size-4" aria-hidden />
                    {t('debt.more')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(d)}
                    aria-label={`${t('common.delete')}: ${d.person}`}
                    className={`press flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-[14px] font-semibold transition-colors ${
                      asking ? 'bg-out text-bg' : 'text-out hover:bg-out/10'
                    }`}
                    style={asking ? undefined : { boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--out) 40%, transparent)' }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {asking && t('receipt.confirmDelete')}
                  </button>
                </div>
                {asking && (
                  <p role="alert" className="mt-2 text-[13px] leading-snug text-ink-3">
                    {deleteHint}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {settled.length > 0 && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowSettled((v) => !v)}
            aria-expanded={showSettled}
            className="press flex min-h-11 w-full items-center gap-2 text-[14px] font-medium text-ink-2"
          >
            <ChevronDown className={`size-4 transition-transform ${showSettled ? 'rotate-180' : ''}`} aria-hidden />
            {t('debt.settledCount', { count: settled.length })}
          </button>
          {showSettled && (
            <ul className="divide-y divide-line">
              {settled.map((d) => {
                const asking = confirming === d.id;
                return (
                  <li key={d.id} className="py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-in/15 text-in" aria-hidden>
                        <Check className="size-4" strokeWidth={2.5} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{d.person || t('debt.someone')}</span>
                        <span className="block truncate text-[13px] text-ink-3">{dateLabel(new Date(d.loan.timestamp))}</span>
                      </span>
                      <Money value={d.amount} className="shrink-0 text-[15px] text-ink-2" />
                      <button
                        type="button"
                        onClick={() => onDelete(d)}
                        aria-label={`${t('common.delete')}: ${d.person}`}
                        className={`press grid size-10 shrink-0 place-items-center rounded-xl ${asking ? 'bg-out text-bg' : 'text-ink-3 hover:text-out'}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                    {asking && (
                      <p role="alert" className="mt-1.5 text-[13px] leading-snug text-ink-3">
                        {deleteHint}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <NewDebtSheet open={creating} side={side} onClose={() => setCreating(false)} />
      <RepaySheet debt={repaying} onClose={() => setRepaying(null)} />
      <RaiseSheet debt={raising} onClose={() => setRaising(null)} />
    </Sheet>
  );
}

/* ---------- Note a new debt ---------- */

type Source = 'none' | AccountType;

function NewDebtSheet({ open, side, onClose }: { open: boolean; side: Side; onClose: () => void }) {
  const { t, accountName, money } = useI18n();
  const { add, remove } = useWallet();
  const toast = useToast();
  const [person, setPerson] = useState('');
  const [raw, setRaw] = useState('');
  const [note, setNote] = useState('');
  const [source, setSource] = useState<Source>('none');
  const [tried, setTried] = useState(false);
  const personRef = useRef<HTMLInputElement>(null);
  const ids = { person: useId(), note: useId() };
  const lent = side === 'lent';

  useEffect(() => {
    if (!open) return;
    setPerson('');
    setRaw('');
    setNote('');
    setSource('none');
    setTried(false);
  }, [open]);

  const amount = roundMoney(parseAmount(raw) || 0);
  const name = person.trim();

  const submit = () => {
    setTried(true);
    if (!name) {
      haptic('warning');
      return personRef.current?.focus();
    }
    if (amount <= 0) return haptic('warning');
    const base = { amount, person: name, reason: note.trim() };
    // Either the money moves through a wallet account, or the debt is only noted on the side.
    let entry: NewTransaction;
    if (lent) {
      entry =
        source === 'none'
          ? { ...base, type: 'income', account: 'loans', kind: 'loan' }
          : { ...base, type: 'transfer', account: source, toAccount: 'loans', kind: 'loan' };
    } else {
      entry =
        source === 'none'
          ? { ...base, type: 'expense', account: 'owed', kind: 'borrow' }
          : { ...base, type: 'transfer', account: 'owed', toAccount: source, kind: 'borrow' };
    }
    const tx = add(entry);
    haptic('money');
    toast.show({
      message: t(lent ? 'debt.toast.saved' : 'debt.toast.borrowed', { amount: money(amount), person: name }),
      action: { label: t('common.undo'), onAction: () => remove(tx.id) },
    });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={t(lent ? 'debt.side.lent' : 'debt.side.borrowed')}
      title={t('debt.new')}
      footer={
        <button type="submit" form="debt-form" className="foil press min-h-13 w-full rounded-2xl text-[16px] font-semibold">
          {t('debt.save')}
        </button>
      }
    >
      <form
        id="debt-form"
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div>
          <label htmlFor={ids.person} className="eyebrow mb-2 block">
            {t(lent ? 'debt.person' : 'debt.person.borrowed')}
          </label>
          <input
            ref={personRef}
            id={ids.person}
            data-autofocus
            className="field"
            value={person}
            maxLength={60}
            autoComplete="off"
            placeholder={t('debt.personPlaceholder')}
            onChange={(e) => setPerson(e.target.value)}
            aria-invalid={tried && !name}
            aria-describedby={tried && !name ? `${ids.person}-err` : undefined}
          />
          {tried && !name && (
            <p id={`${ids.person}-err`} role="alert" className="mt-1.5 text-[13px] font-medium text-out">
              {t('debt.errPerson')}
            </p>
          )}
        </div>

        <AmountField
          label={t('composer.amount')}
          value={raw}
          onChange={setRaw}
          error={tried && name && amount <= 0 ? t('edit.errAmount') : undefined}
        />

        <div>
          <span className="eyebrow mb-2 block">{t(lent ? 'debt.source' : 'debt.source.borrowed')}</span>
          <Segmented
            label={t(lent ? 'debt.source' : 'debt.source.borrowed')}
            value={source}
            onChange={(s: Source) => setSource(s)}
            options={[
              { value: 'none', label: t('debt.source.none') },
              { value: 'cash', label: accountName('cash') },
              { value: 'bank', label: accountName('bank') },
            ]}
          />
          <p className="mt-1.5 text-[13px] text-ink-3">
            {source === 'none'
              ? t(lent ? 'debt.source.noneHint' : 'debt.source.noneHint.borrowed')
              : t(lent ? 'debt.source.walletHint' : 'debt.source.walletHint.borrowed', { account: accountName(source) })}
          </p>
        </div>

        <div>
          <label htmlFor={ids.note} className="eyebrow mb-2 block">
            {t('composer.note')} · {t('common.optional')}
          </label>
          <input id={ids.note} className="field" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} />
        </div>
      </form>
    </Sheet>
  );
}

/* ---------- Record a repayment: money coming back, or money paid back ---------- */

function RepaySheet({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  const { t, accountName, money } = useI18n();
  const { add, remove } = useWallet();
  const toast = useToast();
  const [raw, setRaw] = useState('');
  const [account, setAccount] = useState<Source>('cash');
  const [tried, setTried] = useState(false);

  // Keep the last debt on screen while the sheet animates out.
  const last = useRef<Debt | null>(null);
  if (debt) last.current = debt;
  const shown = debt ?? last.current;

  useEffect(() => {
    if (!debt) return;
    setRaw(String(debt.remaining));
    // Never start on 'record only': money should move unless it is chosen not to.
    setAccount('cash');
    setTried(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debt?.id]);

  if (!shown) return null;
  const lent = shown.side === 'lent';
  const person = shown.person || t('debt.someone');
  const amount = roundMoney(parseAmount(raw) || 0);
  const over = amount > shown.remaining + 0.001;
  const error = over ? t('debt.errOver', { amount: money(shown.remaining) }) : tried && amount <= 0 ? t('edit.errAmount') : undefined;

  const submit = () => {
    setTried(true);
    if (amount <= 0 || over) return haptic('warning');
    const base = { amount, kind: 'repayment' as const, debtId: shown.id, person: shown.person, reason: '' };
    const tx = add(
      account === 'none'
        ? // Only the debt shrinks: the entry stays off the wallet.
          lent
          ? { ...base, type: 'expense', account: 'loans' }
          : { ...base, type: 'income', account: 'owed' }
        : {
            ...base,
            type: 'transfer',
            // Money lent comes back into the wallet; money borrowed leaves it.
            account: lent ? 'loans' : account,
            toAccount: lent ? account : 'owed',
          },
    );
    haptic('money');
    const done = amount >= shown.remaining - 0.001;
    const params = { amount: money(amount), person, account: account === 'none' ? '' : accountName(account) };
    toast.show({
      message:
        account === 'none'
          ? t(done ? (lent ? 'debt.toast.settled' : 'debt.toast.cleared') : 'debt.toast.reduced', params)
          : lent
            ? t(done ? 'debt.toast.settled' : 'debt.toast.repaid', params)
            : t(done ? 'debt.toast.cleared' : 'debt.toast.paid', params),
      tone: lent ? 'in' : 'out',
      action: { label: t('common.undo'), onAction: () => remove(tx.id) },
    });
    onClose();
  };

  return (
    <Sheet
      open={debt !== null}
      onClose={onClose}
      eyebrow={t('debt.repay')}
      title={t(lent ? 'debt.tx.repay' : 'debt.tx.payback', { person })}
      footer={
        <button type="submit" form="repay-form" className="foil press min-h-13 w-full rounded-2xl text-[16px] font-semibold">
          {account === 'none' ? t('debt.reduceSubmit') : t(lent ? 'move.submit.out' : 'debt.paySubmit')}
        </button>
      }
    >
      <form
        id="repay-form"
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <AmountField
          label={t('composer.amount')}
          value={raw}
          onChange={setRaw}
          autoFocus
          error={error}
          hint={
            <span className="flex items-center justify-between gap-3">
              <span>
                {t('debt.remaining')}: <Money value={shown.remaining} className="font-medium text-ink-2" />
              </span>
              <button type="button" className="font-medium text-foil hover:underline" onClick={() => setRaw(String(shown.remaining))}>
                {t('composer.all')}
              </button>
            </span>
          }
        />

        <div>
          <span className="eyebrow mb-2 block">{t(lent ? 'debt.repayInto' : 'debt.payFrom')}</span>
          <Segmented
            label={t(lent ? 'debt.repayInto' : 'debt.payFrom')}
            value={account}
            onChange={(a: Source) => setAccount(a)}
            options={[
              { value: 'cash', label: accountName('cash') },
              { value: 'bank', label: accountName('bank') },
              { value: 'none', label: t('debt.source.none') },
            ]}
          />
          {account === 'none' && <p className="mt-1.5 text-[13px] text-ink-3">{t('debt.reduceHint')}</p>}
        </div>
      </form>
    </Sheet>
  );
}

/* ---------- Raise a debt that already exists, with or without money moving ---------- */

function RaiseSheet({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  const { t, accountName, money } = useI18n();
  const { add, remove } = useWallet();
  const toast = useToast();
  const [raw, setRaw] = useState('');
  const [source, setSource] = useState<Source>('none');
  const [tried, setTried] = useState(false);

  const last = useRef<Debt | null>(null);
  if (debt) last.current = debt;
  const shown = debt ?? last.current;

  useEffect(() => {
    if (!debt) return;
    setRaw('');
    setSource('none');
    setTried(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debt?.id]);

  if (!shown) return null;
  const lent = shown.side === 'lent';
  const person = shown.person || t('debt.someone');
  const amount = roundMoney(parseAmount(raw) || 0);

  const submit = () => {
    setTried(true);
    if (amount <= 0) return haptic('warning');
    const base = { amount, debtId: shown.id, person: shown.person, reason: '' };
    let entry: NewTransaction;
    if (lent) {
      entry =
        source === 'none'
          ? { ...base, type: 'income', account: 'loans', kind: 'loan' }
          : { ...base, type: 'transfer', account: source, toAccount: 'loans', kind: 'loan' };
    } else {
      entry =
        source === 'none'
          ? { ...base, type: 'expense', account: 'owed', kind: 'borrow' }
          : { ...base, type: 'transfer', account: 'owed', toAccount: source, kind: 'borrow' };
    }
    const tx = add(entry);
    haptic('money');
    toast.show({
      message: t(lent ? 'debt.toast.moreLent' : 'debt.toast.moreBorrowed', { amount: money(amount), person }),
      action: { label: t('common.undo'), onAction: () => remove(tx.id) },
    });
    onClose();
  };

  return (
    <Sheet
      open={debt !== null}
      onClose={onClose}
      eyebrow={person}
      title={t('debt.moreTitle')}
      footer={
        <button type="submit" form="raise-form" className="foil press min-h-13 w-full rounded-2xl text-[16px] font-semibold">
          {t('debt.moreSubmit')}
        </button>
      }
    >
      <form
        id="raise-form"
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <AmountField
          label={t('composer.amount')}
          value={raw}
          onChange={setRaw}
          autoFocus
          error={tried && amount <= 0 ? t('edit.errAmount') : undefined}
          hint={
            <span>
              {t('debt.remaining')}: <Money value={shown.remaining} className="font-medium text-ink-2" />
            </span>
          }
        />

        <div>
          <span className="eyebrow mb-2 block">{t(lent ? 'debt.source' : 'debt.source.borrowed')}</span>
          <Segmented
            label={t(lent ? 'debt.source' : 'debt.source.borrowed')}
            value={source}
            onChange={(s: Source) => setSource(s)}
            options={[
              { value: 'none', label: t('debt.source.none') },
              { value: 'cash', label: accountName('cash') },
              { value: 'bank', label: accountName('bank') },
            ]}
          />
          <p className="mt-1.5 text-[13px] text-ink-3">
            {source === 'none'
              ? t(lent ? 'debt.source.noneHint' : 'debt.source.noneHint.borrowed')
              : t(lent ? 'debt.source.walletHint' : 'debt.source.walletHint.borrowed', { account: accountName(source) })}
          </p>
        </div>
      </form>
    </Sheet>
  );
}
