import { CalendarClock } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { SPLASH_MS, SPLASH_ON_LOAD } from '../../lib/boot';
import { haptic } from '../../lib/haptics';
import { addDays, dayKey, startOfDay } from '../../lib/ledger';
import { occurrences } from '../../lib/recurring';
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

/** Things that watch the wallet in the background while it is open. Renders nothing. */
export function Watchers({ active }: { active: boolean }) {
  useRecurringNudges(active);
  useLevelWatcher(active);
  return null;
}
