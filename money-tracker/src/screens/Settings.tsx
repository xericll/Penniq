import {
  Award,
  Bell,
  FileDown,
  Gem,
  Lock,
  Share2,
  Star,
  Wand2,
  Zap,
  CalendarClock,
  Check,
  ChevronLeft,
  Cloud,
  CloudAlert,
  CloudOff,
  Coins,
  EyeOff,
  HardDrive,
  Landmark,
  LifeBuoy,
  ListChecks,
  ListPlus,
  LogIn,
  LogOut,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Split,
  Trash2,
  UserRound,
  Wallet,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useAppLock } from '../components/lock/AppLock';
import { useShareApp } from '../components/planner/ShareRate';
import { DeleteAccountSheet, SignOutSheet } from '../components/sheets/CloudSheets';
import { useReminderSummary } from '../components/sheets/RemindersSheet';
import { supportAvailable } from '../components/sheets/SupportSheet';
import { Logo } from '../components/ui/Logo';
import { Money } from '../components/ui/Money';
import { Segmented } from '../components/ui/Segmented';
import { SocialIcon } from '../components/ui/SocialIcon';
import { Switch } from '../components/ui/Switch';
import { useI18n } from '../i18n/LanguageContext';
import { LANGUAGES, type Language } from '../i18n/types';
import { APP_VERSION } from '../lib/boot';
import { currencyName } from '../lib/currency';
import { haptic } from '../lib/haptics';
import { SOCIAL_LINKS } from '../lib/links';
import { useAuth } from '../state/AuthContext';
import { usePlanner } from '../state/PlannerContext';
import { usePrivacy } from '../state/PrivacyContext';
import { useReminders } from '../state/RemindersContext';
import { useToast } from '../state/ToastContext';
import { useTools } from '../state/ToolsContext';
import { useWallet } from '../state/WalletContext';
import { AUTO_EDITIONS, EDITIONS, useTheme, type EditionId, type ThemePref } from '../theme/ThemeContext';
import type { AccountType, QuickAmounts } from '../types';
import { ScreenHeader } from './ScreenHeader';

interface SettingsProps {
  onEditList: (kind: 'income' | 'expense') => void;
  onCorrect: (account: AccountType) => void;
  onReset: () => void;
  onCurrency: () => void;
  onReminders: () => void;
  onAssistant: () => void;
  onSupport: () => void;
}

