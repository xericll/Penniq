import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Composer, type ComposerIntent } from './components/composer/Composer';
import { Rail, TabBar } from './components/nav/Navigation';
import { AccountSheet } from './components/sheets/AccountSheet';
import { CorrectBalanceSheet, OpeningSheet } from './components/sheets/BalanceSheets';
import { EditSheet } from './components/sheets/EditSheet';
import { ReceiptSheet } from './components/sheets/ReceiptSheet';
import { ResetSheet } from './components/sheets/ResetSheet';
import { SourcesSheet } from './components/sheets/SourcesSheet';
import { Splash } from './components/Splash';
import { Ambient } from './components/ui/Ambient';
import { useKeyboardViewport } from './hooks/useKeyboardViewport';
import { useI18n } from './i18n/LanguageContext';
import { Activity } from './screens/Activity';
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

  const screen = {
    home: (
      <Home
        onCompose={(type, acc) => compose(type, acc)}
        onOpenAccount={setAccount}
        onOpenTx={openTx}
        onNavigate={setTab}
        onOpening={() => setOpening(true)}
      />
    ),
    activity: <Activity onOpenTx={openTx} onCompose={() => compose('expense')} focusAccount={activityFocus} />,
    insights: <Insights />,
    settings: <Settings onEditList={setListKind} onCorrect={setCorrecting} onReset={() => setResetting(true)} />,
  }[tab];

  const wide = tab === 'home' || tab === 'insights';

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[90] rounded-xl bg-ink px-4 py-2 text-bg focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t('nav.skip')}
      </a>

      <Ambient />

      <Rail tab={tab} onTab={setTab} onNew={() => compose('expense')} />

      <main id="main" ref={mainRef} tabIndex={-1} className="relative outline-none lg:ps-[272px]">
        <div
          className={`mx-auto w-full px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+128px)] sm:px-6 lg:px-10 lg:pt-10 lg:pb-16 ${
            wide ? 'max-w-[560px] lg:max-w-[1080px]' : 'max-w-[560px] lg:max-w-[720px]'
          }`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
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

      <Splash />
    </>
  );
}
