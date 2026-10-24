import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { TranslationKey } from '../i18n/translations';
import { KEYS, read, write } from '../lib/storage';

export type EditionId = 'parchment' | 'navy' | 'olive';
export type ThemePref = EditionId | 'auto';

/** The colours themselves live in index.css, under [data-edition="<id>"]. */
export interface Edition {
  id: EditionId;
  labelKey: TranslationKey;
  dark: boolean;
}

/** The three appearances of the Penniq brand: parchment (light), Ledger Navy and olive. */
export const EDITIONS: Edition[] = [
  { id: 'parchment', labelKey: 'theme.parchment', dark: false },
  { id: 'navy', labelKey: 'theme.navy', dark: true },
  { id: 'olive', labelKey: 'theme.olive', dark: true },
];

/** What "auto" resolves to. */
export const AUTO_EDITIONS: { dark: EditionId; light: EditionId } = { dark: 'navy', light: 'parchment' };

/** Theme ids saved by other versions of the app, mapped onto the closest appearance. */
const LEGACY: Record<string, EditionId> = {
  // "Mint Edition" (archived in design-archive/mint-edition): olive keeps its id
  indigo: 'navy',
  plum: 'navy',
  teal: 'olive',
  graphite: 'navy',
  paper: 'parchment',
  mint: 'parchment',
  sky: 'parchment',
  rose: 'parchment',
  lavender: 'parchment',
  // original AI Studio build
  'night-steel': 'navy',
  'purple-dusk': 'navy',
  'calm-green': 'olive',
  'beige-black-brown': 'parchment',
  'night-crimson': 'navy',
  espresso: 'parchment',
  sand: 'parchment',
  // archived "Soft Glass" design
  linen: 'parchment',
  mist: 'parchment',
  sage: 'olive',
  blush: 'parchment',
  night: 'navy',
};

function loadPref(): ThemePref {
  const saved = read(KEYS.theme);
  if (!saved) return 'auto';
  if (saved === 'auto' || EDITIONS.some((e) => e.id === saved)) return saved as ThemePref;
  return LEGACY[saved] ?? 'auto';
}

/** Dark when the host page says so (data-theme on <html>), otherwise when the OS does. */
function systemDark(): boolean {
  if (typeof window === 'undefined') return false;
  const host = document.documentElement.getAttribute('data-theme');
  if (host === 'dark' || host === 'light') return host === 'dark';
  return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

interface ThemeContextValue {
  pref: ThemePref;
  edition: Edition;
  setPref: (pref: ThemePref) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(loadPref);
  const [dark, setDark] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = () => setDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolvedId: EditionId = pref === 'auto' ? (dark ? AUTO_EDITIONS.dark : AUTO_EDITIONS.light) : pref;
  const edition = EDITIONS.find((e) => e.id === resolvedId) ?? EDITIONS[0];

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.edition = edition.id;
    // The browser chrome takes the page colour of the edition that was just applied.
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  }, [edition]);

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next);
    write(KEYS.theme, next);
  }, []);

  const value = useMemo(() => ({ pref, edition, setPref }), [pref, edition, setPref]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
