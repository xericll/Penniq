import { motion } from 'motion/react';
import { Check, ChevronLeft, EyeOff, HardDrive, Landmark, ListChecks, ListPlus, RotateCcw, Wallet } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Logo } from '../components/ui/Logo';
import { Money } from '../components/ui/Money';
import { Segmented } from '../components/ui/Segmented';
import { useI18n } from '../i18n/LanguageContext';
import { LANGUAGES, type Language } from '../i18n/types';
import { haptic } from '../lib/haptics';
import { usePrivacy } from '../state/PrivacyContext';
import { useToast } from '../state/ToastContext';
import { useWallet } from '../state/WalletContext';
import { EDITIONS, useTheme, type Edition, type ThemePref } from '../theme/ThemeContext';
import type { AccountType, QuickAmounts } from '../types';
import { ScreenHeader } from './ScreenHeader';

interface SettingsProps {
  onEditList: (kind: 'income' | 'expense') => void;
  onCorrect: (account: AccountType) => void;
  onReset: () => void;
}

export function Settings({ onEditList, onCorrect, onReset }: SettingsProps) {
  const { t, lang, setLang } = useI18n();
  const { pref, setPref } = useTheme();
  const { hidden, setHidden } = usePrivacy();
  const { incomeSources, expenseSources, balances } = useWallet();

  return (
    <div className="space-y-6">
      <ScreenHeader title={t('settings.title')} />

      <Group title={t('settings.appearance')} hint={t('settings.appearanceHint')}>
        <div className="grid grid-cols-3 gap-2.5 p-3 sm:grid-cols-4">
          <EditionTile id="auto" label={t('theme.auto')} active={pref === 'auto'} onSelect={setPref} />
          {EDITIONS.map((e) => (
            <EditionTile key={e.id} id={e.id} edition={e} label={t(e.labelKey)} active={pref === e.id} onSelect={setPref} />
          ))}
        </div>
      </Group>

      <Group title={t('settings.language')}>
        <div className="p-3">
          <Segmented
            label={t('settings.language')}
            value={lang}
            onChange={(v: Language) => setLang(v)}
            options={(Object.keys(LANGUAGES) as Language[]).map((l) => ({
              value: l,
              label: <span lang={l}>{LANGUAGES[l].nativeName}</span>,
            }))}
            size="lg"
          />
        </div>
      </Group>

      <Group title={t('settings.privacy')}>
        <Row
          icon={<EyeOff className="size-[18px]" />}
          label={t('settings.hideAmounts')}
          hint={t('privacy.hint')}
          onClick={() => setHidden(!hidden)}
          trailing={<Switch on={hidden} />}
          role="switch"
          checked={hidden}
        />
      </Group>

      <Group title={t('settings.quick')} hint={t('settings.quickHint')}>
        <QuickAmountsEditor />
      </Group>

      <Group title={t('settings.lists')}>
        <Row
          icon={<ListPlus className="size-[18px]" />}
          label={t('settings.incomeSources')}
          hint={t('settings.items', { count: incomeSources.length })}
          onClick={() => onEditList('income')}
          chevron
        />
        <Row
          icon={<ListChecks className="size-[18px]" />}
          label={t('settings.expenseReasons')}
          hint={t('settings.items', { count: expenseSources.length })}
          onClick={() => onEditList('expense')}
          chevron
        />
      </Group>

      <Group title={t('settings.balances')}>
        <Row
          icon={<Wallet className="size-[18px]" />}
          label={t('settings.correctCash')}
          trailing={<Money value={balances.cash} className="text-[14px] text-ink-2" />}
          onClick={() => onCorrect('cash')}
          chevron
        />
        <Row
          icon={<Landmark className="size-[18px]" />}
          label={t('settings.correctBank')}
          trailing={<Money value={balances.bank} className="text-[14px] text-ink-2" />}
          onClick={() => onCorrect('bank')}
          chevron
        />
      </Group>

      <Group title={t('settings.data')}>
        <Row
          icon={<RotateCcw className="size-[18px]" />}
          label={t('settings.reset')}
          hint={t('settings.resetHint')}
          onClick={onReset}
          danger
          chevron
        />
        <div className="flex items-center gap-3 px-4 py-3.5 text-[13px] text-ink-3">
          <HardDrive className="size-4 shrink-0" aria-hidden />
          {t('settings.local')}
        </div>
      </Group>

      <footer className="flex flex-col items-center gap-2 pt-2 pb-4 text-center">
        <Logo size={32} />
        <p className="text-[13px] text-ink-3">{t('app.tagline')}</p>
        <p className="serial text-ink-3" dir="ltr">
          SOFT GLASS · v3.0
        </p>
      </footer>
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 px-1">
        <h2 className="eyebrow">{title}</h2>
        {hint && <p className="mt-0.5 text-[13px] text-ink-3">{hint}</p>}
      </div>
      <div className="card divide-y divide-line overflow-hidden">{children}</div>
    </section>
  );
}

