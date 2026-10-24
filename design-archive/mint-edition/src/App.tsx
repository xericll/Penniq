import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Composer, type ComposerIntent } from './components/composer/Composer';
import { Rail, TabBar } from './components/nav/Navigation';
import { AccountSheet } from './components/sheets/AccountSheet';
import { AssistantSheet } from './components/sheets/AssistantSheet';
import { AdoptSheet } from './components/sheets/CloudSheets';
import { CorrectBalanceSheet, OpeningSheet } from './components/sheets/BalanceSheets';
import { CurrencySheet } from './components/sheets/CurrencySheet';
import { DebtsSheet } from './components/sheets/DebtSheets';
import { EditSheet } from './components/sheets/EditSheet';
import { EssentialsSheet } from './components/sheets/EssentialsSheets';
import { ReceiptSheet } from './components/sheets/ReceiptSheet';
import { RemindersSheet } from './components/sheets/RemindersSheet';
import { ResetSheet } from './components/sheets/ResetSheet';
import { SourcesSheet } from './components/sheets/SourcesSheet';
import { SupportSheet } from './components/sheets/SupportSheet';
import { VaultSheet } from './components/sheets/VaultSheets';
import { Splash } from './components/Splash';
import { useKeyboardViewport } from './hooks/useKeyboardViewport';
import { useToday } from './hooks/useToday';
import { useI18n } from './i18n/LanguageContext';
import { useAuth } from './state/AuthContext';
import { useReminderNudges } from './state/RemindersContext';
import { useWallet } from './state/WalletContext';
import { Activity } from './screens/Activity';
import { AuthScreen } from './screens/AuthScreen';
import { Home } from './screens/Home';
import { Insights } from './screens/Insights';
import { Settings } from './screens/Settings';
import type { AccountType, Tab, Transaction, TransactionType } from './types';

const TABS: Tab[] = ['home', 'activity', 'insights', 'settings'];

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

  const wide = tab === 'home' || tab === 'insights';

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
    <>
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
              {screen}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <TabBar tab={tab} onTab={setTab} onNew={() => compose('expense')} hidden={isKeyboardOpen} />

      {/* Sheets */}
      <Composer
        open={composerOpen}
        intent={intent}
        onClose={() => setComposerOpen(false)}
        onEditList={setListKind}
        suspended={listKind !== null}
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

      <Splash key="splash" />
    </>
  );
}
