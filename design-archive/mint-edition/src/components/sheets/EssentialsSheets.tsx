import { ArrowDownLeft, ArrowUpRight, Check, CheckCheck, Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { CATEGORIES, categoryById, resolveCategory, type CategoryId } from '../../lib/categories';
import { haptic } from '../../lib/haptics';
import { essentialAdded, newId, roundMoney } from '../../lib/ledger';
import { useToast } from '../../state/ToastContext';
import { useWallet } from '../../state/WalletContext';
import type { AccountType, Essential } from '../../types';
import { AmountField } from '../ui/AmountField';
import { Guilloche } from '../ui/Engraving';
import { Money } from '../ui/Money';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { parseAmount } from './EditSheet';

/* ---------- Essentials: fixed monthly incomes and costs ---------- */

export function EssentialsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, monthLabel, accountName } = useI18n();
  const { essentials, transactions, add, removeMany } = useWallet();
  const toast = useToast();
  const [editing, setEditing] = useState<Essential | 'new' | null>(null);

  const rows = useMemo(() => essentials.map((item) => ({ item, added: essentialAdded(item, transactions) })), [essentials, transactions]);
  const incomes = rows.filter((r) => r.item.type === 'income');
  const expenses = rows.filter((r) => r.item.type === 'expense');
  const pending = rows.filter((r) => !r.added).map((r) => r.item);
  const income = roundMoney(incomes.reduce((sum, r) => sum + r.item.amount, 0));
  const expense = roundMoney(expenses.reduce((sum, r) => sum + r.item.amount, 0));

  /** Turns essentials into ordinary entries of this month. */
  const record = (items: Essential[]) => {
    if (!items.length) return;
    const ids = items.map(
      (item) =>
        add({
          amount: item.amount,
          type: item.type,
          account: item.account,
          reason: item.name,
          category: item.type === 'expense' ? (item.category ?? categoryById('other').stored) : undefined,
        }).id,
    );
    haptic('money');
    toast.show({
      message:
        items.length === 1 ? t('essentials.toast.added', { name: items[0].name }) : t('essentials.toast.addedAll', { count: items.length }),
      action: { label: t('common.undo'), onAction: () => removeMany(ids) },
    });
  };

  const section = (title: string, list: typeof rows) =>
    list.length > 0 && (
      <section className="mt-5">
        <h3 className="eyebrow mb-1">{title}</h3>
        <ul className="divide-y divide-line">
          {list.map(({ item, added }) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <button type="button" onClick={() => setEditing(item)} className="press min-w-0 flex-1 rounded-xl text-start">
                <span className="block truncate text-[15px] font-medium">{item.name}</span>
                <span className="mt-0.5 block truncate text-[13px] text-ink-3">
                  {accountName(item.account)}
                  {item.type === 'expense' && <> · {t(resolveCategory(item.category).labelKey)}</>}
                </span>
              </button>
              <Money value={item.type === 'income' ? item.amount : -item.amount} sign tone className="shrink-0 text-[15px] font-semibold" />
              {added ? (
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-in/15 text-in"
                  role="img"
                  aria-label={t('essentials.added')}
                  title={t('essentials.added')}
                >
                  <Check className="size-4" strokeWidth={2.5} />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => record([item])}
                  className="press min-h-10 shrink-0 rounded-xl bg-ink px-3.5 text-[14px] font-semibold text-bg"
                >
                  {t('essentials.add')}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={monthLabel(new Date())}
      title={t('essentials.title')}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing('new')}
            className={`press flex min-h-13 flex-1 items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold ${
              pending.length ? 'border border-line-strong hover:bg-surface-2' : 'foil'
            }`}
          >
            <Plus className="size-5" aria-hidden />
            {t('essentials.new')}
          </button>
          {pending.length > 0 && (
            <button
              type="button"
              onClick={() => record(pending)}
              className="foil press flex min-h-13 flex-1 items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold"
            >
              <CheckCheck className="size-5" aria-hidden />
              {t('essentials.addAll', { count: pending.length })}
            </button>
          )}
        </div>
      }
    >
      {essentials.length === 0 ? (
        <div className="flex flex-col items-center px-4 pt-2 pb-6 text-center">
          <Guilloche className="size-20 text-foil opacity-50" density="light" />
          <h3 className="mt-2 text-[17px] font-semibold">{t('essentials.empty.title')}</h3>
          <p className="mt-1 max-w-xs text-[15px] leading-relaxed text-ink-2">{t('essentials.intro')}</p>
        </div>
      ) : (
        <>
          <dl className="space-y-2.5 rounded-2xl bg-surface-2 p-4 text-[15px]">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-2">{t('essentials.fixedIncome')}</dt>
              <dd>
                <Money value={income} sign className="font-medium text-in" />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-2">{t('essentials.fixedExpense')}</dt>
              <dd>
                <Money value={-expense} className="font-medium text-out" />
              </dd>
            </div>
            <div className="dashed-rule" />
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-semibold">{t('essentials.net')}</dt>
              <dd>
                <Money value={roundMoney(income - expense)} sign className="font-display text-[19px]" />
              </dd>
            </div>
          </dl>
          {section(t('essentials.fixedIncome'), incomes)}
          {section(t('essentials.fixedExpense'), expenses)}
        </>
      )}

      <EssentialForm target={editing} onClose={() => setEditing(null)} />
    </Sheet>
  );
}

