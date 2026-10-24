import { useEffect, useState } from 'react';
import { dayKey } from '../lib/ledger';

/**
 * Today's date key ("2026-10-08"), kept fresh while the app stays open:
 * it flips at midnight and whenever the tab becomes visible again, so
 * "today", "this week" and "this month" never show yesterday's numbers.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => dayKey(new Date()));

  useEffect(() => {
    let timer: number | undefined;
    const refresh = () => setToday(dayKey(new Date()));
    const schedule = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = window.setTimeout(() => {
        refresh();
        schedule();
      }, nextMidnight.getTime() - now.getTime());
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return today;
}
