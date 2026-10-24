/* Income split: rules set once ("50 % essentials, 30 % vault, 20 % a goal") that are offered as a
   suggestion each time an income is recorded. Nothing moves until the user confirms the split.

   - essentials: stays in the wallet, set against this month's fixed costs (the Essentials list);
   - vault: moved into the vault;
   - goal: moved into the vault and counted towards the chosen goal;
   - free: stays in the wallet to spend. */

import { roundMoney } from './ledger';

export type BucketKind = 'essentials' | 'vault' | 'goal' | 'free';
export const BUCKET_KINDS: BucketKind[] = ['essentials', 'vault', 'goal', 'free'];

export interface Bucket {
  kind: BucketKind;
  /** A percentage (0–100) or a fixed amount, depending on the mode. */
  value: number;
  /** goal buckets: the goal the money goes to. */
  goalId?: string;
}

export interface AllocationRules {
  enabled: boolean;
  mode: 'percent' | 'fixed';
  buckets: Bucket[];
}

export const DEFAULT_ALLOCATION: AllocationRules = {
  enabled: false,
  mode: 'percent',
  buckets: [
    { kind: 'essentials', value: 50 },
    { kind: 'vault', value: 30 },
    { kind: 'goal', value: 20 },
  ],
};

export function percentTotal(rules: AllocationRules): number {
  return roundMoney(rules.buckets.reduce((s, b) => s + b.value, 0));
}

/** Percentages must add up to exactly 100; fixed amounts only need to be positive. */
export function rulesValid(rules: AllocationRules): boolean {
  if (!rules.buckets.length || rules.buckets.some((b) => !(b.value >= 0))) return false;
  return rules.mode === 'percent' ? Math.abs(percentTotal(rules) - 100) < 0.001 : rules.buckets.some((b) => b.value > 0);
}

export interface SplitLine {
  kind: BucketKind;
  amount: number;
  goalId?: string;
}

/** The suggested split of one income. Fixed amounts never add up to more than the income: the rest stays free. */
export function suggestSplit(rules: AllocationRules, income: number): SplitLine[] {
  let left = income;
  const lines = rules.buckets.map((b) => {
    const want = rules.mode === 'percent' ? (income * b.value) / 100 : b.value;
    const amount = roundMoney(Math.max(0, Math.min(left, want)));
    left = roundMoney(left - amount);
    return { kind: b.kind, amount, goalId: b.goalId };
  });
  // Rounding dust (or what fixed amounts did not use) goes to the first bucket that keeps money in the wallet.
  if (left > 0) {
    const keep = lines.find((l) => l.kind === 'free') ?? lines.find((l) => l.kind === 'essentials');
    if (keep) keep.amount = roundMoney(keep.amount + left);
    else lines.push({ kind: 'free', amount: left, goalId: undefined });
  }
  return lines.filter((l) => l.amount > 0);
}

export function parseAllocation(v: unknown): AllocationRules {
  if (!v || typeof v !== 'object') return DEFAULT_ALLOCATION;
  const x = v as Record<string, unknown>;
  const buckets: Bucket[] = Array.isArray(x.buckets)
    ? x.buckets
        .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
        .filter((b) => BUCKET_KINDS.includes(b.kind as BucketKind) && Number.isFinite(Number(b.value)))
        .map((b) => ({
          kind: b.kind as BucketKind,
          value: Math.max(0, Number(b.value)),
          goalId: typeof b.goalId === 'string' ? b.goalId : undefined,
        }))
        .slice(0, 6)
    : DEFAULT_ALLOCATION.buckets;
  return { enabled: x.enabled === true, mode: x.mode === 'fixed' ? 'fixed' : 'percent', buckets };
}