export function Settings({ onEditList, onCorrect, onReset, onCurrency, onReminders, onAssistant, onSupport }: SettingsProps) {
  const { t, lang, setLang, currency, currencySymbol } = useI18n();
  const { pref, setPref } = useTheme();
  const { hidden, setHidden } = usePrivacy();
  const { incomeSources, expenseSources, balances, cloud } = useWallet();
  const auth = useAuth();
  const tools = useTools();
  const lock = useAppLock();
  const { prefs, setPrefs, templates, rules } = usePlanner();
  const shareApp = useShareApp();

  return (
    <div className="space-y-6">
      <ScreenHeader title={t('settings.title')} />

      {auth.enabled && <AccountGroup />}

      <Group title={t('settings.appearance')} hint={t('settings.appearanceHint')}>
        <div className="space-y-3.5 p-3">
          <AutoEdition active={pref === 'auto'} onSelect={() => setPref('auto')} />
          <div className="grid grid-cols-3 gap-x-2.5 gap-y-3 sm:gap-x-3">
            {EDITIONS.map((e) => (
              <EditionTile key={e.id} id={e.id} label={t(e.labelKey)} active={pref === e.id} onSelect={setPref} />
            ))}
          </div>
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

      <Group title={t('settings.currency')} hint={t('currency.note')}>
        <Row
          icon={<Coins className="size-[18px]" />}
          label={currencyName(currency, lang)}
          hint={currency}
          trailing={
            <span className="font-display text-[17px] text-foil" dir="ltr">
              {currencySymbol}
            </span>
          }
          onClick={onCurrency}
          chevron
        />
      </Group>

      <RemindersGroup onOpen={onReminders} />

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
        <Row
          icon={<Lock className="size-[18px]" />}
          label={t('lock.settingsTitle')}
          hint={lock.config ? t('lock.onHint', { after: t(`lock.timeout.${lock.config.timeout}`) }) : t('lock.offHint')}
          onClick={() => tools.open({ name: 'lock' })}
          chevron
        />
      </Group>

      <Group title={t('settings.tools')} hint={t('settings.toolsHint')}>
        <Row
          icon={<Zap className="size-[18px]" />}
          label={t('templates.title')}
          hint={templates.length ? t('settings.items', { count: templates.length }) : t('templates.rowHint')}
          onClick={() => tools.open({ name: 'templates' })}
          chevron
        />
        <Row
          icon={<Wand2 className="size-[18px]" />}
          label={t('rules.title')}
          hint={rules.length ? t('rules.rowCount', { count: rules.filter((r) => r.enabled).length }) : t('rules.rowHint')}
          onClick={() => tools.open({ name: 'rules' })}
          chevron
        />
        <Row
          icon={<Split className="size-[18px]" />}
          label={t('split.title')}
          hint={t('split.hint')}
          onClick={() => tools.open({ name: 'splitRules' })}
          chevron
        />
        <Row
          icon={<CalendarClock className="size-[18px]" />}
          label={t('recurring.title')}
          hint={t('recurring.hint')}
          onClick={() => tools.open({ name: 'recurring' })}
          chevron
        />
      </Group>

      <Group title={t('settings.display')}>
        <Row
          icon={<Gem className="size-[18px]" />}
          label={t('settings.netWorth')}
          hint={t('settings.netWorthHint')}
          onClick={() => setPrefs({ netWorth: !prefs.netWorth })}
          trailing={<Switch on={prefs.netWorth} />}
          role="switch"
          checked={prefs.netWorth}
        />
        <Row
          icon={<Award className="size-[18px]" />}
          label={t('settings.levels')}
          hint={t('settings.levelsHint')}
          onClick={() => setPrefs({ levels: !prefs.levels })}
          trailing={<Switch on={prefs.levels} />}
          role="switch"
          checked={prefs.levels}
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
          icon={<FileDown className="size-[18px]" />}
          label={t('report.title')}
          hint={t('report.rowHint')}
          onClick={() => tools.open({ name: 'report' })}
          chevron
        />
        <Row
          icon={<RotateCcw className="size-[18px]" />}
          label={t('settings.reset')}
          hint={t('settings.resetHint')}
          onClick={onReset}
          danger
          chevron
        />
        <div className="flex items-center gap-3 px-4 py-3.5 text-[13px] text-ink-3">
          {cloud.linked ? <Cloud className="size-4 shrink-0" aria-hidden /> : <HardDrive className="size-4 shrink-0" aria-hidden />}
          {t(cloud.linked ? 'settings.cloud' : 'settings.local')}
        </div>
      </Group>

      <Group title={t('settings.help')}>
        <Row
          icon={<Sparkles className="size-[18px]" />}
          label={t('assistant.title')}
          hint={t('assistant.rowHint')}
          onClick={onAssistant}
          chevron
        />
        <Row
          icon={<Share2 className="size-[18px] rtl:-scale-x-100" />}
          label={t('share.title')}
          hint={t('share.hint')}
          onClick={() => void shareApp()}
          chevron
        />
        <Row
          icon={<Star className="size-[18px]" />}
          label={t('rate.title')}
          hint={t('rate.hint')}
          onClick={() => tools.open({ name: 'rate' })}
          chevron
        />
        {supportAvailable(auth.enabled) && (
          <Row
            icon={<LifeBuoy className="size-[18px]" />}
            label={t('support.title')}
            hint={t('support.rowHint')}
            onClick={onSupport}
            chevron
          />
        )}
      </Group>

      <SocialGroup />

      <footer className="flex flex-col items-center gap-2 pt-2 pb-4 text-center">
        <Logo size={24} />
        <p className="text-[13px] text-ink-3">{t('app.tagline')}</p>
        <p className="serial text-ink-3" dir="ltr">
          MINT EDITION · v{APP_VERSION}
        </p>
      </footer>
    </div>
  );
}

