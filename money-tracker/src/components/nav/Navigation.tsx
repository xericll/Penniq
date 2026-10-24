import { motion } from 'motion/react';
import { BarChart3, Gem, Home, Plus, ScrollText, Settings2, Sparkles, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
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

/* The side rail has room for Wealth as well. On phones the dock keeps its four tabs (a fifth would not fit
   the German labels at 360 px); Wealth is reached from its card on Home there. */
const RAIL_TABS: { id: Tab; icon: LucideIcon; label: TranslationKey }[] = [
  ...TABS.slice(0, 2),
  { id: 'wealth', icon: Gem, label: 'nav.wealth' },
  ...TABS.slice(2),
];

interface NavProps {
  tab: Tab;
  onTab: (tab: Tab) => void;
  onNew: () => void;
}

/** Floating olive dock with the gold coin in the middle — phones and tablets. */
export function TabBar({ tab, onTab, onNew, hidden }: NavProps & { hidden: boolean }) {
  const { t } = useI18n();
  const [ping, setPing] = useState(0);
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  const item = (x: (typeof TABS)[number]) => {
    const active = tab === x.id || (x.id === 'home' && tab === 'wealth');
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
        className={`press relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] transition-colors duration-300 ${
          active ? 'font-semibold' : 'font-medium'
        }`}
        style={{ color: active ? 'var(--nav-ink-on)' : 'var(--nav-ink)' }}
      >
        <Icon
          className={`size-[22px] transition-transform duration-500 ${active ? '-translate-y-0.5' : ''}`}
          strokeWidth={active ? 2 : 1.6}
          aria-hidden
        />
        <span className="leading-tight">{t(x.label)}</span>
        {active && (
          <motion.span
            layoutId="tab-dot"
            className="absolute bottom-1 size-[5px] rounded-full"
            style={{ background: 'var(--coin)', boxShadow: '0 0 8px var(--coin)' }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
          />
        )}
      </button>
    );
  };

  return (
    <nav
      aria-label={t('nav.main')}
      className={`fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] transition-transform duration-300 lg:hidden ${
        hidden ? 'translate-y-[140%]' : ''
      }`}
    >
      {/* Content fades out under the dock instead of showing through below it. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[150%] bg-gradient-to-t from-bg from-45% to-transparent"
        aria-hidden
      />
      <div
        className="mx-auto flex max-w-md items-center gap-1 rounded-[26px] px-2 py-0.5"
        style={{ background: 'var(--nav-bg)', boxShadow: '0 18px 36px -16px rgba(0,0,0,.5)' }}
      >
        {left.map(item)}
        <div className="flex w-[72px] shrink-0 justify-center">
          <motion.button
            type="button"
            onClick={() => {
              haptic('select');
              setPing((n) => n + 1);
              onNew();
            }}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            className="coin relative -mt-8 grid size-[60px] place-items-center overflow-visible rounded-full"
            style={{ boxShadow: '0 0 0 5px var(--bg), 0 14px 26px -10px rgba(0,0,0,.45)' }}
            aria-label={t('nav.new')}
          >
            {ping > 0 && <span key={ping} className="coin-ping pointer-events-none absolute inset-0 rounded-full" aria-hidden />}
            <Plus className="size-7" strokeWidth={2.2} />
          </motion.button>
        </div>
        {right.map(item)}
      </div>
    </nav>
  );
}

/** Side rail for large screens. */
export function Rail({ tab, onTab, onNew, onAssistant }: NavProps & { onAssistant: () => void }) {
  const { t } = useI18n();
  return (
    <aside className="fixed inset-y-0 start-0 z-30 hidden w-[260px] flex-col border-e border-line bg-bg-elev/60 px-5 py-8 backdrop-blur lg:flex">
      <div className="px-2">
        <Logo size={30} />
        <p className="mt-3 text-[13px] text-ink-3">{t('app.tagline')}</p>
      </div>

      <button
        type="button"
        onClick={onNew}
        className="foil press mt-8 flex min-h-12 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold"
      >
        <Plus className="size-5" strokeWidth={2.4} aria-hidden />
        {t('nav.new')}
      </button>

      <nav aria-label={t('nav.main')} className="mt-6 space-y-1">
        {RAIL_TABS.map((x) => {
          const active = tab === x.id;
          const Icon = x.icon;
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => onTab(x.id)}
              aria-current={active ? 'page' : undefined}
              className={`press relative isolate flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-[15px] font-medium transition-colors ${
                active ? 'text-ink' : 'text-ink-2 hover:bg-surface-2/60 hover:text-ink'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="rail-pill"
                  className="absolute inset-0 -z-10 rounded-2xl bg-surface-2"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              {t(x.label)}
              {active && <span className="ms-auto size-1.5 rounded-full bg-foil" aria-hidden />}
            </button>
          );
        })}
      </nav>

      <div className="dashed-rule my-4" />
      <button
        type="button"
        onClick={onAssistant}
        className="press flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-[15px] font-medium text-ink-2 transition-colors hover:bg-surface-2/60 hover:text-ink"
      >
        <Sparkles className="size-5 text-foil" strokeWidth={1.8} aria-hidden />
        {t('assistant.title')}
      </button>

      <div className="mt-auto flex items-center justify-between rounded-2xl border border-line px-4 py-2">
        <span className="text-[13px] text-ink-3">{t('settings.hideAmounts')}</span>
        <PrivacyButton className="-me-2 text-ink-2 hover:bg-surface-2" />
      </div>
    </aside>
  );
}