function Row({
  icon,
  label,
  hint,
  trailing,
  onClick,
  chevron,
  danger,
  role,
  checked,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  trailing?: ReactNode;
  onClick: () => void;
  chevron?: boolean;
  danger?: boolean;
  role?: 'switch';
  checked?: boolean;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role ? checked : undefined}
      onClick={onClick}
      className="press flex min-h-[62px] w-full items-center gap-3 px-4 py-3 text-start hover:bg-white/20"
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-full ${danger ? 'text-out' : 'text-ink-2'}`}
        style={{
          background: danger ? 'color-mix(in oklab, var(--out) 14%, transparent)' : 'var(--surface-2)',
          boxShadow: 'inset 0 1px 0 var(--rim)',
        }}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-medium ${danger ? 'text-out' : ''}`}>{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-ink-3">{hint}</span>}
      </span>
      {trailing}
      {chevron && <ChevronLeft className="size-4 shrink-0 text-ink-3 ltr:rotate-180" aria-hidden />}
    </button>
  );
}

/** Liquid toggle: the knob stretches like a droplet while it slides across. */
function Switch({ on }: { on: boolean }) {
  const id = useId();
  const settled = useRef(false);
  useEffect(() => {
    settled.current = true;
  }, []);
  return (
    <span
      className={`inset relative inline-flex h-[30px] w-[52px] shrink-0 items-center rounded-full p-[3px] transition-colors duration-300 ${on ? '!bg-accent' : ''}`}
      aria-hidden
    >
      <motion.span
        key={String(on)}
        layoutId={`knob-${id}`}
        className={`glass-pill h-6 w-6 rounded-full ${on ? 'ms-auto' : ''}`}
        animate={settled.current ? { scaleX: [1, 1.45, 0.92, 1], scaleY: [1, 0.82, 1.06, 1] } : undefined}
        transition={{
          layout: { type: 'spring', stiffness: 520, damping: 30 },
          scaleX: { duration: 0.5, times: [0, 0.35, 0.7, 1] },
          scaleY: { duration: 0.5, times: [0, 0.35, 0.7, 1] },
        }}
      />
    </span>
  );
}

