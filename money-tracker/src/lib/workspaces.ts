/* Workspaces: separate wallets inside one account (a job, the household…), each with its own
   balances and entries. Every entry carries the id of its workspace; entries from before this
   feature have none and belong to the first one, MAIN_WORKSPACE, which can be renamed but not removed.
   The list syncs with the account; which one is open is chosen on each device. */

import type { Transaction } from '../types';
import { KEYS, read, readJSON, write } from './storage';

export const MAIN_WORKSPACE = 'main';

export const WORKSPACE_ICONS = ['wallet', 'home', 'briefcase', 'store', 'car', 'plane', 'study', 'heart'] as const;
export type WorkspaceIcon = (typeof WORKSPACE_ICONS)[number];

/** Colours are the edition's own money hues, so every workspace fits whichever appearance is on. */
export const WORKSPACE_TONES = ['var(--coin)', 'var(--bank)', 'var(--cash)', 'var(--in)', 'var(--out)'] as const;

export interface Workspace {
  id: string;
  /**
   * Empty for the first workspace until the user renames it, and for one rebuilt from its entries
   * (its name never reached this device): both are shown with a translated default name.
   */
  name: string;
  icon: WorkspaceIcon;
  /** Index into WORKSPACE_TONES. */
  tone: number;
}

export const MAX_WORKSPACES = 12;

const MAIN: Workspace = { id: MAIN_WORKSPACE, name: '', icon: 'wallet', tone: 0 };

export function workspaceOf(tx: { workspace?: string }): string {
  return tx.workspace || MAIN_WORKSPACE;
}

export function inWorkspace(tx: { workspace?: string }, id: string): boolean {
  return workspaceOf(tx) === id;
}

/** null when the value is not a list at all; otherwise a usable list that always starts with the first workspace. */
export function parseWorkspaces(v: unknown): Workspace[] | null {
  if (!Array.isArray(v)) return null;
  const out: Workspace[] = [];
  const seen = new Set<string>();
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const w = raw as Record<string, unknown>;
    if (typeof w.id !== 'string' || !w.id || w.id.length > 80 || seen.has(w.id)) continue;
    const name = typeof w.name === 'string' ? w.name.trim().slice(0, 40) : '';
    const tone = Number(w.tone);
    seen.add(w.id);
    out.push({
      id: w.id,
      name,
      icon: WORKSPACE_ICONS.includes(w.icon as WorkspaceIcon) ? (w.icon as WorkspaceIcon) : 'wallet',
      tone: Number.isInteger(tone) && tone >= 0 && tone < WORKSPACE_TONES.length ? tone : 0,
    });
  }
  const main = out.find((w) => w.id === MAIN_WORKSPACE) ?? MAIN;
  return [main, ...out.filter((w) => w.id !== MAIN_WORKSPACE)].slice(0, MAX_WORKSPACES);
}

export function loadWorkspaces(): Workspace[] {
  return parseWorkspaces(readJSON(KEYS.workspaces)) ?? [MAIN];
}

export function saveWorkspaces(list: Workspace[]): void {
  write(KEYS.workspaces, JSON.stringify(list));
}

export function loadActiveWorkspace(list: Workspace[]): string {
  const id = read(KEYS.workspace);
  return id && list.some((w) => w.id === id) ? id : MAIN_WORKSPACE;
}

/**
 * The account's list wins (this device's when the account has none yet), but no entry is left
 * without a workspace: one this device still has entries in is kept (it was made here before
 * signing in), and one known only from its entries comes back without a name.
 */
export function mergeWorkspaces(remote: Workspace[] | null, local: Workspace[], txs: Transaction[]): Workspace[] {
  const out = [...(remote ?? local)];
  const ids = new Set(out.map((w) => w.id));
  for (const id of new Set(txs.map(workspaceOf))) {
    if (ids.has(id)) continue;
    ids.add(id);
    out.push(local.find((w) => w.id === id) ?? { id, name: '', icon: 'wallet', tone: 1 });
  }
  return out;
}

export function sameWorkspaces(a: Workspace[], b: Workspace[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function defaultWorkspaces(): Workspace[] {
  return [MAIN];
}
