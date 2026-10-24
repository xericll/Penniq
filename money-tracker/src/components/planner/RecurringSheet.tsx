import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { categoryById, type CategoryId } from '../../lib/categories';
import { haptic } from '../../lib/haptics';
import { addDays, dayKey, newId, roundMoney, startOfWeek } from '../../lib/ledger';
import { occurrences, type Frequency, type Occurrence, type Recurring } from '../../lib/recurring';
import { usePlanner } from '../../state/PlannerContext';
import { useToast } from '../../state/ToastContext';
import { useWallet } from '../../state/WalletContext';
import type { AccountType } from '../../types';
import { AmountField } from '../ui/AmountField';
import { Money } from '../ui/Money';
import { AccountPicker, CategoryGrid, TextField, TypePicker, parseNumber } from '../ui/Pickers';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { useRecordOccurrence } from './QuickRecord';

/** A month of recurring payments: each on its date, with weekly and monthly totals and a one-tap "record". */
export function RecurringSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, info, monthLabel, weekdayShort, dayLabel } = useI18n();
  const { recurring } = usePlanner();
  const { transactions } = useWallet();
  const recordOccurrence = useRecordOccurrence();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Recurring | 'new' | null>(null);
  const [dir, setDir] = useState(0);

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(null);
  }, [open]);

  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const gridStart = startOfWeek(month, info.weekStartsOn);
  const weeks = Math.ceil(((monthEnd.getTime() - gridStart.getTime()) / 86_400_000 + 1) / 7);
  const list = useMemo(
    () => occurrences(recurring, gridStart, addDays(gridStart, weeks * 7 - 1), transactions),
    [recurring, gridStart.getTime(), weeks, transactions],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const byDay = useMemo(() => {
    const m = new Map<string, Occurrence[]>();
    for (const o of list) m.set(o.key, [...(m.get(o.key) ?? []), o]);
    return m;
  }, [list]);
  const inMonth = list.filter((o) => o.date.getMonth() === month.getMonth());
  const sum = (items: Occurrence[], type: 'income' | 'expense') =>
    roundMoney(items.filter((o) => o.item.type === type).reduce((s, o) => s + o.item.amount, 0));
  const todayKey = dayKey(new Date());
  // A tapped day shows its payments; otherwise the whole month is listed.
  const shownDay = selected;
  const dayItems = shownDay ? (byDay.get(shownDay) ?? []) : inMonth;

  const go = (by: number) => {
    setDir(by);
    setSelected(null);
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('recurring.title')}
      footer={
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="foil press flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold"
        >
          <Plus className="size-5" aria-hidden />
          {t('recurring.add')}
        </button>
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label={t('recurring.prevMonth')}
          className="press grid size-11 place-items-center rounded-full hover:bg-surface-2"
        >
          <ChevronRight className="size-5 ltr:rotate-180" />
        </button>
        <h3 className="font-display flex-1 text-center text-[19px]">{monthLabel(month)}</h3>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label={t('recurring.nextMonth')}
          className="press grid size-11 place-items-center rounded-full hover:bg-surface-2"
        >
          <ChevronLeft className="size-5 ltr:rotate-180" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-ink-3" aria-hidden>
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="truncate">
            {weekdayShort(addDays(gridStart, i))}
          </span>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={month.getTime()}
          initial={{ opacity: 0, x: dir * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -24 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-1 space-y-1"
        >
          {Array.from({ length: weeks }, (_, w) => {
            const weekDays = Array.from({ length: 7 }, (_, i) => addDays(gridStart, w * 7 + i));
            return (
              <div key={w} className="grid grid-cols-7 gap-1">
                {weekDays.map((d) => {
                  const k = dayKey(d);
                  const items = byDay.get(k) ?? [];
                  const other = d.getMonth() !== month.getMonth();
                  const active = selected === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        haptic('tap');
                        setSelected(active ? null : k);
                      }}
                      aria-pressed={active}
                      aria-label={`${dayLabel(d)}${items.length ? ` · ${items.map((o) => o.item.name).join(', ')}` : ''}`}
                      className={`press relative flex aspect-square min-h-10 flex-col items-center justify-center rounded-xl text-[14px] tabular transition-colors ${
                        active
                          ? 'bg-ink text-bg'
                          : k === todayKey
                            ? 'bg-surface-2 font-semibold text-ink'
                            : other
                              ? 'text-ink-3/50'
                              : 'text-ink-2 hover:bg-surface-2'
                      }`}
                    >
                      {d.getDate()}
                      {items.length > 0 && (
                        <span className="absolute bottom-1.5 flex gap-0.5">
                          {items.slice(0, 3).map((o) => (
                            <span
                              key={o.item.id}
                              className="size-1.5 rounded-full"
                              style={{ background: o.txId ? 'var(--ink-3)' : o.item.type === 'income' ? 'var(--in)' : 'var(--coin)' }}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Totals */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="inset p-3">
          <div className="eyebrow">{t('recurring.monthOut')}</div>
          <Money value={-sum(inMonth, 'expense')} className="font-display mt-1 block text-[20px] text-out" />
        </div>
        <div className="inset p-3">
          <div className="eyebrow">{t('recurring.monthIn')}</div>
          <Money value={sum(inMonth, 'income')} sign className="font-display mt-1 block text-[20px] text-in" />
        </div>
      </div>
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-0.5">
        {Array.from({ length: weeks }, (_, w) => {
          const from = addDays(gridStart, w * 7);
          const to = addDays(from, 6);
          const items = list.filter((o) => o.date >= from && o.date <= to);
          const total = roundMoney(sum(items, 'income') - sum(items, 'expense'));
          return (
            <div key={w} className="shrink-0 rounded-xl border border-line px-3 py-2 text-[12px]">
              <div className="text-ink-3 tabular" dir="ltr">
                {from.getDate()}.{from.getMonth() + 1} – {to.getDate()}.{to.getMonth() + 1}
              </div>
              <Money value={total} sign tone className="font-semibold" />
            </div>
          );
        })}
      </div>

      <h3 className="eyebrow mt-5 mb-1">{shownDay ? dayLabel(new Date(`${shownDay}T12:00`)) : t('recurring.thisMonth')}</h3>
      {recurring.length === 0 ? (
        <p className="py-5 text-center text-[14px] leading-relaxed text-ink-3">{t('recurring.none')}</p>
      ) : dayItems.length === 0 ? (
        <p className="py-4 text-center text-[14px] text-ink-3">{t('recurring.nothingDay')}</p>
      ) : (
        <ul className="-mx-2">
          {dayItems.map((o) => (
            <OccurrenceRow key={`${o.item.id}-${o.key}`} o={o} onEdit={() => setEditing(o.item)} onRecord={() => recordOccurrence(o)} />
          ))}
        </ul>
      )}

      <RecurringEditor open={editing !== null} item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
    </Sheet>
  );
}

function OccurrenceRow({ o, onEdit, onRecord }: { o: Occurrence; onEdit: () => void; onRecord: () => void }) {
  const { t, dayLabel, accountName } = useI18n();
  const due = o.date <= new Date() && !o.txId;
  const cat = o.item.type === 'expense' ? categoryById(o.item.category ?? 'bills') : null;
  const Icon = cat?.icon;
  return (
    <li className="flex items-center gap-3 rounded-2xl px-2 py-2.5">
      <button type="button" onClick={onEdit} className="press flex min-w-0 flex-1 items-center gap-3 text-start">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-[14px]"
          style={{ background: `color-mix(in oklab, ${cat?.hue ?? 'var(--in)'} 16%, transparent)`, color: cat?.hue ?? 'var(--in)' }}
          aria-hidden
        >
          {Icon ? <Icon className="size-5" /> : <Plus className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{o.item.name}</span>
          <span className="block truncate text-[13px] text-ink-3">
            {dayLabel(o.date)} · {accountName(o.item.account)}
          </span>
        </span>
      </button>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <Money value={o.item.type === 'expense' ? -o.item.amount : o.item.amount} sign tone className="text-[15px] font-semibold" />
        {o.txId ? (
          <span className="flex items-center gap-1 text-[12px] font-medium text-in">
            <Check className="size-3.5" aria-hidden />
            {t('recurring.paid')}
          </span>
        ) : due ? (
          <button type="button" onClick={onRecord} className="foil press min-h-8 rounded-full px-3 text-[12px] font-semibold">
            {t('recurring.record')}
          </button>
        ) : (
          <span className="text-[12px] text-ink-3">{t('recurring.upcoming')}</span>
        )}
      </span>
    </li>
  );
}

function RecurringEditor({ open, item, onClose }: { open: boolean; item: Recurring | null; onClose: () => void }) {
  const { t, weekdayShort } = useI18n();
  const { recurring, setRecurring } = usePlanner();
  const toast = useToast();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [account, setAccount] = useState<AccountType>('bank');
  const [category, setCategory] = useState<CategoryId>('bills');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [day, setDay] = useState(1);
  const [yearDate, setYearDate] = useState('');
  const [remind, setRemind] = useState('1');
  const [errors, setErrors] = useState<{ name?: string; amount?: string }>({});

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    setName(item?.name ?? '');
    setAmount(item ? String(item.amount) : '');
    setType(item?.type ?? 'expense');
    setAccount(item?.account ?? 'bank');
    setCategory(item?.category ?? 'bills');
    setFrequency(item?.frequency ?? 'monthly');
    setDay(item?.day ?? (item?.frequency === 'weekly' ? now.getDay() : now.getDate()));
    const m = item?.month ?? now.getMonth();
    const d = item?.frequency === 'yearly' ? item.day : now.getDate();
    setYearDate(`${now.getFullYear()}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    setRemind(String(item?.remindBefore ?? 1));
    setErrors({});
  }, [open, item]);

  const save = () => {
    const value = parseNumber(amount);
    const e: typeof errors = {};
    if (!name.trim()) e.name = t('edit.errReason');
    if (!Number.isFinite(value) || value <= 0) e.amount = t('edit.errAmount');
    setErrors(e);
    if (e.name || e.amount) return haptic('warning');
    const yd = new Date(`${yearDate}T12:00`);
    const next: Recurring = {
      id: item?.id ?? newId(),
      name: name.trim(),
      amount: roundMoney(value),
      type,
      account,
      category: type === 'expense' ? category : undefined,
      frequency,
      day: frequency === 'yearly' ? (Number.isNaN(yd.getTime()) ? 1 : yd.getDate()) : day,
      month: frequency === 'yearly' ? (Number.isNaN(yd.getTime()) ? 0 : yd.getMonth()) : undefined,
      remindBefore: Number(remind),
      paid: item?.paid ?? {},
      createdAt: item?.createdAt ?? new Date().toISOString(),
    };
    setRecurring(item ? recurring.map((r) => (r.id === item.id ? next : r)) : [...recurring, next]);
    haptic('success');
    onClose();
  };

  const remove = () => {
    if (!item) return;
    const before = recurring;
    setRecurring(recurring.filter((r) => r.id !== item.id));
    toast.show({
      message: t('recurring.removed', { name: item.name }),
      action: { label: t('common.undo'), onAction: () => setRecurring(before) },
    });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? t('recurring.edit') : t('recurring.add')}
      footer={
        <div className="flex gap-2">
          {item && (
            <button
              type="button"
              onClick={remove}
              aria-label={t('common.delete')}
              className="press grid min-h-13 w-14 shrink-0 place-items-center rounded-2xl border border-line-strong text-out hover:bg-surface-2"
            >
              <Trash2 className="size-5" />
            </button>
          )}
          <button type="button" onClick={save} className="foil press min-h-13 flex-1 rounded-2xl text-[16px] font-semibold">
            {t('common.save')}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <TypePicker value={type} onChange={setType} />
        <TextField
          label={t('recurring.name')}
          value={name}
          onChange={setName}
          error={errors.name}
          placeholder={t('recurring.namePlaceholder')}
          maxLength={50}
        />
        <AmountField label={t('composer.amount')} value={amount} onChange={setAmount} error={errors.amount} />
        <div>
          <span className="eyebrow mb-2 block">{t('recurring.frequency')}</span>
          <Segmented
            label={t('recurring.frequency')}
            value={frequency}
            onChange={(f) => {
              setFrequency(f);
              setDay(f === 'weekly' ? new Date().getDay() : new Date().getDate());
            }}
            options={[
              { value: 'monthly', label: t('recurring.monthly') },
              { value: 'weekly', label: t('recurring.weekly') },
              { value: 'yearly', label: t('recurring.yearly') },
            ]}
          />
        </div>
        {frequency === 'monthly' && (
          <fieldset>
            <legend className="eyebrow mb-2">{t('recurring.dayOfMonth')}</legend>
            <div className="grid grid-cols-7 gap-1" dir="ltr">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={day === n}
                  onClick={() => setDay(n)}
                  className={`press min-h-10 rounded-xl text-[14px] tabular ${day === n ? 'bg-ink font-semibold text-bg' : 'text-ink-2 hover:bg-surface-2'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            {day > 28 && <p className="mt-1.5 text-[12px] text-ink-3">{t('recurring.shortMonths')}</p>}
          </fieldset>
        )}
        {frequency === 'weekly' && (
          <fieldset>
            <legend className="eyebrow mb-2">{t('recurring.weekday')}</legend>
            <div className="grid grid-cols-7 gap-1">
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
                <button
                  key={wd}
                  type="button"
                  aria-pressed={day === wd}
                  onClick={() => setDay(wd)}
                  className={`press min-h-11 rounded-xl px-0.5 text-[12px] font-medium ${day === wd ? 'bg-ink text-bg' : 'border border-line-strong text-ink-2'}`}
                >
                  {weekdayShort(new Date(2026, 0, 4 + wd))}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {frequency === 'yearly' && (
          <TextField label={t('recurring.yearDate')} value={yearDate} onChange={setYearDate} type="date" dir="ltr" />
        )}
        <AccountPicker value={account} onChange={setAccount} />
        {type === 'expense' && <CategoryGrid value={category} onChange={setCategory} />}
        <div>
          <span className="eyebrow mb-2 block">{t('recurring.remind')}</span>
          <Segmented
            label={t('recurring.remind')}
            value={remind}
            onChange={setRemind}
            options={[
              { value: '0', label: t('recurring.remind.0') },
              { value: '1', label: t('recurring.remind.1') },
              { value: '3', label: t('recurring.remind.3') },
              { value: '7', label: t('recurring.remind.7') },
            ]}
          />
        </div>
      </div>
    </Sheet>
  );
}
