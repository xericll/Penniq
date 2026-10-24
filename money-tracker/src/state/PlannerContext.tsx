import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { DEFAULT_ALLOCATION, parseAllocation, type AllocationRules } from '../lib/allocation';
import { parseAssets, type Asset } from '../lib/assets';
import { parseGoals, type Goal } from '../lib/goals';
import { parseRecurring, type Recurring } from '../lib/recurring';
import { parseRules, type Rule } from '../lib/rules';
import { KEYS, readJSON, write } from '../lib/storage';
import { parseTemplates, type Template } from '../lib/templates';

/** Display choices for the new parts of the app. */
export interface Prefs {
  /** Show "net worth = wallet + vault + assets + debts" on Home and in Wealth. */
  netWorth: boolean;
  /** Show the progress levels (points, level, celebrations). */
  levels: boolean;
  /** Highest level already celebrated, so a level-up is celebrated once. */
  levelSeen: number;
}

const DEFAULT_PREFS: Prefs = { netWorth: false, levels: true, levelSeen: -1 };

function loadPrefs(): Prefs {
  const v = readJSON(KEYS.prefs) as Partial<Prefs> | null;
  if (!v || typeof v !== 'object') return DEFAULT_PREFS;
  return {
    netWorth: v.netWorth === true,
    levels: v.levels !== false,
    levelSeen: typeof v.levelSeen === 'number' ? v.levelSeen : -1,
  };
}

interface PlannerValue {
  assets: Asset[];
  goals: Goal[];
  templates: Template[];
  recurring: Recurring[];
  allocation: AllocationRules;
  rules: Rule[];
  prefs: Prefs;
  /** Always the latest rules, for code that runs outside React's render (adding an entry). */
  rulesRef: React.RefObject<Rule[]>;
  setAssets: (next: Asset[]) => void;
  setGoals: (next: Goal[] | ((prev: Goal[]) => Goal[])) => void;
  setTemplates: (next: Template[]) => void;
  setRecurring: (next: Recurring[] | ((prev: Recurring[]) => Recurring[])) => void;
  setAllocation: (next: AllocationRules) => void;
  setRules: (next: Rule[]) => void;
  setPrefs: (patch: Partial<Prefs>) => void;
}

const PlannerContext = createContext<PlannerValue | null>(null);

/** A list kept in the device storage under one key; the setter saves as it goes. */
function usePersisted<T>(key: string, load: () => T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(load);
  const ref = useRef(value);
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(ref.current) : next;
      ref.current = resolved;
      setValue(resolved);
      write(key, JSON.stringify(resolved));
    },
    [key],
  );
  return [value, set];
}

/**
 * Assets, savings goals, quick buttons, recurring payments, the income split, automation rules and a
 * few display choices. All of it is kept on this device (like the reminders); the entries these tools
 * create are ordinary transactions and sync as usual.
 */
export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const { currency } = useI18n();
  const [assets, setAssets] = usePersisted(KEYS.assets, () => parseAssets(readJSON(KEYS.assets), currency));
  const [goals, setGoals] = usePersisted(KEYS.goals, () => parseGoals(readJSON(KEYS.goals)));
  const [templates, setTemplates] = usePersisted(KEYS.templates, () => parseTemplates(readJSON(KEYS.templates)));
  const [recurring, setRecurring] = usePersisted(KEYS.recurring, () => parseRecurring(readJSON(KEYS.recurring)));
  const [allocation, setAllocation] = usePersisted<AllocationRules>(KEYS.allocation, () =>
    readJSON(KEYS.allocation) ? parseAllocation(readJSON(KEYS.allocation)) : DEFAULT_ALLOCATION,
  );
  const [rules, setRulesState] = usePersisted(KEYS.rules, () => parseRules(readJSON(KEYS.rules)));
  const [prefs, setPrefsState] = usePersisted(KEYS.prefs, loadPrefs);

  const rulesRef = useRef(rules);
  rulesRef.current = rules;

  const setRules = useCallback(
    (next: Rule[]) => {
      rulesRef.current = next;
      setRulesState(next);
    },
    [setRulesState],
  );
  const setPrefs = useCallback((patch: Partial<Prefs>) => setPrefsState((p) => ({ ...p, ...patch })), [setPrefsState]);

  const value = useMemo<PlannerValue>(
    () => ({
      assets,
      goals,
      templates,
      recurring,
      allocation,
      rules,
      prefs,
      rulesRef,
      setAssets,
      setGoals,
      setTemplates,
      setRecurring,
      setAllocation,
      setRules,
      setPrefs,
    }),
    [
      assets,
      goals,
      templates,
      recurring,
      allocation,
      rules,
      prefs,
      setAssets,
      setGoals,
      setTemplates,
      setRecurring,
      setAllocation,
      setRules,
      setPrefs,
    ],
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error('usePlanner must be used inside <PlannerProvider>');
  return ctx;
}
