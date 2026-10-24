import { Bell, BellOff, BellRing, Plus, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { haptic } from '../../lib/haptics';
import { ALL_DAYS, MAX_REMINDER_TIMES, isTime, timeOn, type ReminderConfig } from '../../lib/reminders';
import { useReminders } from '../../state/RemindersContext';
import { useToast } from '../../state/ToastContext';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { Switch } from '../ui/Switch';

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
  const [draft, setDraft] = useState('');
  const timeId = useId();

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

  const addTime = () => {
    if (!isTime(draft) || full) return haptic('warning');
    haptic('success');
    update({ times: [...config.times, draft] });
    setDraft('');
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
              {config.times.map((time) => (
                <li
                  key={time}
                  className="flex min-h-11 items-center gap-1 rounded-full border border-line-strong ps-4 pe-1 text-[15px] font-medium tabular"
                >
                  <span>{timeLabel(timeOn(new Date(), time))}</span>
                  {config.times.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTime(time)}
                      aria-label={t('reminder.removeTime', { time: timeLabel(timeOn(new Date(), time)) })}
                      className="press grid size-9 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  )}
                  {config.times.length === 1 && <span className="w-3" />}
                </li>
              ))}
            </ul>
            {!full && (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addTime();
                }}
              >
                <label htmlFor={timeId} className="sr-only">
                  {t('reminder.addTime')}
                </label>
                <input
                  id={timeId}
                  type="time"
                  className="field tabular"
                  dir="ltr"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!isTime(draft)}
                  className="press flex min-h-12 shrink-0 items-center gap-1.5 rounded-2xl border border-line-strong px-4 text-[15px] font-medium hover:bg-surface-2 disabled:opacity-50"
                >
                  <Plus className="size-4" aria-hidden />
                  {t('reminder.addTime')}
                </button>
              </form>
            )}
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
