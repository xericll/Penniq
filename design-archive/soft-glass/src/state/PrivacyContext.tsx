import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { haptic } from '../lib/haptics';
import { KEYS, read, write } from '../lib/storage';

interface PrivacyValue {
  hidden: boolean;
  toggle: () => void;
  setHidden: (v: boolean) => void;
  /** While hidden, temporarily reveal amounts (press-and-hold). */
  peek: (on: boolean) => void;
}

const PrivacyContext = createContext<PrivacyValue | null>(null);

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHiddenState] = useState(() => read(KEYS.hidden) === 'true' || read(KEYS.hiddenLegacy) === 'true');

  useEffect(() => {
    document.documentElement.classList.toggle('amounts-hidden', hidden);
    if (!hidden) document.documentElement.classList.remove('amounts-peeking');
  }, [hidden]);

  const setHidden = useCallback((v: boolean) => {
    setHiddenState(v);
    write(KEYS.hidden, String(v));
    write(KEYS.hiddenLegacy, String(v));
  }, []);

  const toggle = useCallback(() => {
    haptic('select');
    setHiddenState((prev) => {
      const next = !prev;
      write(KEYS.hidden, String(next));
      write(KEYS.hiddenLegacy, String(next));
      return next;
    });
  }, []);

  const peek = useCallback((on: boolean) => {
    document.documentElement.classList.toggle('amounts-peeking', on);
    if (on) haptic('tap');
  }, []);

  const value = useMemo(() => ({ hidden, toggle, setHidden, peek }), [hidden, toggle, setHidden, peek]);
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy(): PrivacyValue {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error('usePrivacy must be used inside <PrivacyProvider>');
  return ctx;
}