/* ---------- Add or change one essential ---------- */

function EssentialForm({ target, onClose }: { target: Essential | 'new' | null; onClose: () => void }) {
  const { t, accountName } = useI18n();
  const { essentials, setEssentials } = useWallet();
  const toast = useToast();
  const [name, setName] = useState('');
  const [raw, setRaw] = useState('');
  const [type, setType] = useState<Essential['type']>('expense');
  const [account, setAccount] = useState<AccountType>('cash');
  const [category, setCategory] = useState<CategoryId>('other');
  const [tried, setTried] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const nameId = useId();

  // Keep the title steady while the sheet animates out.
  const lastWasNew = useRef(true);
  if (target) lastWasNew.current = target === 'new';
  const existing = target && target !== 'new' ? target : null;

  useEffect(() => {
    if (!target) return;
    setTried(false);
    if (target === 'new') {
      setName('');
      setRaw('');
      setType('expense');
      setAccount('cash');
      setCategory('other');
    } else {
      setName(target.name);
      setRaw(String(target.amount));
      setType(target.type);
      setAccount(target.account);
      setCategory(resolveCategory(target.category).id);
    }
  }, [target]);

  const amount = roundMoney(parseAmount(raw) || 0);
  const label = name.trim();

  const save = () => {
    setTried(true);
    if (!label) {
      haptic('warning');
      return nameRef.current?.focus();
    }
    if (amount <= 0) return haptic('warning');
    const item: Essential = { id: existing?.id ?? newId(), name: label, amount, type, account };
    if (type === 'expense') item.category = categoryById(category).stored;
    setEssentials(existing ? essentials.map((e) => (e.id === existing.id ? item : e)) : [...essentials, item]);
    haptic('success');
    toast.show({ message: t('toast.saved') });
    onClose();
  };

  const remove = () => {
    if (!existing) return;
    const before = essentials;
    setEssentials(essentials.filter((e) => e.id !== existing.id));
    haptic('money');
    toast.show({ message: t('essentials.toast.deleted'), action: { label: t('common.undo'), onAction: () => setEssentials(before) } });
    onClose();
  };

  return (
    <Sheet
      open={target !== null}
      onClose={onClose}
      title={t(lastWasNew.current ? 'essentials.new' : 'essentials.edit')}
      footer={
        <div className="flex gap-2">
          {existing && (
            <button
              type="button"
              onClick={remove}
              aria-label={t('common.delete')}
              className="press grid min-h-13 w-14 shrink-0 place-items-center rounded-2xl text-out hover:bg-out/10"
              style={{ boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--out) 45%, transparent)' }}
            >
              <Trash2 className="size-5" aria-hidden />
            </button>
          )}
          <button type="submit" form="essential-form" className="foil press min-h-13 flex-1 rounded-2xl text-[16px] font-semibold">
            {t('common.save')}
          </button>
        </div>
      }
    >
      <form
        id="essential-form"
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Segmented
          label={t('essentials.type')}
          value={type}
          onChange={(v: Essential['type']) => setType(v)}
          options={[
            { value: 'expense', label: t('essentials.expense'), icon: <ArrowUpRight className="size-4" aria-hidden />, tone: 'var(--out)' },
            { value: 'income', label: t('essentials.income'), icon: <ArrowDownLeft className="size-4" aria-hidden />, tone: 'var(--in)' },
          ]}
        />

        <div>
          <label htmlFor={nameId} className="eyebrow mb-2 block">
            {t('essentials.name')}
          </label>
          <input
            ref={nameRef}
            id={nameId}
            data-autofocus
            className="field"
            value={name}
            maxLength={60}
            autoComplete="off"
            placeholder={t('essentials.namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={tried && !label}
            aria-describedby={tried && !label ? `${nameId}-err` : undefined}
          />
          {tried && !label && (
            <p id={`${nameId}-err`} role="alert" className="mt-1.5 text-[13px] font-medium text-out">
              {t('essentials.errName')}
            </p>
          )}
        </div>

        <AmountField
          label={t('composer.amount')}
          value={raw}
          onChange={setRaw}
          error={tried && label && amount <= 0 ? t('edit.errAmount') : undefined}
        />

        <div>
          <span className="eyebrow mb-2 block">{t('composer.account')}</span>
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

        {type === 'expense' && (
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
      </form>
    </Sheet>
  );
}
