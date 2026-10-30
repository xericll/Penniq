import { Camera, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { celebrate } from '../../lib/confetti';
import { GOAL_ICONS, goalProgress, photoToDataUrl, type Goal, type GoalIcon } from '../../lib/goals';
import { haptic } from '../../lib/haptics';
import { newId, roundMoney } from '../../lib/ledger';
import { usePlanner } from '../../state/PlannerContext';
import { useToast } from '../../state/ToastContext';
import { useWallet } from '../../state/WalletContext';
import type { AccountType } from '../../types';
import { AmountField } from '../ui/AmountField';
import { Money } from '../ui/Money';
import { AccountPicker, GOAL_ICON_MAP, GoalMedallion, TextField, parseNumber } from '../ui/Pickers';
import { Sheet } from '../ui/Sheet';
import { isolate } from '../../lib/bidi';

/** Creates or edits a goal: name, picture (built-in or a photo), target and date. */
export function GoalSheet({ open, goal, onClose }: { open: boolean; goal: Goal | null; onClose: () => void }) {
  const { t } = useI18n();
  const { goals, setGoals } = usePlanner();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<GoalIcon>('travel');
  const [photo, setPhoto] = useState<string | undefined>();
  const [target, setTarget] = useState('');
  const [date, setDate] = useState('');
  const [errors, setErrors] = useState<{ name?: string; target?: string }>({});

  useEffect(() => {
    if (!open) return;
    setName(goal?.name ?? '');
    setIcon(goal?.icon ?? 'travel');
    setPhoto(goal?.photo);
    setTarget(goal ? String(goal.target) : '');
    setDate(goal?.targetDate ?? '');
    setErrors({});
  }, [open, goal]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPhoto(await photoToDataUrl(file));
      haptic('success');
    } catch {
      toast.show({ message: t('goal.photoFailed') });
    }
  };

  const save = () => {
    const amount = parseNumber(target);
    const e: typeof errors = {};
    if (!name.trim()) e.name = t('goal.err.name');
    if (!Number.isFinite(amount) || amount <= 0) e.target = t('edit.errAmount');
    setErrors(e);
    if (e.name || e.target) return haptic('warning');
    const next: Goal = {
      id: goal?.id ?? newId(),
      name: name.trim(),
      icon,
      photo,
      target: roundMoney(amount),
      targetDate: date || undefined,
      contributions: goal?.contributions ?? [],
      createdAt: goal?.createdAt ?? new Date().toISOString(),
      reachedAt: goal?.reachedAt,
    };
    setGoals(goal ? goals.map((g) => (g.id === goal.id ? next : g)) : [...goals, next]);
    haptic('success');
    toast.show({ message: t(goal ? 'toast.updated' : 'goal.created', { name: next.name }) });
    onClose();
  };

  const remove = () => {
    if (!goal) return;
    const before = goals;
    setGoals(goals.filter((g) => g.id !== goal.id));
    toast.show({ message: t('goal.removed', { name: goal.name }), action: { label: t('common.undo'), onAction: () => setGoals(before) } });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={goal ? t('goal.edit') : t('goal.new')}
      footer={
        <div className="flex gap-2">
          {goal && (
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
        <div className="flex flex-col items-center gap-3 pt-1">
          <div className="relative">
            <GoalMedallion icon={icon} photo={photo} size={88} />
            {photo && (
              <button
                type="button"
                onClick={() => setPhoto(undefined)}
                aria-label={t('goal.removePhoto')}
                className="press absolute -end-1 -top-1 grid size-8 place-items-center rounded-full bg-ink text-bg"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="press flex min-h-10 items-center gap-1.5 rounded-full border border-line-strong px-4 text-[14px] font-medium hover:bg-surface-2"
          >
            <Camera className="size-4" aria-hidden />
            {t('goal.uploadPhoto')}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
        </div>

        <fieldset>
          <legend className="eyebrow mb-2">{t('goal.picture')}</legend>
          <div className="grid grid-cols-6 gap-2">
            {GOAL_ICONS.map((id) => {
              const Icon = GOAL_ICON_MAP[id];
              const active = !photo && icon === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  aria-label={t(`goal.icon.${id}`)}
                  title={t(`goal.icon.${id}`)}
                  onClick={() => {
                    haptic('select');
                    setIcon(id);
                    setPhoto(undefined);
                  }}
                  className={`press grid aspect-square place-items-center rounded-2xl border ${active ? 'coin border-transparent' : 'border-line text-ink-2 hover:border-line-strong'}`}
                >
                  <Icon className="size-5" strokeWidth={1.8} />
                </button>
              );
            })}
          </div>
        </fieldset>

        <TextField
          label={t('goal.name')}
          value={name}
          onChange={setName}
          error={errors.name}
          placeholder={t('goal.namePlaceholder')}
          maxLength={50}
        />
        <AmountField label={t('goal.target')} value={target} onChange={setTarget} error={errors.target} />
        <TextField label={`${t('goal.date')} · ${t('common.optional')}`} value={date} onChange={setDate} type="date" dir="ltr" />
      </div>
    </Sheet>
  );
}

/** "Add to goal": moves money from cash or bank into the vault and counts it towards the goal. */
export function GoalDepositSheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const { t, money, accountName } = useI18n();
  const { balances, allTransactions, add, remove } = useWallet();
  const { setGoals } = usePlanner();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState<AccountType>('bank');
  const [error, setError] = useState('');
  const last = useRef<Goal | null>(null);
  if (goal) last.current = goal;
  const shown = last.current;
  const progress = useMemo(() => (shown ? goalProgress(shown, allTransactions) : null), [shown, allTransactions]);

  useEffect(() => {
    if (!goal) return;
    setAmount(progress?.perMonth ? String(progress.perMonth) : '');
    setAccount(balances.bank >= balances.cash ? 'bank' : 'cash');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal]);

  const save = () => {
    if (!shown || !progress) return;
    const value = roundMoney(parseNumber(amount));
    if (!Number.isFinite(value) || value <= 0) return setError(t('edit.errAmount'));
    if (value > balances[account] + 0.001)
      return setError(t('composer.over', { account: accountName(account), amount: isolate(money(balances[account])) }));
    const tx = add({ amount: value, type: 'transfer', account, toAccount: 'vault', reason: shown.name });
    const reached = !progress.reached && progress.saved + value >= shown.target;
    setGoals((list) =>
      list.map((g) =>
        g.id === shown.id
          ? { ...g, contributions: [...g.contributions, tx.id], reachedAt: g.reachedAt ?? (reached ? new Date().toISOString() : undefined) }
          : g,
      ),
    );
    haptic(reached ? 'success' : 'money');
    if (reached) celebrate();
    toast.show({
      message: reached
        ? t('goal.reachedToast', { name: shown.name })
        : t('goal.deposited', { amount: isolate(money(value)), name: shown.name }),
      tone: 'in',
      action: {
        label: t('common.undo'),
        onAction: () => {
          remove(tx.id);
          setGoals((list) =>
            list.map((g) => (g.id === shown.id ? { ...g, contributions: g.contributions.filter((id) => id !== tx.id) } : g)),
          );
        },
      },
    });
    onClose();
  };

  return (
    <Sheet
      open={goal !== null}
      onClose={onClose}
      eyebrow={shown?.name}
      title={t('goal.addMoney')}
      footer={
        <button type="button" onClick={save} className="foil press min-h-13 w-full rounded-2xl text-[16px] font-semibold">
          {t('goal.addMoney')}
        </button>
      }
    >
      {shown && progress && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4">
            <GoalMedallion icon={shown.icon} photo={shown.photo} size={48} />
            <div className="min-w-0 flex-1 text-[14px] text-ink-2">
              <div>
                <Money value={progress.saved} className="font-semibold text-ink" /> / <Money value={shown.target} />
              </div>
              <div className="mt-0.5">{t('goal.remaining', { amount: isolate(money(progress.remaining)) })}</div>
            </div>
          </div>
          <AmountField
            label={t('composer.amount')}
            value={amount}
            onChange={(v) => {
              setAmount(v);
              setError('');
            }}
            error={error}
            hint={progress.perMonth ? t('goal.perMonthHint', { amount: isolate(money(progress.perMonth)) }) : t('goal.depositHint')}
            autoFocus
          />
          <AccountPicker value={account} onChange={setAccount} label={t('composer.from')} />
        </div>
      )}
    </Sheet>
  );
}
