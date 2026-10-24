import { createContext, useContext } from 'react';
import type { Asset } from '../lib/assets';
import type { Goal } from '../lib/goals';
import type { Transaction } from '../types';

/** The windows of the planning tools; App keeps the one that is open. */
export type Tool =
  | { name: 'templates' }
  | { name: 'recurring' }
  | { name: 'splitRules' }
  | { name: 'split'; tx: Transaction }
  | { name: 'rules' }
  | { name: 'whatIf' }
  | { name: 'report' }
  | { name: 'lock' }
  | { name: 'rate' }
  | { name: 'achievement'; kind?: 'savings' | 'goal' | 'level'; goalId?: string }
  | { name: 'asset'; asset: Asset | null }
  | { name: 'goal'; goal: Goal | null }
  | { name: 'goalDeposit'; goal: Goal }
  | { name: 'scan'; file: File };

export interface ToolsValue {
  open: (tool: Tool) => void;
  close: () => void;
}

export const ToolsContext = createContext<ToolsValue | null>(null);

export function useTools(): ToolsValue {
  const ctx = useContext(ToolsContext);
  if (!ctx) throw new Error('useTools must be used inside <ToolsContext.Provider>');
  return ctx;
}
