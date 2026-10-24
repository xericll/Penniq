import { BellRing } from 'lucide-react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { SPLASH_MS, SPLASH_ON_LOAD } from '../lib/boot';
import { haptic } from '../lib/haptics';
import { cleanReminders, dueSlot, loadReminders, loggedToday, saveReminders, type ReminderConfig } from '../lib/reminders';
import { KEYS, read, write } from '../lib/storage';
import { useToast } from './ToastContext';
import { useWallet } from './WalletContext';

/** 'unsupported' — this browser has no notifications at all (e.g. Safari on iPhone before the app is installed). */
export type NotifyPermission = 'unsupported' | NotificationPermission;

function readPermission(): NotifyPermission {
  return typeof window === 'undefined' || !('Notification' in window) ? 'unsupported' : Notification.permission;
}

/** A system notification, through the service worker where there is one (Android accepts nothing else). */
async function showNotification(title: string, body: string, tag: string): Promise<boolean> {
  if (readPermission() !== 'granted') return false;
  const root = document.documentElement;
  const options: NotificationOptions = {
    body,
    tag,
    icon: new URL('icon-192.png', document.baseURI).href,
    lang: root.lang,
    dir: root.dir === 'rtl' ? 'rtl' : 'ltr',
  };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return true;
    }
  } catch {
    // No worker here (development, embedded page): the page can still notify by itself.
  }
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

interface RemindersValue {
  config: ReminderConfig;
  permission: NotifyPermission;
  /** Turns reminders on and asks the browser for permission to notify. */
  enable: () => Promise<NotifyPermission>;
  disable: () => void;
  update: (patch: Partial<ReminderConfig>) => void;
  /** Shows a system notification right now; false when the browser would not. */
  notify: (title: string, body: string, tag?: string) => Promise<boolean>;
}

const RemindersContext = createContext<RemindersValue | null>(null);

export function RemindersProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ReminderConfig>(loadReminders);
  const [permission, setPermission] = useState<NotifyPermission>(readPermission);
  const configRef = useRef(config);

  const apply = useCallback((next: ReminderConfig) => {
    configRef.current = next;
    setConfig(next);
    saveReminders(next);
  }, []);

  // The permission can change in the browser's own settings while the app is away.
  useEffect(() => {
    const refresh = () => setPermission(readPermission());
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  const enable = useCallback(async () => {
    let next = readPermission();
    if (next === 'default') {
      try {
        next = await Notification.requestPermission();
      } catch {
        next = readPermission();
      }
    }
    setPermission(next);
    // Reminders count from now on: a time that already passed today stays quiet.
    write(KEYS.reminderSeen, new Date().toISOString());
    apply({ ...configRef.current, enabled: true });
    return next;
  }, [apply]);

  const disable = useCallback(() => apply({ ...configRef.current, enabled: false }), [apply]);
  const update = useCallback((patch: Partial<ReminderConfig>) => apply(cleanReminders({ ...configRef.current, ...patch })), [apply]);
  const notify = useCallback((title: string, body: string, tag = 'penniq-reminder') => showNotification(title, body, tag), []);

  const value = useMemo(
    () => ({ config, permission, enable, disable, update, notify }),
    [config, permission, enable, disable, update, notify],
  );
  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>;
}

export function useReminders(): RemindersValue {
  const ctx = useContext(RemindersContext);
  if (!ctx) throw new Error('useReminders must be used inside <RemindersProvider>');
  return ctx;
}

const CHECK_EVERY = 30_000;

/**
 * Watches the clock while the app is open. A reminder that comes up while the app is
 * on screen is a toast with a "log now" button; in the background it is a system
 * notification. One that passed while the app was closed shows when it is opened again
 * the same day. (The browser cannot wake a closed app: that needs a push server.)
 */
export function useReminderNudges(active: boolean, onLog: () => void): void {
  const { config, notify } = useReminders();
  const { transactions } = useWallet();
  const { t } = useI18n();
  const toast = useToast();
  const live = useRef({ transactions, t, toast, notify, onLog });
  live.current = { transactions, t, toast, notify, onLog };

  useEffect(() => {
    if (!active || !config.enabled) return;

    const check = async () => {
      const now = new Date();
      const seen = new Date(read(KEYS.reminderSeen) ?? '');
      const mark = (at: Date) => write(KEYS.reminderSeen, at.toISOString());
      if (Number.isNaN(seen.getTime())) return void mark(now);
      const slot = dueSlot(config, seen, now);
      if (!slot) return;

      const { transactions, t, toast, notify, onLog } = live.current;
      mark(now);
      if (config.skipIfLogged && loggedToday(transactions, now)) return;
      if (document.visibilityState === 'visible') {
        haptic('select');
        toast.show({
          message: t('reminder.nudge'),
          duration: 10_000,
          action: { label: t('reminder.logNow'), onAction: onLog, icon: <BellRing className="size-4" aria-hidden /> },
        });
        return;
      }
      const shown = await notify(t('reminder.title'), t('reminder.body'), `penniq-reminder-${slot.getHours()}-${slot.getMinutes()}`);
      // Not allowed to notify: the reminder stays due and shows once the app is looked at again.
      if (!shown) mark(seen);
    };

    // Let the launch splash lift before a reminder that was waiting appears.
    const first = window.setTimeout(check, SPLASH_ON_LOAD ? SPLASH_MS + 900 : 900);
    const timer = window.setInterval(check, CHECK_EVERY);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, config]);
}
