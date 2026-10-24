import { AnimatePresence, motion } from 'motion/react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ComposerIntent } from './components/composer/Composer';
import { LockProvider } from './components/lock/AppLock';
import { Rail, TabBar } from './components/nav/Navigation';
import { Watchers } from './components/planner/Watchers';
import { Splash } from './components/Splash';
import { useKeyboardViewport } from './hooks/useKeyboardViewport';
import { useToday } from './hooks/useToday';
import { useI18n } from './i18n/LanguageContext';
import { onLaunchAction, takeLaunchAction } from './lib/launch';
import { useAuth } from './state/AuthContext';
import { usePlanner } from './state/PlannerContext';
import { ToolsContext, type Tool, type ToolsValue } from './state/ToolsContext';
import { useReminderNudges } from './state/RemindersContext';
import { useWallet } from './state/WalletContext';
import { AuthScreen } from './screens/AuthScreen';
import { Home } from './screens/Home';
import type { AccountType, Tab, Transaction, TransactionType } from './types';

/* The first screen loads only what it shows. The other tabs and every window (sheet) are separate
   chunks: the windows arrive right after the first paint, the tabs when they are opened. */
const Composer = lazy(() => import('./components/composer/Composer').then((m) => ({ default: m.Composer })));
const AccountSheet = lazy(() => import('./components/sheets/AccountSheet').then((m) => ({ default: m.AccountSheet })));
const AssistantSheet = lazy(() => import('./components/sheets/AssistantSheet').then((m) => ({ default: m.AssistantSheet })));
const AdoptSheet = lazy(() => import('./components/sheets/CloudSheets').then((m) => ({ default: m.AdoptSheet })));
const CorrectBalanceSheet = lazy(() => import('./components/sheets/BalanceSheets').then((m) => ({ default: m.CorrectBalanceSheet })));
const OpeningSheet = lazy(() => import('./components/sheets/BalanceSheets').then((m) => ({ default: m.OpeningSheet })));
const CurrencySheet = lazy(() => import('./components/sheets/CurrencySheet').then((m) => ({ default: m.CurrencySheet })));
const DebtsSheet = lazy(() => import('./components/sheets/DebtSheets').then((m) => ({ default: m.DebtsSheet })));
const EditSheet = lazy(() => import('./components/sheets/EditSheet').then((m) => ({ default: m.EditSheet })));
const EssentialsSheet = lazy(() => import('./components/sheets/EssentialsSheets').then((m) => ({ default: m.EssentialsSheet })));
const ReceiptSheet = lazy(() => import('./components/sheets/ReceiptSheet').then((m) => ({ default: m.ReceiptSheet })));
const RemindersSheet = lazy(() => import('./components/sheets/RemindersSheet').then((m) => ({ default: m.RemindersSheet })));
const ResetSheet = lazy(() => import('./components/sheets/ResetSheet').then((m) => ({ default: m.ResetSheet })));
const SourcesSheet = lazy(() => import('./components/sheets/SourcesSheet').then((m) => ({ default: m.SourcesSheet })));
const SupportSheet = lazy(() => import('./components/sheets/SupportSheet').then((m) => ({ default: m.SupportSheet })));
const VaultSheet = lazy(() => import('./components/sheets/VaultSheets').then((m) => ({ default: m.VaultSheet })));
const Activity = lazy(() => import('./screens/Activity').then((m) => ({ default: m.Activity })));
const Insights = lazy(() => import('./screens/Insights').then((m) => ({ default: m.Insights })));
const Settings = lazy(() => import('./screens/Settings').then((m) => ({ default: m.Settings })));
const Wealth = lazy(() => import('./screens/Wealth').then((m) => ({ default: m.Wealth })));
// The planning tools (assets, goals, quick buttons, recurring payments, rules, reports, lock…).
const AssetSheet = lazy(() => import('./components/wealth/AssetSheet').then((m) => ({ default: m.AssetSheet })));
const GoalSheet = lazy(() => import('./components/wealth/GoalSheets').then((m) => ({ default: m.GoalSheet })));
const GoalDepositSheet = lazy(() => import('./components/wealth/GoalSheets').then((m) => ({ default: m.GoalDepositSheet })));
const TemplatesSheet = lazy(() => import('./components/planner/Templates').then((m) => ({ default: m.TemplatesSheet })));
const RecurringSheet = lazy(() => import('./components/planner/RecurringSheet').then((m) => ({ default: m.RecurringSheet })));
const SplitRulesSheet = lazy(() => import('./components/planner/SplitSheets').then((m) => ({ default: m.SplitRulesSheet })));
const SplitSheet = lazy(() => import('./components/planner/SplitSheets').then((m) => ({ default: m.SplitSheet })));
const RulesSheet = lazy(() => import('./components/planner/RulesSheet').then((m) => ({ default: m.RulesSheet })));
const WhatIfSheet = lazy(() => import('./components/planner/WhatIfSheet').then((m) => ({ default: m.WhatIfSheet })));
const ReportSheet = lazy(() => import('./components/planner/ReportSheet').then((m) => ({ default: m.ReportSheet })));
const RateSheet = lazy(() => import('./components/planner/ShareRate').then((m) => ({ default: m.RateSheet })));
const AchievementSheet = lazy(() => import('./components/planner/AchievementSheet').then((m) => ({ default: m.AchievementSheet })));
const ScanSheet = lazy(() => import('./components/planner/ScanSheet').then((m) => ({ default: m.ScanSheet })));
const LockSetupSheet = lazy(() => import('./components/lock/AppLock').then((m) => ({ default: m.LockSetupSheet })));

