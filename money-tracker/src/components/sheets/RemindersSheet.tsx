import { AnimatePresence, motion } from 'motion/react';
import { Bell, BellOff, BellRing, Clock3, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { haptic } from '../../lib/haptics';
import { ALL_DAYS, MAX_REMINDER_TIMES, isTime, timeOn, type ReminderConfig } from '../../lib/reminders';
import { useReminders } from '../../state/RemindersContext';
import { useToast } from '../../state/ToastContext';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { Switch } from '../ui/Switch';
import { TimePickerSheet } from '../ui/TimePickerSheet';

/** The first whole hour after the last chosen time that is still free, as the picker's starting point. */
function nextFreeTime(times: string[]): string {
  const last = times.length ? Number(times[times.length - 1].slice(0, 2)) : 20;
  for (let i = 1; i <= 24; i++) {
    const candidate = `${String((last + i) % 24).padStart(2, '0')}:00`;
    if (!times.includes(candidate)) return candidate;
  }
  return '12:00';
}

/** Any date that falls on the given weekday (4 January 2026 is a Sunday). */
const dayDate = (weekday: number) => new Date(2026, 0, 4 + weekday);

/** "Every day · 21:00", for the row in Settings. */
export function useReminderSummary(): (config: ReminderConfig) => string {
  const { t, timeLabel, weekdayShort } = useI18n();
  return (config) => {
    if (!config.enabled) return t('reminder.off');
    const days =
      config.days.length === 7 ? t('reminder.everyDay') : config.days.map((d) => weekdayShort(dayDate(d))).join(t('reminder.listJoin'));
    return `${days} · ${config.times.map((time) => timeLabel(timeOn(new Date(), time))).join(' · ')}`;
  };
}

/** When to be reminded: which days, at what times, and whether a day with entries stays quiet. Saves as you go. */
export function RemindersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, info, timeLabel, weekdayShort } = useI18n();
  const { config, permission, enable, disable, update, notify } = useReminders();
  const toast = useToast();
  // "Chosen days" can still have all seven ticked, so the mode is kept apart from the list.
  const [custom, setCustom] = useState(config.days.length < 7);
  // The time picker: null when closed, otherwise the time being edited (null for a new one).
  const [picking, setPicking] = useState<{ editing: string | null } | null>(null);

  useEffect(() => {
    if (open) setCustom(config.days.length < 7);
    // Only when the sheet opens: ticking the seventh day must not flip the mode under the user's finger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const week = ALL_DAYS.map((_, i) => (info.weekStartsOn + i) % 7);
  const full = config.times.length >= MAX_REMINDER_TIMES;

  const toggle = async () => {
    haptic('select');
    if (config.enabled) return disable();
    const result = await enable();
    if (result !== 'granted')
      toast.show({ message: t(result === 'unsupported' ? 'reminder.perm.unsupported' : 'reminder.perm.denied'), duration: 7000 });
  };

  const toggleDay = (day: number) => {
    const on = config.days.includes(day);
    if (on && config.days.length === 1) return haptic('warning');
    haptic('tap');
    update({ days: on ? config.days.filter((d) => d !== day) : [...config.days, day] });
  };

  /** Adds a time, or replaces the one being edited. The list stays sorted and never holds a time twice. */
  const saveTime = (time: string) => {
    const editing = picking?.editing ?? null;
    if (!isTime(time)) return;
    if (time !== editing && config.times.includes(time)) {
      haptic('warning');
      toast.show({ message: t('reminder.duplicate', { time: timeLabel(timeOn(new Date(), time)) }) });
      return;
    }
    if (!editing && full) return haptic('warning');
    update({ times: [...config.times.filter((x) => x !== editing), time] });
    setPicking(null);
  };

  const removeTime = (time: string) => {
    if (config.times.length === 1) return haptic('warning');
    haptic('tap');
    update({ times: config.times.filter((x) => x !== time) });
  };

  const test = async () => {
    haptic('select');
    if (await notify(t('reminder.title'), t('reminder.body'), 'penniq-reminder-test')) return;
    toast.show({
      message: t('reminder.nudge'),
      action: { label: t('common.close'), onAction: () => {}, icon: <BellRing className="size-4" aria-hidden /> },
    });
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('reminder.sheetTitle')}>
      <button
        type="button"
        role="switch"
        aria-checked={config.enabled}
        data-autofocus
        onClick={() => void toggle()}
        className="press flex min-h-[68px] w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-start"
      >
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-full ${config.enabled ? 'foil' : 'bg-bg-elev text-ink-3'}`}
          aria-hidden
        >
          {config.enabled ? <Bell className="size-5" /> : <BellOff className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{t('reminder.enable')}</span>
          <span className="mt-0.5 block text-[13px] text-ink-3">{t('reminder.enableHint')}</span>
        </span>
        <Switch on={config.enabled} />
      </button>

      {config.enabled && (
        <div className="mt-5 space-y-6">
          {permission !== 'granted' && (
            <div className="rounded-2xl border border-line-strong p-3.5 text-[14px] leading-relaxed text-ink-2">
              <p>
                {t(
                  permission === 'unsupported'
                    ? 'reminder.perm.unsupported'
                    : permission === 'denied'
                      ? 'reminder.perm.denied'
                      : 'reminder.perm.ask',
                )}
              </p>
              {permission === 'default' && (
                <button
                  type="button"
                  onClick={() => void enable()}
                  className="press mt-2.5 min-h-11 rounded-xl bg-ink px-4 text-[14px] font-semibold text-bg"
                >
                  {t('reminder.perm.allow')}
                </button>
              )}
            </div>
          )}

          <section>
            <h3 className="eyebrow mb-2">{t('reminder.days')}</h3>
            <Segmented
              label={t('reminder.days')}
              value={custom ? 'custom' : 'all'}
              onChange={(mode: 'all' | 'custom') => {
                setCustom(mode === 'custom');
                if (mode === 'all') update({ days: ALL_DAYS });
              }}
              options={[
                { value: 'all', label: t('reminder.everyDay') },
                { value: 'custom', label: t('reminder.someDays') },
              ]}
            />
            {custom && (
              <div className="mt-3 grid grid-cols-7 gap-1.5">
                {week.map((day) => {
                  const on = config.days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleDay(day)}
                      className={`press min-h-12 rounded-xl border px-0.5 text-[12px] font-medium ${
                        on ? 'border-transparent bg-ink text-bg' : 'border-line-strong text-ink-2'
                      }`}
                    >
                      {weekdayShort(dayDate(day))}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="eyebrow mb-2">{t('reminder.times')}</h3>
            <ul className="flex flex-wrap gap-2">
              <AnimatePresence initial={false}>
                {config.times.map((time) => {
                  const label = timeLabel(timeOn(new Date(), time));
                  return (
                    <motion.li
                      key={time}
                      layout
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
                      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                      className="flex min-h-11 items-center rounded-full border border-line-strong text-[15px] font-medium tabular"
                    >
                      <button
                        type="button"
                        onClick={() => setPicking({ editing: time })}
                        aria-label={t('reminder.editTime', { time: label })}
                        className={`press flex min-h-11 items-center gap-1.5 rounded-full ps-4 hover:text-foil ${config.times.length > 1 ? 'pe-1' : 'pe-4'}`}
                      >
                        <Clock3 className="size-4 text-ink-3" aria-hidden />
                        <span dir="ltr">{label}</span>
                      </button>
                      {config.times.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTime(time)}
                          aria-label={t('reminder.removeTime', { time: label })}
                          className="press me-1 grid size-9 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      )}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
            {!full && (
              <button
                type="button"
                onClick={() => setPicking({ editing: null })}
                className="press mt-3 flex min-h-12 items-center gap-1.5 rounded-2xl border border-dashed border-line-strong px-4 text-[15px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
              >
                <Plus className="size-4" aria-hidden />
                {t('reminder.addTime')}
              </button>
            )}
            <TimePickerSheet
              open={picking !== null}
              value={picking?.editing ?? nextFreeTime(config.times)}
              title={picking?.editing ? t('reminder.editTimeTitle') : t('reminder.addTimeTitle')}
              onClose={() => setPicking(null)}
              onSave={saveTime}
            />
          </section>

          <button
            type="button"
            role="switch"
            aria-checked={config.skipIfLogged}
            onClick={() => {
              haptic('select');
              update({ skipIfLogged: !config.skipIfLogged });
            }}
            className="press flex min-h-[60px] w-full items-center gap-3 rounded-2xl border border-line px-4 py-3 text-start"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">{t('reminder.skip')}</span>
              <span className="mt-0.5 block text-[13px] text-ink-3">{t('reminder.skipHint')}</span>
            </span>
            <Switch on={config.skipIfLogged} />
          </button>

          <div>
            <button
              type="button"
              onClick={() => void test()}
              className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line-strong text-[15px] font-medium hover:bg-surface-2"
            >
              <BellRing className="size-[18px]" aria-hidden />
              {t('reminder.test')}
            </button>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-3">{t('reminder.limit')}</p>
          </div>
        </div>
      )}
    </Sheet>
  );
}
