import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  EMPTY_OUTBOX,
  deleteTransactions,
  loadOutbox,
  markAll,
  nextStamp,
  pendingCount,
  pullSettings,
  pullTransactions,
  pushSettings,
  pushTransactions,
  replay,
  sameList,
  saveOutbox,
  settle,
  trackChanges,
  type CloudSettings,
  type Outbox,
} from '../lib/cloud';
import { KEYS, read, removeKey, write } from '../lib/storage';
import { supabase } from '../lib/supabase';
import type { Transaction } from '../types';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

/** What the sync engine needs from the wallet. */
export interface CloudHost {
  getTransactions: () => Transaction[];
  /** Replaces the local list without recording it as a change to upload. */
  applyTransactions: (txs: Transaction[]) => void;
  getSettings: () => CloudSettings;
  /** null restores the built-in defaults. */
  applySettings: (settings: CloudSettings | null) => void;
}

export interface Adoption {
  local: number;
  remote: number;
}

export interface CloudValue {
  /** This device's wallet belongs to an account (even while offline or signed out by an expired session). */
  linked: boolean;
  status: SyncStatus;
  /** Changes waiting to be uploaded. */
  pending: number;
  lastSyncedAt: string | null;
  /** First sign-in found entries both on this device and in the account: the user decides. */
  adoption: Adoption | null;
  resolveAdoption: (choice: 'merge' | 'replace') => void;
  sync: () => Promise<void>;
  /** Removes the account's wallet from this device (sign-out). Nothing is deleted from the account. */
  forget: () => void;
}

interface CloudSync {
  cloud: CloudValue;
  /** Records a local change to the transaction list for upload. */
  track: (prev: Transaction[], next: Transaction[]) => void;
  /** Records that the preferences changed on this device. */
  touchSettings: () => void;
}

const FLUSH_DELAY = 800;
const WAKE_INTERVAL = 15_000;

/**
 * Keeps the local wallet and the signed-in account in step. The device stays the place
 * the app reads from, so everything works offline; changes queue in an outbox and upload
 * when possible, and the account's rows replace local ones on every pull.
 */
