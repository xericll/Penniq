import { CalendarClock } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { SPLASH_MS, SPLASH_ON_LOAD } from '../../lib/boot';
import { haptic } from '../../lib/haptics';
import { addDays, dayKey, startOfDay } from '../../lib/ledger';
import { dueForAutoPay, occurrences, recurringEntry } from '../../lib/recurring';
import { KEYS, readJSON, write } from '../../lib/storage';
import { usePlanner } from '../../state/PlannerContext';
import { useReminders } from '../../state/RemindersContext';
import { useToast } from '../../state/ToastContext';
import { useWallet } from '../../state/WalletContext';
import { useLevelWatcher } from './ProgressCards';
import { useRecordOccurrence } from './QuickRecord';
import { isolate } from '../../lib/bidi';

const CHECK_EVERY = 60_000;

/**
 * Reminds of recurring payments: on the day they are due, or the chosen number of days before.
 * A toast while the app is open (with "Record" once it is due), a system notification in the
 * background when notifications are allowed. Each payment date is announced once.
 */
function useRecurringNudges(active: boolean) {
  const { t, money, dayLabel } = useI18n();
  const { recurring } = usePlanner();
  const { transactions } = useWallet();
  const { notify } = useReminders();
  const toast = useToast();
  const recordOccurrence = useRecordOccurrence();
  const live = useRef({ recurring, transactions, t, money, dayLabel, notify, toast, recordOccurrence });
  live.current = { recurring, transactions, t, money, dayLabel, notify, toast, recordOccurrence };

  useEffect(() => {
    if (!active || !recurring.length) return;
    const check = async () => {
      const { recurring, transactions, t, money, dayLabel, notify, toast, recordOccurrence } = live.current;
      const now = new Date();
      const today = startOfDay(now);
      const seen = new Set((readJSON(KEYS.recurringSeen) as string[] | null) ?? []);
      const due = occurrences(recurring, addDays(today, -7), addDays(today, 7), transactions).find((o) => {
        if (o.txId || seen.has(`${o.item.id}:${o.key}`)) return false;
        // Automatic payments record themselves on the day: only the "coming up" reminder is left.
        if (o.item.autoPay && o.date <= now) return false;
        if (o.date < startOfDay(new Date(o.item.createdAt))) return false;
        return addDays(o.date, -o.item.remindBefore) <= now;
      });
      if (!due) return;
      seen.add(`${due.item.id}:${due.key}`);
      write(KEYS.recurringSeen, JSON.stringify([...seen].slice(-200)));
      const isDue = due.date <= now;
      const message = isDue
        ? t('recurring.nudgeDue', { name: due.item.name, amount: isolate(money(due.item.amount)) })
        : t('recurring.nudgeSoon', { name: due.item.name, amount: isolate(money(due.item.amount)), date: dayLabel(due.date) });
      if (document.visibilityState === 'visible') {
        haptic('select');
        toast.show({
          message,
          duration: 10_000,
          action: isDue
            ? {
                label: t('recurring.record'),
                onAction: () => recordOccurrence(due),
                icon: <CalendarClock className="size-4" aria-hidden />,
              }
            : undefined,
        });
      } else {
        await notify(t('recurring.title'), message, `penniq-recurring-${due.item.id}-${dayKey(due.date)}`);
      }
    };
    const first = window.setTimeout(check, SPLASH_ON_LOAD ? SPLASH_MS + 2400 : 2400);
    const timer = window.setInterval(check, CHECK_EVERY);
    const onVisible = () => document.visibilityState === 'visible' && void check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, recurring.length]);
}

/**
 * Automatic recurring payments: when a payment's date has come it is recorded from its account at
 * once (or on the next open, for a date that passed while the app was closed). One toast with Undo;
 * an undone date is marked as skipped so it is not recorded again.
 */
function useRecurringAutoPay(active: boolean) {
  const { t, money, accountName } = useI18n();
  const { recurring, setRecurring } = usePlanner();
  const { add, removeMany } = useWallet();
  const { notify } = useReminders();
  const toast = useToast();
  const live = useRef({ recurring, setRecurring, add, removeMany, t, money, accountName, notify, toast });
  live.current = { recurring, setRecurring, add, removeMany, t, money, accountName, notify, toast };
  const busy = useRef(false);
  const recheck = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!active) return;
    const check = async () => {
      const { recurring, setRecurring, add, removeMany, t, money, accountName, notify, toast } = live.current;
      if (busy.current) return;
      // A payment seen for the first time starts from today: older dates are never filled in afterwards.
      const today = dayKey(new Date());
      if (recurring.some((r) => r.autoPay && !r.autoSince)) {
        setRecurring((list) => list.map((r) => (r.autoPay && !r.autoSince ? { ...r, autoSince: today } : r)));
        return; // checked again with the stamped list
      }
      const due = dueForAutoPay(recurring);
      if (!due.length) return;
      busy.current = true;
      const done = due.map((o) => ({ o, tx: add(recurringEntry(o.item, o.date)) }));
      const mark = (value: (txId: string) => string) =>
        setRecurring((list) =>
          list.map((r) => {
            const mine = done.filter((d) => d.o.item.id === r.id);
            if (!mine.length) return r;
            const paid = { ...r.paid };
            for (const d of mine) paid[d.o.key] = value(d.tx.id);
            return { ...r, paid };
          }),
        );
      mark((id) => id);
      busy.current = false;

      const first = done[0];
      const message =
        done.length > 1
          ? t('recurring.autoDoneMany', { count: done.length })
          : t(first.tx.type === 'income' ? 'recurring.autoDoneIncome' : 'recurring.autoDone', {
              name: first.o.item.name,
              amount: isolate(money(first.tx.amount)),
              account: accountName(first.tx.account),
            });
      if (document.visibilityState === 'visible') {
        haptic('money');
        toast.show({
          message,
          tone: first.tx.type === 'income' && done.length === 1 ? 'in' : 'out',
          duration: 9000,
          action: {
            label: t('common.undo'),
            onAction: () => {
              removeMany(done.map((d) => d.tx.id));
              // Skipped, not forgotten: the date can still be recorded by hand from the calendar.
              mark(() => '');
              haptic('select');
            },
          },
        });
      } else {
        await notify(t('recurring.title'), message, `penniq-autopay-${first.o.item.id}-${first.o.key}`);
      }
    };
    recheck.current = () => void check();
    const first = window.setTimeout(check, SPLASH_ON_LOAD ? SPLASH_MS + 1200 : 1200);
    const timer = window.setInterval(check, CHECK_EVERY);
    const onVisible = () => document.visibilityState === 'visible' && void check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      recheck.current = null;
    };
  }, [active]);

  // A newly saved or stamped payment is looked at right away, not a minute later.
  const signature = recurring.map((r) => `${r.id}:${r.autoPay ? (r.autoSince ?? '-') : 'off'}:${Object.keys(r.paid).length}`).join('|');
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => recheck.current?.(), 300);
    return () => window.clearTimeout(id);
  }, [active, signature]);
}

/** Things that watch the wallet in the background while it is open. Renders nothing. */
export function Watchers({ active }: { active: boolean }) {
  useRecurringAutoPay(active);
  useRecurringNudges(active);
  useLevelWatcher(active);
  return null;
}
