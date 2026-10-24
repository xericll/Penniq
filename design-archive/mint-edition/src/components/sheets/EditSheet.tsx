import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { CATEGORIES, resolveCategory, type CategoryId } from '../../lib/categories';
import { haptic } from '../../lib/haptics';
import { isWallet, leavesWallet } from '../../lib/ledger';
import { useToast } from '../../state/ToastContext';
import { useWallet } from '../../state/WalletContext';
import type { AccountType, Transaction, TransactionType } from '../../types';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';

interface EditSheetProps {
  tx: Transaction | null;
  onClose: () => void;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function parseAmount(input: string): number {
  const western = input.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\s/g, '');
  // Accept "1.250,50", "1,250.50", "12,5" and "12.5".
  const lastComma = western.lastIndexOf(',');
  const lastDot = western.lastIndexOf('.');
  let normalized = western;
  if (lastComma > lastDot) normalized = western.replace(/\./g, '').replace(',', '.');
  else normalized = western.replace(/,/g, '');
  return parseFloat(normalized);
}

export function EditSheet({ tx, onClose }: EditSheetProps) {
  const { t, accountName, localize, dir, currencySymbol } = useI18n();
  const arrow = dir === 'rtl' ? '←' : '→';
  const { update } = useWallet();
  const toast = useToast();
  const ids = { amount: useId(), reason: useId(), when: useId() };

  const [type, setType] = useState<TransactionType>('expense');
  const [account, setAccount] = useState<AccountType>('cash');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState<CategoryId>('other');
  const [when, setWhen] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; reason?: string }>({});
  const amountRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);

  const last = useRef<Transaction | null>(null);
  if (tx) last.current = tx;
  // Vault moves, loans and repayments: only the amount, the note and the date can change.
  const fixed = last.current ? leavesWallet(last.current) : false;
  const debt = last.current?.kind === 'loan' || last.current?.kind === 'borrow' || last.current?.kind === 'repayment';

  useEffect(() => {
    if (!tx) return;
    setType(tx.type);
    setAccount(isWallet(tx.account) ? tx.account : 'cash');
    setAmount(String(tx.amount));
    setReason(localize(tx.reason));
    setCategory(resolveCategory(tx.category).id);
    setWhen(toLocalInput(tx.timestamp));
    setErrors({});
  }, [tx, localize]);

  const save = () => {
    const original = last.current;
    if (!original) return;
    const value = parseAmount(amount);
    const next: typeof errors = {};
    if (!Number.isFinite(value) || value <= 0) next.amount = t('edit.errAmount');
    if (!reason.trim() && !debt) next.reason = t('edit.errReason');
    setErrors(next);
    if (next.amount) return amountRef.current?.focus();
    if (next.reason) return reasonRef.current?.focus();

    const d = when ? new Date(when) : new Date(original.timestamp);
    // Keep the stored (possibly Arabic) reason when the user did not change the displayed text.
    const storedReason = reason.trim() === localize(original.reason).trim() ? original.reason : reason.trim();

    const timestamp = Number.isNaN(d.getTime()) ? original.timestamp : d.toISOString();
    update(
      fixed
        ? { ...original, amount: value, reason: storedReason, timestamp }
        : {
            ...original,
            type,
            amount: value,
            account,
            toAccount: type === 'transfer' ? (account === 'cash' ? 'bank' : 'cash') : undefined,
            reason: storedReason,
            category: type === 'expense' ? CATEGORIES.find((c) => c.id === category)!.stored : undefined,
            timestamp,
          },
    );
    haptic('success');
    toast.show({ message: t('toast.updated') });
    onClose();
  };

  return (
    <Sheet
      open={tx !== null}
      onClose={onClose}
      title={t('edit.title')}
      footer={
        <button type="submit" form="edit-form" className="foil press min-h-13 w-full rounded-2xl text-[16px] font-semibold">
          {t('common.save')}
        </button>
      }
    >
      <form
        id="edit-form"
        onKeyDown={(e) => {
          // The submit button lives in the sheet footer, so handle Enter here.
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault();
            save();
          }
        }}
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        noValidate
      >
        {!fixed && (
          <Segmented
            label={t('composer.type')}
            value={type}
            onChange={setType}
            options={[
              { value: 'expense', label: t('common.expense'), icon: <ArrowUpRight className="size-4" aria-hidden />, tone: 'var(--out)' },
              { value: 'income', label: t('common.income'), icon: <ArrowDownLeft className="size-4" aria-hidden />, tone: 'var(--in)' },
              { value: 'transfer', label: t('common.transfer'), icon: <ArrowLeftRight className="size-4" aria-hidden /> },
            ]}
          />
        )}

        <div>
          <label htmlFor={ids.amount} className="eyebrow mb-2 block">
            {t('edit.amount', { currency: currencySymbol })}
          </label>
          <input
            ref={amountRef}
            id={ids.amount}
            className="field font-display text-[22px] tabular"
            inputMode="decimal"
            dir="ltr"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={!!errors.amount}
            aria-describedby={errors.amount ? `${ids.amount}-err` : undefined}
          />
          {errors.amount && (
            <p id={`${ids.amount}-err`} role="alert" className="mt-1.5 text-[13px] font-medium text-out">
              {errors.amount}
            </p>
          )}
        </div>

        <div hidden={fixed}>
          <span className="eyebrow mb-2 block">{type === 'transfer' ? t('composer.from') : t('composer.account')}</span>
          <Segmented
            label={t('composer.account')}
            value={account}
            onChange={setAccount}
            options={[
              {
                value: 'cash',
                label: type === 'transfer' ? `${accountName('cash')} ${arrow} ${accountName('bank')}` : accountName('cash'),
              },
              {
                value: 'bank',
                label: type === 'transfer' ? `${accountName('bank')} ${arrow} ${accountName('cash')}` : accountName('bank'),
              },
            ]}
          />
        </div>

        {type === 'expense' && !fixed && (
          <fieldset>
            <legend className="eyebrow mb-2">{t('composer.category')}</legend>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(c.id)}
                    className={`press flex min-h-11 items-center gap-2 rounded-xl border px-3 text-[14px] ${active ? 'border-transparent font-medium' : 'border-line text-ink-2'}`}
                    style={
                      active
                        ? { background: `color-mix(in oklab, ${c.hue} 22%, var(--surface))`, boxShadow: `inset 0 0 0 1.5px ${c.hue}` }
                        : undefined
                    }
                  >
                    <Icon className="size-4 shrink-0" style={{ color: c.hue }} aria-hidden />
                    <span className="truncate">{t(c.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <div>
          <label htmlFor={ids.reason} className="eyebrow mb-2 block">
            {debt ? t('composer.note') : t('edit.reason')}
          </label>
          <input
            ref={reasonRef}
            id={ids.reason}
            className="field"
            value={reason}
            maxLength={120}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={!!errors.reason}
            aria-describedby={errors.reason ? `${ids.reason}-err` : undefined}
          />
          {errors.reason && (
            <p id={`${ids.reason}-err`} role="alert" className="mt-1.5 text-[13px] font-medium text-out">
              {errors.reason}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={ids.when} className="eyebrow mb-2 block">
            {t('edit.when')}
          </label>
          <input id={ids.when} type="datetime-local" className="field" dir="ltr" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
      </form>
    </Sheet>
  );
}
