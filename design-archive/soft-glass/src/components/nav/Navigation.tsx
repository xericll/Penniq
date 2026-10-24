import { motion } from 'motion/react';
import { BarChart3, Home, Plus, ScrollText, Settings2, type LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { haptic } from '../../lib/haptics';
import type { Tab } from '../../types';
import { PrivacyButton } from '../home/PrivacyButton';
import { Logo } from '../ui/Logo';

const TABS: { id: Tab; icon: LucideIcon; label: TranslationKey }[] = [
  { id: 'home', icon: Home, label: 'nav.home' },
  { id: 'activity', icon: ScrollText, label: 'nav.activity' },
  { id: 'insights', icon: BarChart3, label: 'nav.insights' },
  { id: 'settings', icon: Settings2, label: 'nav.settings' },
];

interface NavProps {
  tab: Tab;
  onTab: (tab: Tab) => void;
  onNew: () => void;
}

const WOBBLE = { scaleX: [1, 1.18, 0.95, 1.02, 1], scaleY: [1, 0.84, 1.05, 0.99, 1] };
const WOBBLE_T = { duration: 0.62, times: [0, 0.3, 0.6, 0.82, 1] };

function useSettled() {
  const settled = useRef(false);
  useEffect(() => {
    settled.current = true;
  }, []);
  return settled;
}

/** Floating liquid-glass dock. The active tab sits in a droplet that glides between icons. */
export function TabBar({ tab, onTab, onNew, hidden }: NavProps & { hidden: boolean }) {
  const { t } = useI18n();
  const settled = useSettled();
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  const item = (x: (typeof TABS)[number]) => {
    const active = tab === x.id;
    const Icon = x.icon;
    return (
      <button
        key={x.id}
        type="button"
        onClick={() => {
          if (!active) haptic('tap');
          onTab(x.id);
        }}
        aria-current={active ? 'page' : undefined}
        className={`press relative z-0 flex min-h-[54px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors duration-300 ${
          active ? 'text-ink' : 'text-ink-3 hover:text-ink-2'
        }`}
      >
        {active && (
          <motion.span
            layoutId="tab-drop"
            aria-hidden
            className="glass-pill iris absolute inset-y-0.5 inset-x-0 -z-10 rounded-full"
            animate={settled.current ? WOBBLE : undefined}
            transition={{ layout: { type: 'spring', stiffness: 360, damping: 30 }, scaleX: WOBBLE_T, scaleY: WOBBLE_T }}
          />
        )}
        <Icon className="size-[21px]" strokeWidth={active ? 2.1 : 1.7} aria-hidden />
        <span className="leading-tight">{t(x.label)}</span>
      </button>
    );
  };

  return (
    <nav
      aria-label={t('nav.main')}
      className={`fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] lg:hidden ${
        hidden ? 'translate-y-[150%]' : ''
      }`}
    >
      <div className="glass mx-auto flex max-w-md items-center gap-0.5 rounded-full px-1.5 py-1">
        {left.map(item)}
        <div className="flex w-[70px] shrink-0 justify-center">
          <motion.button
            type="button"
            onClick={() => {
              haptic('select');
              onNew();
            }}
            whileTap={{ scale: 0.88, rotate: 90 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            className="btn-primary -mt-8 grid size-[60px] place-items-center rounded-full"
            style={{
              boxShadow: '0 0 0 5px var(--glass-top), inset 0 1px 0 rgba(255,255,255,.25), 0 16px 30px -12px rgb(var(--shadow) / 0.7)',
            }}
            aria-label={t('nav.new')}
          >
            <Plus className="size-7" strokeWidth={2.2} />
          </motion.button>
        </div>
        {right.map(item)}
      </div>
    </nav>
  );
}

/** Floating glass side panel for large screens. */
export function Rail({ tab, onTab, onNew }: NavProps) {
  const { t } = useI18n();
  const settled = useSettled();
  return (
    <aside className="glass fixed inset-y-4 start-4 z-30 hidden w-[244px] flex-col rounded-[34px] px-4 py-7 lg:flex">
      <div className="px-3">
        <Logo size={36} />
        <p className="mt-3 text-[13px] text-ink-3">{t('app.tagline')}</p>
      </div>

      <button
        type="button"
        onClick={onNew}
        className="btn-primary press mt-8 flex min-h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold"
      >
        <Plus className="size-5" strokeWidth={2.4} aria-hidden />
        {t('nav.new')}
      </button>

      <nav aria-label={t('nav.main')} className="mt-6 space-y-1">
        {TABS.map((x) => {
          const active = tab === x.id;
          const Icon = x.icon;
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => onTab(x.id)}
              aria-current={active ? 'page' : undefined}
              className={`press relative isolate flex min-h-12 w-full items-center gap-3 rounded-full px-4 text-[15px] font-medium transition-colors ${
                active ? 'text-ink' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="rail-drop"
                  aria-hidden
                  className="glass-pill iris absolute inset-0 -z-10 rounded-full"
                  animate={settled.current ? WOBBLE : undefined}
                  transition={{ layout: { type: 'spring', stiffness: 380, damping: 32 }, scaleX: WOBBLE_T, scaleY: WOBBLE_T }}
                />
              )}
              <Icon className="size-5" strokeWidth={active ? 2.1 : 1.7} aria-hidden />
              {t(x.label)}
            </button>
          );
        })}
      </nav>

      <div className="inset mt-auto flex items-center justify-between rounded-full ps-4 pe-1 py-1">
        <span className="text-[13px] text-ink-3">{t('settings.hideAmounts')}</span>
        <PrivacyButton className="glass-pill text-ink-2" />
      </div>
    </aside>
  );
}