/** Who is signed in, how the sync is doing, and the ways out. */
function AccountGroup() {
  const { t } = useI18n();
  const { user, askToSignIn } = useAuth();
  const { cloud } = useWallet();
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!user && !cloud.linked) {
    return (
      <Group title={t('settings.account')}>
        <Row
          icon={<LogIn className="size-[18px] rtl:-scale-x-100" />}
          label={t('cloud.signIn')}
          hint={t('cloud.signInHint')}
          onClick={askToSignIn}
          chevron
        />
      </Group>
    );
  }

  const state = {
    idle: { text: t('cloud.synced'), icon: <Cloud className="size-[18px] text-in" aria-hidden /> },
    syncing: { text: t('cloud.syncing'), icon: <RefreshCw className="size-[18px] animate-spin text-ink-3" aria-hidden /> },
    offline: { text: t('cloud.offline'), icon: <CloudOff className="size-[18px] text-ink-3" aria-hidden /> },
    error: { text: t('cloud.error'), icon: <CloudAlert className="size-[18px] text-out" aria-hidden /> },
  }[cloud.status];
  const waiting = cloud.status !== 'syncing' && cloud.status !== 'error' && cloud.pending > 0;

  return (
    <Group title={t('settings.account')}>
      <Row
        icon={<UserRound className="size-[18px]" />}
        label={user?.email || t('cloud.account')}
        hint={waiting ? t('cloud.pending', { count: cloud.pending }) : state.text}
        trailing={state.icon}
        onClick={() => void cloud.sync()}
      />
      {user && (
        <>
          <Row
            icon={<LogOut className="size-[18px] rtl:-scale-x-100" />}
            label={t('cloud.signOut')}
            onClick={() => setLeaving(true)}
            chevron
          />
          <Row
            icon={<Trash2 className="size-[18px]" />}
            label={t('cloud.delete')}
            hint={t('cloud.delete.hint')}
            onClick={() => setDeleting(true)}
            danger
            chevron
          />
        </>
      )}
      <SignOutSheet open={leaving} onClose={() => setLeaving(false)} />
      <DeleteAccountSheet open={deleting} onClose={() => setDeleting(false)} />
    </Group>
  );
}

/** The switch, and (once it is on) the way to the days and times. */
function RemindersGroup({ onOpen }: { onOpen: () => void }) {
  const { t } = useI18n();
  const { config, enable, disable } = useReminders();
  const toast = useToast();
  const summary = useReminderSummary();

  const toggle = async () => {
    if (config.enabled) return disable();
    const permission = await enable();
    if (permission !== 'granted') {
      toast.show({ message: t(permission === 'unsupported' ? 'reminder.perm.unsupported' : 'reminder.perm.denied'), duration: 7000 });
    }
  };

  return (
    <Group title={t('settings.reminders')} hint={t('reminder.groupHint')}>
      <Row
        icon={<Bell className="size-[18px]" />}
        label={t('reminder.enable')}
        hint={config.enabled ? t('reminder.on') : t('reminder.off')}
        onClick={() => void toggle()}
        trailing={<Switch on={config.enabled} />}
        role="switch"
        checked={config.enabled}
      />
      {config.enabled && (
        <Row
          icon={<CalendarClock className="size-[18px]" />}
          label={t('reminder.schedule')}
          hint={summary(config)}
          onClick={onOpen}
          chevron
        />
      )}
    </Group>
  );
}