function EditionTile({
  id,
  edition,
  label,
  active,
  onSelect,
}: {
  id: ThemePref;
  edition?: Edition;
  label: string;
  active: boolean;
  onSelect: (id: ThemePref) => void;
}) {
  const { t } = useI18n();
  const auto = !edition;
  const light = EDITIONS[0].preview;
  const dark = EDITIONS[EDITIONS.length - 1].preview;
  const p = edition?.preview ?? light;
  const isDark = edition?.dark ?? false;

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => {
        haptic('select');
        onSelect(id);
      }}
      className="press group flex flex-col items-center gap-1.5 rounded-2xl p-1"
    >
      <span
        className="relative block aspect-[4/3] w-full overflow-hidden rounded-[18px] transition-shadow"
        style={{
          background: auto
            ? `linear-gradient(135deg, ${light.bg} 50%, ${dark.bg} 50%)`
            : `radial-gradient(circle at 20% 15%, ${p.blobs[0]}, transparent 60%), radial-gradient(circle at 85% 90%, ${p.blobs[1]}, transparent 60%), ${p.bg}`,
          boxShadow: active ? '0 0 0 2px var(--bg), 0 0 0 4px var(--accent)' : 'inset 0 0 0 1px var(--line)',
        }}
      >
        {/* A tiny glass card floating in the swatch */}
        <span
          className="absolute inset-x-[16%] top-[24%] bottom-[24%] rounded-[10px]"
          style={{
            background: isDark ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.55)',
            boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,.3)' : 'inset 0 1px 0 #fff, 0 6px 12px -6px rgba(0,0,0,.25)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <span className="absolute start-[14%] top-[26%] h-[12%] w-[40%] rounded-full" style={{ background: p.ink, opacity: 0.85 }} />
          <span className="absolute start-[14%] top-[52%] h-[9%] w-[26%] rounded-full" style={{ background: p.accent, opacity: 0.8 }} />
          <span
            className="absolute end-[12%] top-1/2 size-[30%] -translate-y-1/2 rounded-full"
            style={{ background: p.accent, opacity: 0.9 }}
          />
        </span>
        {active && (
          <span className="absolute end-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-accent text-on-accent">
            <Check className="size-3" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className={`text-[13px] ${active ? 'font-semibold text-ink' : 'text-ink-2'}`}>{label}</span>
      {auto && <span className="-mt-1.5 text-[11px] text-ink-3">{t('theme.autoHint')}</span>}
    </button>
  );
}

function QuickAmountsEditor() {
  const { t, accountName } = useI18n();
  const { quickAmounts, setQuickAmounts } = useWallet();
  const toast = useToast();
  const [draft, setDraft] = useState(() => toDraft(quickAmounts));
  const [error, setError] = useState(false);

  useEffect(() => setDraft(toDraft(quickAmounts)), [quickAmounts]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(quickAmounts));

  const save = () => {
    const nums = [...draft.cash, ...draft.bank].map((s) => parseFloat(s.replace(',', '.')));
    if (!nums.every((n) => Number.isFinite(n) && n > 0)) {
      setError(true);
      haptic('warning');
      return;
    }
    setError(false);
    const next: QuickAmounts = { cash: [nums[0], nums[1]], bank: [nums[2], nums[3]] };
    setQuickAmounts(next);
    haptic('success');
    toast.show({ message: t('toast.saved') });
  };

  return (
    <form
      className="space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {(['cash', 'bank'] as const).map((a) => (
        <div key={a} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-[15px] font-medium">{accountName(a)}</span>
          {[0, 1].map((i) => (
            <label key={i} className="relative flex-1" dir="ltr">
              <span className="sr-only">
                {accountName(a)} {i + 1}
              </span>
              <input
                className="field pe-9 text-center tabular"
                inputMode="decimal"
                dir="ltr"
                value={draft[a][i]}
                aria-invalid={error}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft((d) => {
                    const pair = [...d[a]] as [string, string];
                    pair[i] = v;
                    return { ...d, [a]: pair };
                  });
                }}
              />
              <span className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-[14px] text-ink-3">€</span>
            </label>
          ))}
        </div>
      ))}
      {error && (
        <p role="alert" className="text-[13px] font-medium text-out">
          {t('settings.quickInvalid')}
        </p>
      )}
      {dirty && (
        <button type="submit" className="btn-primary press min-h-[52px] w-full rounded-full text-[15px] font-semibold">
          {t('common.save')}
        </button>
      )}
    </form>
  );
}

function toDraft(q: QuickAmounts) {
  return { cash: q.cash.map(String) as [string, string], bank: q.bank.map(String) as [string, string] };
}
