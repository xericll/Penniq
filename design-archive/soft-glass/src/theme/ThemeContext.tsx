import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { TranslationKey } from '../i18n/translations';
import { KEYS, read, write } from '../lib/storage';

export type EditionId = 'linen' | 'mist' | 'sage' | 'blush' | 'night';
export type ThemePref = EditionId | 'auto';

export interface Edition {
  id: EditionId;
  labelKey: TranslationKey;
  dark: boolean;
  /** Swatch colours for the picker preview (tokens themselves live in index.css). */
  preview: { bg: string; blobs: [string, string]; accent: string; ink: string };
}

export const EDITIONS: Edition[] = [
  {
    id: 'linen',
    labelKey: 'theme.linen',
    dark: false,
    preview: { bg: '#ebe7e0', blobs: ['#d8cbb4', '#c5d1b6'], accent: '#56654a', ink: '#1f1e1b' },
  },
  {
    id: 'mist',
    labelKey: 'theme.mist',
    dark: false,
    preview: { bg: '#e6e7ea', blobs: ['#d6d9e3', '#e2d6e6'], accent: '#434a5a', ink: '#1c1d21' },
  },
  {
    id: 'sage',
    labelKey: 'theme.sage',
    dark: false,
    preview: { bg: '#e1e6dc', blobs: ['#c3d4b4', '#b9d3cb'], accent: '#46663f', ink: '#1b2019' },
  },
  {
    id: 'blush',
    labelKey: 'theme.blush',
    dark: false,
    preview: { bg: '#efe4df', blobs: ['#f0cfc4', '#e6d2e4'], accent: '#8f5149', ink: '#231c1b' },
  },
  {
    id: 'night',
    labelKey: 'theme.night',
    dark: true,
    preview: { bg: '#101112', blobs: ['#2c3b31', '#3a2e45'], accent: '#c8d4b0', ink: '#f1efea' },
  },
];

/** Theme ids from earlier designs, mapped onto the closest edition (dark stays dark). */
const LEGACY: Record<string, EditionId> = {
  olive: 'night',
  paper: 'linen',
  indigo: 'night',
  plum: 'night',
  sand: 'linen',
  graphite: 'night',
  'night-steel': 'night',
  'purple-dusk': 'night',
  'calm-green': 'sage',
  'beige-black-brown': 'linen',
  'night-crimson': 'night',
  espresso: 'linen',
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

  const resolvedId: EditionId = pref === 'auto' ? (dark ? 'night' : 'linen') : pref;
  const edition = EDITIONS.find((e) => e.id === resolvedId) ?? EDITIONS[0];

  useEffect(() => {
    document.documentElement.dataset.edition = edition.id;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', edition.preview.bg);
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