/** Links to the accounts of Penniq. Until the first one exists the icons are shown as "soon". */
function SocialGroup() {
  const { t } = useI18n();
  const live = SOCIAL_LINKS.filter((link) => link.url);

  return (
    <section>
      <div className="mb-2 px-1">
        <h2 className="eyebrow">{t('settings.social')}</h2>
        <p className="mt-0.5 text-[13px] text-ink-3">{t(live.length ? 'social.hint' : 'social.soon')}</p>
      </div>
      <div className={`card flex flex-wrap justify-center p-4 ${live.length ? 'gap-3' : 'gap-1 sm:gap-3'}`}>
        {live.length
          ? live.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.name}
                title={link.name}
                className="press grid size-12 place-items-center rounded-full border border-line-strong text-ink-2 hover:border-foil hover:text-foil"
              >
                <SocialIcon id={link.id} className="size-5" />
              </a>
            ))
          : SOCIAL_LINKS.map((link) => (
              <span
                key={link.id}
                title={link.name}
                className="grid size-10 place-items-center rounded-full border border-line text-ink-3 opacity-70 sm:size-12"
              >
                <SocialIcon id={link.id} className="size-5" />
              </span>
            ))}
      </div>
    </section>
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
      className="press flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-start hover:bg-surface-2/60"
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-xl ${danger ? 'text-out' : 'text-ink-2'}`}
        style={{ background: danger ? 'color-mix(in oklab, var(--out) 14%, transparent)' : 'var(--surface-2)' }}
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

/** A tiny banknote wearing one edition: its own page, note and metal, whatever edition the app is in. */
function Swatch({ id, clip }: { id: EditionId; clip?: string }) {
  return (
    <span data-edition={id} className="absolute inset-0" style={{ background: 'var(--bg)', clipPath: clip }}>
      <span
        className="absolute inset-x-[13%] top-[20%] bottom-[20%] rounded-md"
        style={{
          background: 'radial-gradient(130% 110% at 100% 0%, var(--note-bg-2) 0%, var(--note-bg) 72%)',
          boxShadow: 'inset 0 0 0 1px var(--note-line)',
        }}
      >
        <span
          className="absolute end-[13%] top-1/2 aspect-square h-[58%] -translate-y-1/2 rounded-full"
          style={{
            boxShadow:
              'inset 0 0 0 1.5px var(--note-foil), inset 0 0 0 4px var(--note-bg-2), inset 0 0 0 5px color-mix(in oklab, var(--note-foil) 55%, transparent)',
          }}
        />
        <span className="absolute start-[13%] top-[28%] h-[11%] w-[34%] rounded-full" style={{ background: 'var(--note-foil)' }} />
        <span
          className="absolute start-[13%] top-[52%] h-[8%] w-[22%] rounded-full opacity-60"
          style={{ background: 'var(--note-ink-2)' }}
        />
      </span>
      <span className="absolute inset-x-[13%] bottom-[7%] h-[5%] rounded-full" style={{ background: 'var(--foil)' }} />
    </span>
  );
}

/** "Follow the device": the light edition by day, the dark one at night. */
function AutoEdition({ active, onSelect }: { active: boolean; onSelect: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => {
        haptic('select');
        onSelect();
      }}
      className={`press flex w-full items-center gap-3 rounded-2xl border p-2 text-start ${active ? 'border-foil' : 'border-line hover:border-line-strong'}`}
    >
      <span className="relative block h-[52px] w-[70px] shrink-0 overflow-hidden rounded-xl">
        <Swatch id={AUTO_EDITIONS.light} clip="polygon(0 0, 100% 0, 0 100%)" />
        <Swatch id={AUTO_EDITIONS.dark} clip="polygon(100% 0, 100% 100%, 0 100%)" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{t('theme.auto')}</span>
        <span className="mt-0.5 block text-[13px] text-ink-3">{t('theme.autoHint')}</span>
      </span>
      <span
        className={`me-1.5 grid size-6 shrink-0 place-items-center rounded-full ${active ? 'bg-foil text-on-foil' : 'border border-line-strong'}`}
        aria-hidden
      >
        {active && <Check className="size-3.5" strokeWidth={3} />}
      </span>
    </button>
  );
}

function EditionTile({
  id,
  label,
  active,
  onSelect,
}: {
  id: EditionId;
  label: string;
  active: boolean;
  onSelect: (id: ThemePref) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => {
        haptic('select');
        onSelect(id);
      }}
      className="press group flex min-w-0 flex-col items-center gap-1.5 rounded-xl"
    >
      <span
        className={`relative block aspect-[4/3] w-full overflow-hidden rounded-xl transition-shadow ${active ? '' : 'group-hover:ring-1 group-hover:ring-line-strong'}`}
        style={{ boxShadow: active ? '0 0 0 2px var(--surface), 0 0 0 4px var(--foil)' : 'inset 0 0 0 1px var(--line)' }}
      >
        <Swatch id={id} />
        {active && (
          <span className="absolute end-1 top-1 grid size-4 place-items-center rounded-full bg-foil text-on-foil sm:end-1.5 sm:top-1.5 sm:size-5">
            <Check className="size-2.5 sm:size-3" strokeWidth={3.5} />
          </span>
        )}
      </span>
      <span className={`max-w-full truncate text-[12px] sm:text-[13px] ${active ? 'font-semibold text-ink' : 'text-ink-2'}`}>{label}</span>
    </button>
  );
}

function QuickAmountsEditor() {
  const { t, accountName, currencySymbol } = useI18n();
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
                className={`field text-center tabular ${currencySymbol.length === 1 ? 'pe-9' : ''}`}
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
              {/* These fields are narrow: a longer symbol ("IQD", "د.ع") would sit on the digits. */}
              {currencySymbol.length === 1 && (
                <span className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-[14px] text-ink-3">
                  {currencySymbol}
                </span>
              )}
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
        <button type="submit" className="foil press min-h-12 w-full rounded-2xl text-[15px] font-semibold">
          {t('common.save')}
        </button>
      )}
    </form>
  );
}

function toDraft(q: QuickAmounts) {
  return { cash: q.cash.map(String) as [string, string], bank: q.bank.map(String) as [string, string] };
}
