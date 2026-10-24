import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, Landmark, PencilLine, Plus, Wallet } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { CATEGORIES, type CategoryId } from '../../lib/categories';
import { haptic } from '../../lib/haptics';
import { round2 } from '../../lib/ledger';
import { DEFAULT_REASON, TRANSFER_REASONS } from '../../lib/sources';
import { useToast } from '../../state/ToastContext';
import { useWallet } from '../../state/WalletContext';
import type { AccountType, TransactionType, TransferDirection } from '../../types';
import { Keypad } from '../ui/Keypad';
import { Money } from '../ui/Money';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';

export interface ComposerIntent {
  type: TransactionType;
  account?: AccountType;
  direction?: TransferDirection;
  amount?: number;
}

interface ComposerProps {
  open: boolean;
  intent: ComposerIntent;
  onClose: () => void;
  onEditList: (kind: 'income' | 'expense') => void;
  /** Another sheet is on top — ignore hardware keys. */
  suspended?: boolean;
}

const MAX_INT_DIGITS = 9;

export function Composer({ open, intent, onClose, onEditList, suspended = false }: ComposerProps) {
  const { t, lang, money, localize, accountName } = useI18n();
  const { balances, quickAmounts, incomeSources, expenseSources, add, remove } = useWallet();
  const toast = useToast();

  const [type, setType] = useState<TransactionType>('expense');
  const [account, setAccount] = useState<AccountType>('cash');
  const [direction, setDirection] = useState<TransferDirection>('cash_to_bank');
  const [raw, setRaw] = useState('');
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [preset, setPreset] = useState('');
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [swapTurns, setSwapTurns] = useState(0);

  useEffect(() => {
    if (!open) return;
    setType(intent.type);
    setAccount(intent.account ?? 'cash');
    setDirection(intent.direction ?? (intent.account === 'bank' ? 'bank_to_cash' : 'cash_to_bank'));
    setRaw(intent.amount ? String(intent.amount) : '');
    setCategory(null);
    setPreset('');
    setNote('');
    setNoteOpen(false);
  }, [open, intent]);

  const source: AccountType = type === 'transfer' ? (direction === 'cash_to_bank' ? 'cash' : 'bank') : account;
  const target: AccountType = source === 'cash' ? 'bank' : 'cash';
  const sourceBalance = balances[source];
  const amount = round2(parseFloat(raw) || 0);
  const after = type === 'income' ? sourceBalance + amount : sourceBalance - amount;
  const over = type !== 'income' && amount > sourceBalance + 0.001;
  const canSubmit = amount > 0 && !over;

  const shake = useCallback(() => {
    haptic('warning');
    setShakeKey((k) => k + 1);
  }, []);

  // ---------- amount input ----------
  const pushDigit = useCallback((d: string) => {
    setRaw((prev) => {
      const [int, dec] = prev.split('.');
      if (dec !== undefined && dec.length >= 2) return prev;
      if (dec === undefined && int.replace(/^0+/, '').length >= MAX_INT_DIGITS) return prev;
      const next = prev === '0' ? d : prev + d;
      return next;
    });
  }, []);
  const pushDecimal = useCallback(() => setRaw((p) => (p.includes('.') ? p : (p || '0') + '.')), []);
  const backspace = useCallback(() => setRaw((p) => p.slice(0, -1)), []);
  const clear = useCallback(() => setRaw(''), []);

  // Shake as soon as the typed amount passes the available balance.
  useEffect(() => {
    if (over && raw) shake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  // ---------- submit ----------
  const submit = useCallback(() => {
    if (!canSubmit) {
      shake();
      return;
    }
    const trimmed = note.trim();
    let base = preset;
    if (!base) {
      if (type === 'income') base = DEFAULT_REASON.income;
      else if (type === 'transfer') base = DEFAULT_REASON[direction];
      else base = CATEGORIES.find((c) => c.id === (category ?? 'other'))!.stored;
    }
    const reason = trimmed ? (preset ? `${preset} — ${trimmed}` : trimmed) : base;

    const tx = add({
      amount,
      type,
      account: source,
      toAccount: type === 'transfer' ? target : undefined,
      reason,
      category: type === 'expense' ? CATEGORIES.find((c) => c.id === (category ?? 'other'))!.stored : undefined,
    });
    haptic('money');

    const formatted = money(amount);
    toast.show({
      message:
        type === 'income'
          ? t('toast.income', { amount: formatted, account: accountName(source) })
          : type === 'expense'
            ? t('toast.expense', { amount: formatted, account: accountName(source) })
            : t('toast.transfer', { amount: formatted, from: accountName(source), to: accountName(target) }),
      tone: type === 'income' ? 'in' : type === 'expense' ? 'out' : 'neutral',
      action: {
        label: t('common.undo'),
        onAction: () => {
          remove(tx.id);
          haptic('select');
        },
      },
    });
    onClose();
  }, [
    canSubmit,
    note,
    preset,
    type,
    direction,
    category,
    add,
    amount,
    source,
    target,
    money,
    toast,
    t,
    accountName,
    remove,
    onClose,
    shake,
  ]);

  // Hardware keyboard: digits, decimal, backspace, enter.
  useEffect(() => {
    if (!open || suspended) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        pushDigit(e.key);
      } else if (e.key === '.' || e.key === ',') {
        e.preventDefault();
        pushDecimal();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        backspace();
      } else if (e.key === 'Enter' && !(el && el.tagName === 'BUTTON')) {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, suspended, pushDigit, pushDecimal, backspace, submit]);

  // ---------- display helpers ----------
  const typed = useMemo(() => {
    const [int, dec] = raw.split('.');
    const grouped = (int || '0').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'de' ? '.' : ',');
    return dec !== undefined ? `${grouped}${lang === 'de' ? ',' : '.'}${dec}` : grouped;
  }, [raw, lang]);

  const quick = quickAmounts[source];
  const percentChips = type !== 'income' && sourceBalance > 0 ? [0.25, 0.5, 1] : [];
  const presets = type === 'income' ? incomeSources : type === 'expense' ? expenseSources : TRANSFER_REASONS[direction];
  const tone = type === 'income' ? 'var(--in)' : type === 'expense' ? 'var(--out)' : 'var(--ink)';

  const submitLabel =
    type === 'income' ? t('composer.submit.income') : type === 'expense' ? t('composer.submit.expense') : t('composer.submit.transfer');

  const footer = (
    <div className="space-y-2.5">
      <Keypad onDigit={pushDigit} onDecimal={pushDecimal} onBackspace={backspace} onClear={clear} />
      <button
        type="button"
        onClick={submit}
        aria-disabled={!canSubmit}
        className={`press flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold transition-[background-color,color,box-shadow] duration-300 ${
          canSubmit ? 'btn-primary' : 'inset text-ink-3'
        }`}
        style={
          canSubmit && type !== 'transfer'
            ? {
                background: `linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,0) 55%), ${tone}`,
                color: 'var(--on-primary)',
              }
            : undefined
        }
      >
        <Check className="size-5" strokeWidth={2.5} aria-hidden />
        <span>{submitLabel}</span>
        {amount > 0 && (
          <span dir="ltr" className="money tabular opacity-80">
            {money(type === 'expense' ? -amount : amount, { sign: type === 'income' })}
          </span>
        )}
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={t(`composer.title.${type}` as const)} hideTitle footer={footer} bodyClassName="space-y-4">
      <Segmented
        label={t('composer.type')}
        value={type}
        onChange={(v) => {
          setType(v);
          setPreset('');
        }}
        size="lg"
        options={[
          { value: 'expense', label: t('common.expense'), icon: <ArrowUpRight className="size-4" aria-hidden />, tone: 'var(--out)' },
          { value: 'income', label: t('common.income'), icon: <ArrowDownLeft className="size-4" aria-hidden />, tone: 'var(--in)' },
          { value: 'transfer', label: t('common.transfer'), icon: <ArrowLeftRight className="size-4" aria-hidden /> },
        ]}
      />

      {/* Account(s) */}
      {type === 'transfer' ? (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <AccountCard label={t('composer.from')} account={source} balance={balances[source]} active />
          <motion.button
            type="button"
            onClick={() => {
              haptic('select');
              setSwapTurns((n) => n + 1);
              setDirection((d) => (d === 'cash_to_bank' ? 'bank_to_cash' : 'cash_to_bank'));
              setPreset('');
            }}
            animate={{ rotate: swapTurns * 180 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            className="glass-pill iris grid size-11 place-items-center rounded-full text-ink"
            aria-label={t('composer.swap')}
          >
            <ArrowLeftRight className="size-[18px]" />
          </motion.button>
          <AccountCard label={t('composer.to')} account={target} balance={balances[target]} />
        </div>
      ) : (
        <div role="radiogroup" aria-label={t('composer.account')} className="grid grid-cols-2 gap-2">
          {(['cash', 'bank'] as const).map((a) => (
            <AccountCard
              key={a}
              account={a}
              balance={balances[a]}
              active={account === a}
              onSelect={() => {
                haptic('select');
                setAccount(a);
              }}
            />
          ))}
        </div>
      )}

      {/* Amount */}
      <div className="text-center">
        <div key={shakeKey} className={shakeKey ? 'shake' : ''}>
          <div
            dir="ltr"
            className="font-display flex min-h-[64px] items-baseline justify-center gap-1 text-[54px] leading-none font-extralight tabular"
            style={{ color: over ? 'var(--out)' : raw ? 'var(--ink)' : 'var(--ink-3)' }}
            aria-live="polite"
            aria-label={`${t('composer.amount')}: ${money(amount)}`}
          >
            {lang === 'en' && <span className="text-[30px] text-ink-3">€</span>}
            <span className="relative inline-flex">
              <AnimatePresence initial={false} mode="popLayout">
                {typed.split('').map((ch, i) => (
                  <motion.span
                    key={`${i}-${ch}`}
                    initial={{ y: 14, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -10, opacity: 0 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="inline-block"
                  >
                    {ch}
                  </motion.span>
                ))}
              </AnimatePresence>
            </span>
            {lang !== 'en' && <span className="ms-1 text-[30px] text-ink-3">€</span>}
          </div>
        </div>
        <p
          role={over ? 'alert' : undefined}
          className={`mt-2 flex min-h-5 items-center justify-center gap-1.5 text-[13px] ${over ? 'font-medium text-out' : 'text-ink-3'}`}
        >
          {over ? (
            <>
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              {t('composer.over', { account: accountName(source), amount: money(sourceBalance) })}
            </>
          ) : (
            <span>
              {t('composer.after', { account: accountName(source), amount: '' })}
              <Money value={after} className="font-medium text-ink-2" />
            </span>
          )}
        </p>
      </div>

      {/* Primary detail: category (expense) · source (income) · reason (transfer) */}
      {type === 'expense' ? (
        <fieldset>
          <legend className="eyebrow mb-2">{t('composer.category')}</legend>
          <div className="no-scrollbar rail-fade -mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    haptic('select');
                    setCategory(active ? null : c.id);
                  }}
                  className={`chip press shrink-0 ${active ? '!border-transparent !text-ink' : ''}`}
                  style={
                    active
                      ? {
                          background: `color-mix(in oklab, ${c.hue} 22%, var(--glass-top))`,
                          boxShadow: `inset 0 0 0 1.5px color-mix(in oklab, ${c.hue} 70%, transparent), inset 0 1px 0 var(--rim-strong), 0 6px 14px -8px ${c.hue}`,
                        }
                      : undefined
                  }
                >
                  <Icon className="size-4 shrink-0" style={{ color: `color-mix(in oklab, ${c.hue} 80%, var(--ink))` }} aria-hidden />
                  {t(c.labelKey)}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <PresetRail
          legend={type === 'income' ? t('composer.source') : t('composer.reason')}
          presets={presets}
          value={preset}
          onChange={setPreset}
          onEdit={type === 'income' ? () => onEditList('income') : undefined}
        />
      )}

      {/* Quick amounts */}
      <div className="no-scrollbar rail-fade -mx-5 flex gap-2 overflow-x-auto px-5">
        {quick.map((q) => (
          <button
            key={`q-${q}`}
            type="button"
            className="chip press shrink-0"
            aria-pressed={amount === q}
            onClick={() => {
              haptic('tap');
              setRaw(String(q));
            }}
          >
            <Plus className="size-3.5" aria-hidden />
            <span dir="ltr" className="tabular">
              {money(q)}
            </span>
          </button>
        ))}
        {percentChips.map((p) => {
          const val = round2(sourceBalance * p);
          return (
            <button
              key={`p-${p}`}
              type="button"
              className="chip press shrink-0"
              aria-pressed={amount > 0 && Math.abs(amount - val) < 0.005}
              onClick={() => {
                haptic('tap');
                setRaw(String(val));
              }}
            >
              {p === 1 ? t('composer.all') : <span dir="ltr">{p * 100}%</span>}
            </button>
          );
        })}
      </div>

      {type === 'expense' && (
        <PresetRail
          legend={t('composer.detail')}
          presets={presets}
          value={preset}
          onChange={setPreset}
          onEdit={() => onEditList('expense')}
        />
      )}

      {/* Note */}
      <div>
        {noteOpen ? (
          <label className="block">
            <span className="eyebrow mb-2 block">
              {t('composer.note')} · {t('common.optional')}
            </span>
            <input
              className="field"
              value={note}
              autoFocus
              maxLength={120}
              placeholder={t('composer.notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </label>
        ) : (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="press flex min-h-11 items-center gap-2 rounded-xl text-[14px] font-medium text-ink-2 hover:text-ink"
          >
            <PencilLine className="size-4" aria-hidden />
            {t('composer.addNote')}
          </button>
        )}
      </div>
    </Sheet>
  );
}

function PresetRail({
  legend,
  presets,
  value,
  onChange,
  onEdit,
}: {
  legend: string;
  presets: string[];
  value: string;
  onChange: (v: string) => void;
  onEdit?: () => void;
}) {
  const { t, localize } = useI18n();
  return (
    <fieldset>
      <legend className="eyebrow mb-2">{legend}</legend>
      <div className="no-scrollbar rail-fade -mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            className="chip press shrink-0"
            aria-pressed={value === p}
            onClick={() => {
              haptic('select');
              onChange(value === p ? '' : p);
            }}
          >
            {localize(p)}
          </button>
        ))}
        {onEdit && (
          <button type="button" className="chip press shrink-0 border-dashed text-ink-3" onClick={onEdit}>
            <PencilLine className="size-3.5" aria-hidden />
            {t('composer.editList')}
          </button>
        )}
      </div>
    </fieldset>
  );
}

function AccountCard({
  account,
  balance,
  active = false,
  label,
  onSelect,
}: {
  account: AccountType;
  balance: number;
  active?: boolean;
  label?: string;
  onSelect?: () => void;
}) {
  const { accountName } = useI18n();
  const Icon = account === 'cash' ? Wallet : Landmark;
  const hue = account === 'cash' ? 'var(--cash)' : 'var(--bank)';
  const content = (
    <>
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full"
        style={{ background: `color-mix(in oklab, ${hue} 18%, transparent)`, color: `color-mix(in oklab, ${hue} 85%, var(--ink))` }}
        aria-hidden
      >
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 text-start">
        {label && <span className="block text-[11px] leading-tight text-ink-3">{label}</span>}
        <span className="block truncate text-[15px] leading-tight font-semibold">{accountName(account)}</span>
        <Money value={balance} className="text-[12px] text-ink-3" />
      </span>
    </>
  );
  const cls = `flex min-h-[58px] w-full items-center gap-2.5 rounded-[22px] px-3 py-2 transition-[box-shadow,background-color,color] duration-300 ${
    active ? 'glass-pill text-ink' : 'inset text-ink-2'
  }`;
  const style: React.CSSProperties | undefined = active
    ? {
        boxShadow: `inset 0 0 0 1.5px color-mix(in oklab, ${hue} 65%, transparent), inset 0 1px 0 #fff, 0 10px 22px -12px rgb(var(--shadow) / 0.5)`,
      }
    : undefined;

  if (!onSelect) {
    return (
      <div className={cls} style={style}>
        {content}
      </div>
    );
  }
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onSelect} className={`press ${cls}`} style={style}>
      {content}
    </button>
  );
}