export function useCloudSync(userId: string | null, host: RefObject<CloudHost>): CloudSync {
  const [owner, setOwnerState] = useState(() => read(KEYS.cloudOwner));
  const [pending, setPending] = useState(() => pendingCount(loadOutbox()));
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState(() => read(KEYS.cloudSyncedAt));
  const [adoption, setAdoptionState] = useState<Adoption | null>(null);

  const ownerRef = useRef(owner);
  const outboxRef = useRef<Outbox>(loadOutbox());
  const adoptionRef = useRef<Adoption | null>(null);
  const userRef = useRef(userId);
  userRef.current = userId;
  // Uploads and downloads run one after another, never interleaved.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<number | undefined>(undefined);

  const setOutbox = useCallback((next: Outbox) => {
    outboxRef.current = next;
    saveOutbox(next);
    setPending(pendingCount(next));
  }, []);

  const setOwner = useCallback((id: string | null) => {
    ownerRef.current = id;
    setOwnerState(id);
    if (id) write(KEYS.cloudOwner, id);
    else removeKey(KEYS.cloudOwner);
  }, []);

  const setAdoption = useCallback((next: Adoption | null) => {
    adoptionRef.current = next;
    setAdoptionState(next);
  }, []);

  const markSynced = useCallback(() => {
    const now = new Date().toISOString();
    write(KEYS.cloudSyncedAt, now);
    setLastSyncedAt(now);
  }, []);

  const wipe = useCallback(() => {
    host.current.applyTransactions([]);
    host.current.applySettings(null);
    setOutbox(EMPTY_OUTBOX);
    setOwner(null);
    removeKey(KEYS.cloudSyncedAt);
    setLastSyncedAt(null);
  }, [host, setOutbox, setOwner]);

  const flush = useCallback(async () => {
    const uid = userRef.current;
    if (!supabase || !uid || ownerRef.current !== uid) return;
    const sent = outboxRef.current;
    if (!pendingCount(sent)) return;
    const byId = new Map(host.current.getTransactions().map((t) => [t.id, t]));
    const upserts = Object.keys(sent.dirty).flatMap((id) => byId.get(id) ?? []);
    await deleteTransactions(supabase, Object.keys(sent.deleted));
    await pushTransactions(supabase, uid, upserts);
    if (sent.settings) await pushSettings(supabase, uid, host.current.getSettings());
    setOutbox(settle(outboxRef.current, sent));
  }, [host, setOutbox]);

  const pull = useCallback(async () => {
    const uid = userRef.current;
    if (!supabase || !uid || ownerRef.current !== uid) return;
    const [remote, settings] = await Promise.all([pullTransactions(supabase), pullSettings(supabase)]);
    // Signed out or switched account while the request was running.
    if (userRef.current !== uid || ownerRef.current !== uid) return;
    const local = host.current.getTransactions();
    const merged = replay(remote, local, outboxRef.current);
    if (!sameList(merged, local)) host.current.applyTransactions(merged);
    if (!outboxRef.current.settings) {
      if (settings) host.current.applySettings(settings);
      // First device of this account: its preferences become the account's.
      else setOutbox({ ...outboxRef.current, settings: nextStamp() });
    }
  }, [host, setOutbox]);

  const exchange = useCallback(async () => {
    await flush();
    await pull();
    await flush();
    markSynced();
  }, [flush, pull, markSynced]);

  const run = useCallback((task: () => Promise<void>) => {
    const next = queue.current.then(async () => {
      setStatus('syncing');
      try {
        await task();
        setStatus('idle');
      } catch {
        setStatus(navigator.onLine === false ? 'offline' : 'error');
      }
    });
    queue.current = next;
    return next;
  }, []);

  const link = useCallback(
    async (uid: string, uploadLocal: boolean) => {
      setOwner(uid);
      setOutbox(uploadLocal ? markAll(EMPTY_OUTBOX, host.current.getTransactions(), nextStamp()) : EMPTY_OUTBOX);
      setAdoption(null);
      await exchange();
    },
    [host, setOwner, setOutbox, setAdoption, exchange],
  );

  const sync = useCallback(() => {
    const uid = userRef.current;
    if (!supabase || !uid || adoptionRef.current) return Promise.resolve();
    const sb = supabase;
    return run(async () => {
      if (userRef.current !== uid) return;
      if (ownerRef.current === uid) return exchange();

      // First time this account is used on this device.
      // Another account's leftovers are never mixed into this one.
      if (ownerRef.current) wipe();
      const remote = await pullTransactions(sb);
      if (userRef.current !== uid || ownerRef.current === uid) return;
      const local = host.current.getTransactions();
      if (local.length && remote.length) setAdoption({ local: local.length, remote: remote.length });
      else await link(uid, local.length > 0);
    });
  }, [host, run, exchange, wipe, link, setAdoption]);

  const resolveAdoption = useCallback(
    (choice: 'merge' | 'replace') => {
      const uid = userRef.current;
      setAdoption(null);
      if (uid) void run(() => link(uid, choice === 'merge'));
    },
    [run, link, setAdoption],
  );

  const forget = useCallback(() => {
    window.clearTimeout(timer.current);
    setAdoption(null);
    wipe();
  }, [setAdoption, wipe]);

  const flushSoon = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (userRef.current)
        void run(async () => {
          await flush();
          markSynced();
        });
    }, FLUSH_DELAY);
  }, [run, flush, markSynced]);

  const track = useCallback(
    (prev: Transaction[], next: Transaction[]) => {
      if (!ownerRef.current) return;
      setOutbox(trackChanges(outboxRef.current, prev, next, nextStamp()));
      flushSoon();
    },
    [setOutbox, flushSoon],
  );

  const touchSettings = useCallback(() => {
    if (!ownerRef.current) return;
    setOutbox({ ...outboxRef.current, settings: nextStamp() });
    flushSoon();
  }, [setOutbox, flushSoon]);

  // Sign-in, and every later app start with a saved session.
  useEffect(() => {
    if (userId) void sync();
    else setAdoption(null);
  }, [userId, sync, setAdoption]);

  // Catch up when the connection or the app comes back; follow another tab's outbox.
  useEffect(() => {
    if (!supabase) return;
    let last = Date.now();
    const wake = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < WAKE_INTERVAL) return;
      last = Date.now();
      void sync();
    };
    const online = () => {
      last = Date.now();
      void sync();
    };
    const storage = (e: StorageEvent) => {
      if (e.key === KEYS.cloudOutbox) {
        outboxRef.current = loadOutbox();
        setPending(pendingCount(outboxRef.current));
      } else if (e.key === KEYS.cloudOwner) {
        ownerRef.current = e.newValue;
        setOwnerState(e.newValue);
      }
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', online);
    window.addEventListener('storage', storage);
    return () => {
      window.clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', online);
      window.removeEventListener('storage', storage);
    };
  }, [sync]);

  const cloud = useMemo<CloudValue>(
    () => ({
      linked: owner !== null,
      // Linked but without a usable session: the device is waiting for a connection.
      status: owner !== null && !userId ? 'offline' : status,
      pending,
      lastSyncedAt,
      adoption,
      resolveAdoption,
      sync,
      forget,
    }),
    [owner, userId, status, pending, lastSyncedAt, adoption, resolveAdoption, sync, forget],
  );

  return { cloud, track, touchSettings };
}