/** Renders its children only once the browser is idle after the first paint. */
function AfterFirstPaint({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const id = idle
      ? idle(
          () => {
            setReady(true);
            // The other tabs arrive quietly in the background, so opening them is instant.
            void import('./screens/Activity');
            void import('./screens/Insights');
            void import('./screens/Settings');
            void import('./screens/Wealth');
          },
          { timeout: 1500 },
        )
      : window.setTimeout(() => setReady(true), 600);
    return () => {
      if (!idle) window.clearTimeout(id);
    };
  }, []);
  return ready ? <>{children}</> : null;
}

const TABS: Tab[] = ['home', 'activity', 'wealth', 'insights', 'settings'];

function tabFromHash(): Tab {
  const h = window.location.hash.replace(/^#\/?/, '') as Tab;
  return TABS.includes(h) ? h : 'home';
}

/** Tabs live in the URL hash so the back button, reloads and deep links all work. */
function useHashTab(): [Tab, (t: Tab) => void] {
  const [tab, setTabState] = useState<Tab>(tabFromHash);
  const scrolls = useRef<Partial<Record<Tab, number>>>({});

  useEffect(() => {
    const onPop = () => setTabState(tabFromHash());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  const setTab = useCallback((next: Tab) => {
    setTabState((current) => {
      if (current === next) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return current;
      }
      scrolls.current[current] = window.scrollY;
      try {
        window.history.pushState(null, '', next === 'home' ? '#home' : `#${next}`);
      } catch {
        // History is unavailable in some embedded frames; tabs still work in memory.
      }
      return next;
    });
  }, []);

  // Restore each tab's scroll position when returning to it.
  useEffect(() => {
    const y = scrolls.current[tab] ?? 0;
    requestAnimationFrame(() => window.scrollTo({ top: y }));
  }, [tab]);

  return [tab, setTab];
}

export default function App() {
  const { t } = useI18n();
  const [tab, setTab] = useHashTab();
  const { isKeyboardOpen } = useKeyboardViewport();
  const { saveFailed } = useWallet();
  const auth = useAuth();
  // Remount the screen when the date changes so "today" figures never go stale.
  const today = useToday();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Sheets
  const [composerOpen, setComposerOpen] = useState(false);
  const [intent, setIntent] = useState<ComposerIntent>({ type: 'expense' });
  const [account, setAccount] = useState<AccountType | null>(null);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [listKind, setListKind] = useState<'income' | 'expense' | null>(null);
  const [correcting, setCorrecting] = useState<AccountType | null>(null);
  const [opening, setOpening] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [debtsOpen, setDebtsOpen] = useState(false);
  const [essentialsOpen, setEssentialsOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [activityFocus, setActivityFocus] = useState<{ account: AccountType; nonce: number } | null>(null);

  // The planning tools: one window at a time. The last payload of each is kept so a window
  // still shows its content while it slides away.
  const [tool, setTool] = useState<Tool | null>(null);
  const lastTool = useRef<Partial<Record<Tool['name'], Tool>>>({});
  if (tool) lastTool.current[tool.name] = tool;
  const tools = useMemo<ToolsValue>(() => ({ open: setTool, close: () => setTool(null) }), []);
  // Development only: lets the browser checks open any tool window.
  if (import.meta.env.DEV) (window as Window & { __tools?: ToolsValue }).__tools = tools;
  const kept = <N extends Tool['name']>(name: N) => lastTool.current[name] as Extract<Tool, { name: N }> | undefined;
  const { allocation } = usePlanner();

  // Move focus to the new screen for keyboard and screen-reader users.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [tab]);

  const compose = useCallback((type: TransactionType, acc?: AccountType, amount?: number) => {
    setIntent({
      type,
      account: acc,
      amount,
      direction: type === 'transfer' ? (acc === 'bank' ? 'bank_to_cash' : 'cash_to_bank') : undefined,
    });
    setAccount(null);
    setComposerOpen(true);
  }, []);

  const openTx = useCallback((tx: Transaction) => setReceipt(tx), []);

  // Home-screen shortcuts ("?do=expense") and, later, a native widget open a form directly.
  useEffect(() => {
    onLaunchAction((action) => compose(action));
    const action = takeLaunchAction();
    if (action) compose(action);
    return () => onLaunchAction(null);
  }, [compose]);
  const openAssistant = useCallback(() => setAssistantOpen(true), []);

  // Reminders only speak inside the wallet, never over the sign-in screen.
  const inWallet = auth.ready && !auth.needsAuth && !auth.recovering;
  useReminderNudges(inWallet, () => compose('expense'));

  const screen = {
    home: (
      <Home
        onCompose={(type, acc) => compose(type, acc)}
        onOpenAccount={setAccount}
        onOpenTx={openTx}
        onNavigate={setTab}
        onOpening={() => setOpening(true)}
        onVault={() => setVaultOpen(true)}
        onDebts={() => setDebtsOpen(true)}
        onEssentials={() => setEssentialsOpen(true)}
        onCurrency={() => setCurrencyOpen(true)}
        onAssistant={openAssistant}
      />
    ),
    activity: <Activity onOpenTx={openTx} onCompose={() => compose('expense')} focusAccount={activityFocus} />,
    insights: <Insights onAssistant={openAssistant} />,
    wealth: <Wealth />,
    settings: (
      <Settings
        onEditList={setListKind}
        onCorrect={setCorrecting}
        onReset={() => setResetting(true)}
        onCurrency={() => setCurrencyOpen(true)}
        onReminders={() => setRemindersOpen(true)}
        onAssistant={openAssistant}
        onSupport={() => setSupportOpen(true)}
      />
    ),
  }[tab];

  const wide = tab === 'home' || tab === 'insights' || tab === 'wealth';

  // Signed out, or choosing a new password. While the saved session is still being read
  // the page stays empty under the splash instead of flashing the wrong screen.
  if (!inWallet) {
    return (
      <>
        {auth.ready && <AuthScreen />}
        {/* Same key as below, so signing in does not replay the splash. */}
        <Splash key="splash" />
      </>
    );
  }

  return (
    <ToolsContext.Provider value={tools}>
      <LockProvider>
        <a
          href="#main"
          className="sr-only z-[90] rounded-xl bg-ink px-4 py-2 text-bg focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
        >
          {t('nav.skip')}
        </a>

        {saveFailed && (
          <div
            role="alert"
            className="fixed inset-x-0 top-0 z-[80] bg-out px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-2.5 text-center text-[14px] font-medium text-bg"
          >
            {t('storage.failed')}
          </div>
        )}

        <Rail tab={tab} onTab={setTab} onNew={() => compose('expense')} onAssistant={openAssistant} />

        <main id="main" ref={mainRef} tabIndex={-1} className="outline-none lg:ps-[260px]">
          <div
            className={`mx-auto w-full px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+128px)] sm:px-6 lg:px-10 lg:pt-10 lg:pb-16 ${
              wide ? 'max-w-[560px] lg:max-w-[1080px]' : 'max-w-[560px] lg:max-w-[720px]'
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${tab}:${today}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
              >
                <Suspense fallback={null}>{screen}</Suspense>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        <TabBar tab={tab} onTab={setTab} onNew={() => compose('expense')} hidden={isKeyboardOpen} />

        {/* Sheets: loaded after the first paint */}
        <AfterFirstPaint>
          <Suspense fallback={null}>
            <Composer
              open={composerOpen}
              intent={intent}
              onClose={() => setComposerOpen(false)}
              onEditList={setListKind}
              suspended={listKind !== null}
              onIncome={(tx) => {
                if (allocation.enabled) window.setTimeout(() => setTool({ name: 'split', tx }), 450);
              }}
              onScan={(file) => {
                setComposerOpen(false);
                setTool({ name: 'scan', file });
              }}
            />
            <AccountSheet
              account={account}
              onClose={() => setAccount(null)}
              onCompose={compose}
              onCorrect={(a) => {
                setAccount(null);
                setCorrecting(a);
              }}
              onOpenTx={(tx) => {
                setAccount(null);
                setReceipt(tx);
              }}
              onSeeAll={(a) => {
                setAccount(null);
                setActivityFocus({ account: a, nonce: Date.now() });
                setTab('activity');
              }}
            />
            <ReceiptSheet
              tx={receipt}
              onClose={() => setReceipt(null)}
              onEdit={(tx) => {
                setReceipt(null);
                setEditing(tx);
              }}
            />
            <EditSheet tx={editing} onClose={() => setEditing(null)} />
            <SourcesSheet kind={listKind} onClose={() => setListKind(null)} />
            <CorrectBalanceSheet account={correcting} onClose={() => setCorrecting(null)} />
            <OpeningSheet open={opening} onClose={() => setOpening(false)} />
            <ResetSheet open={resetting} onClose={() => setResetting(false)} />
            <VaultSheet
              open={vaultOpen}
              onClose={() => setVaultOpen(false)}
              onOpenTx={(tx) => {
                setVaultOpen(false);
                setReceipt(tx);
              }}
            />
            <DebtsSheet open={debtsOpen} onClose={() => setDebtsOpen(false)} />
            <EssentialsSheet open={essentialsOpen} onClose={() => setEssentialsOpen(false)} />
            <CurrencySheet open={currencyOpen} onClose={() => setCurrencyOpen(false)} />
            <RemindersSheet open={remindersOpen} onClose={() => setRemindersOpen(false)} />
            <AssistantSheet open={assistantOpen} onClose={() => setAssistantOpen(false)} />
            <SupportSheet open={supportOpen} onClose={() => setSupportOpen(false)} />
            <AdoptSheet />
          </Suspense>
          <ToolSheets tool={tool} kept={kept} onClose={tools.close} />
          <Watchers active={inWallet} />
        </AfterFirstPaint>

        <Splash key="splash" />
      </LockProvider>
    </ToolsContext.Provider>
  );
}

/** Mounts each tool window the first time it is opened, so the others are never loaded until needed. */
function ToolSheets({
  tool,
  kept,
  onClose,
}: {
  tool: Tool | null;
  kept: <N extends Tool['name']>(name: N) => Extract<Tool, { name: N }> | undefined;
  onClose: () => void;
}) {
  const used = useRef(new Set<Tool['name']>());
  if (tool) used.current.add(tool.name);
  const is = (name: Tool['name']) => tool?.name === name;
  const has = (name: Tool['name']) => used.current.has(name);
  const achievement = kept('achievement');

  return (
    <Suspense fallback={null}>
      {has('asset') && <AssetSheet open={is('asset')} asset={kept('asset')?.asset ?? null} onClose={onClose} />}
      {has('goal') && <GoalSheet open={is('goal')} goal={kept('goal')?.goal ?? null} onClose={onClose} />}
      {has('goalDeposit') && <GoalDepositSheet goal={is('goalDeposit') ? (kept('goalDeposit')?.goal ?? null) : null} onClose={onClose} />}
      {has('templates') && <TemplatesSheet open={is('templates')} onClose={onClose} />}
      {has('recurring') && <RecurringSheet open={is('recurring')} onClose={onClose} />}
      {has('splitRules') && <SplitRulesSheet open={is('splitRules')} onClose={onClose} />}
      {has('split') && <SplitSheet tx={is('split') ? (kept('split')?.tx ?? null) : null} onClose={onClose} />}
      {has('rules') && <RulesSheet open={is('rules')} onClose={onClose} />}
      {has('whatIf') && <WhatIfSheet open={is('whatIf')} onClose={onClose} />}
      {has('report') && <ReportSheet open={is('report')} onClose={onClose} />}
      {has('rate') && <RateSheet open={is('rate')} onClose={onClose} />}
      {has('achievement') && (
        <AchievementSheet open={is('achievement')} initial={achievement?.kind} goalId={achievement?.goalId} onClose={onClose} />
      )}
      {has('scan') && <ScanSheet file={is('scan') ? (kept('scan')?.file ?? null) : null} onClose={onClose} />}
      {has('lock') && <LockSetupSheet open={is('lock')} onClose={onClose} />}
    </Suspense>
  );
}
