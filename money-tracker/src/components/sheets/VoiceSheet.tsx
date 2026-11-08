import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Landmark,
  LogIn,
  Mic,
  Plus,
  RotateCcw,
  Square,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { assistantReady } from '../../lib/assistant';
import { CATEGORIES } from '../../lib/categories';
import { haptic } from '../../lib/haptics';
import { roundMoney } from '../../lib/ledger';
import { supabase } from '../../lib/supabase';
import {
  MAX_SECONDS,
  TEXT_MAX_LENGTH,
  blankDraft,
  canRecord,
  draftAccount,
  draftEntry,
  readEntries,
  readLocally,
  startRecording,
  type Recorder,
  type VoiceDraft,
  type VoiceFailure,
} from '../../lib/voice';
import { useAuth } from '../../state/AuthContext';
import { usePlanner } from '../../state/PlannerContext';
import { useToast } from '../../state/ToastContext';
import { useTools } from '../../state/ToolsContext';
import { useWallet } from '../../state/WalletContext';
import type { AccountType, Transaction, TransactionType } from '../../types';
import { Money } from '../ui/Money';
import { Sheet } from '../ui/Sheet';

type Phase = 'idle' | 'recording' | 'thinking' | 'review';
type ErrorKey = `voice.err.${VoiceFailure | 'permission' | 'nomic' | 'signin' | 'short'}` | 'voice.noEntries';

/** The account an entry falls back to when the speech did not say. */
const FALLBACK: AccountType = 'cash';

/**
 * Voice entry: the user speaks (or types) what they spent or received, the model reads it into
 * draft entries, and nothing is recorded until the user has looked at them and pressed "add all".
 */
export function VoiceSheet({ open, onClose, autoStart = false }: { open: boolean; onClose: () => void; autoStart?: boolean }) {
  const { t, lang, currency } = useI18n();
  const { incomeSources, balances, add, removeMany } = useWallet();
  const { allocation } = usePlanner();
  const auth = useAuth();
  const toast = useToast();
  const tools = useTools();
  const reduce = useReducedMotion();
  const signedIn = Boolean(supabase && auth.user);

  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<ErrorKey | null>(null);
  const [drafts, setDrafts] = useState<VoiceDraft[]>([]);
  const [transcript, setTranscript] = useState('');
  const [typed, setTyped] = useState('');
  const [seconds, setSeconds] = useState(0);
  /** Whether speech can be understood right now: unknown until the function answers. */
  const [model, setModel] = useState<'unknown' | 'on' | 'off'>('unknown');
  const recorder = useRef<Recorder | null>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);
  const started = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;
  const countRef = useRef(0);
  countRef.current = drafts.length;

  const voiceUsable = signedIn && canRecord() && model !== 'off';

  const stopLoops = () => {
    window.clearInterval(timer.current);
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = undefined;
  };

  const cancelRecording = useCallback(() => {
    stopLoops();
    recorder.current?.cancel();
    recorder.current = null;
  }, []);

  // Fresh each time it opens; the recording never outlives the window.
  useEffect(() => {
    if (!open) {
      cancelRecording();
      started.current = false;
      return;
    }
    setPhase('idle');
    setError(null);
    setDrafts([]);
    setTranscript('');
    setTyped('');
    setSeconds(0);
  }, [open, cancelRecording]);

  useEffect(() => {
    if (!open || !supabase || !auth.user || model === 'on') return;
    let stale = false;
    assistantReady(supabase)
      .then((ready) => !stale && setModel(ready ? 'on' : 'off'))
      .catch(() => !stale && setModel('off'));
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, auth.user]);

  const fail = (key: ErrorKey) => {
    haptic('warning');
    setError(key);
    setPhase(countRef.current ? 'review' : 'idle');
  };

  const show = (found: VoiceDraft[], heard: string) => {
    const ready = found.map((d) => ({ ...d, account: d.account === 'unspecified' ? FALLBACK : d.account }));
    setTranscript(heard);
    if (!ready.length) return fail('voice.noEntries');
    haptic('success');
    setError(null);
    setDrafts((list) => [...list, ...ready]);
    setPhase('review');
  };

  const start = async () => {
    if (phase === 'recording' || phase === 'thinking') return;
    setError(null);
    if (!signedIn) return setError('voice.err.signin');
    if (!canRecord()) return setError('voice.err.nomic');
    if (model === 'off') return setError('voice.err.off');
    try {
      recorder.current = await startRecording();
    } catch (e) {
      const name = (e as { name?: string })?.name;
      return fail(name === 'NotAllowedError' || name === 'SecurityError' ? 'voice.err.permission' : 'voice.err.nomic');
    }
    haptic('tap');
    setSeconds(0);
    setPhase('recording');
    const t0 = performance.now();
    timer.current = window.setInterval(() => {
      const s = (performance.now() - t0) / 1000;
      setSeconds(Math.floor(s));
      if (s >= MAX_SECONDS) void stop();
    }, 250);
    // The rings follow the voice without re-rendering React: one CSS variable per frame.
    let smooth = 0;
    const tick = () => {
      const level = recorder.current?.level() ?? 0;
      smooth = smooth * 0.7 + level * 0.3;
      orbRef.current?.style.setProperty('--lvl', smooth.toFixed(3));
      frame.current = requestAnimationFrame(tick);
    };
    if (!reduce) frame.current = requestAnimationFrame(tick);
  };

  const stop = async () => {
    const rec = recorder.current;
    if (!rec) return;
    recorder.current = null;
    stopLoops();
    haptic('select');
    const audio = await rec.stop();
    if (audio.seconds < 0.8) return fail('voice.err.short');
    if (!supabase) return fail('voice.err.off');
    setPhase('thinking');
    const result = await readEntries(supabase, { lang, currency, incomeSources, audio });
    if (!openRef.current) return;
    if (result.ok) return show(result.drafts, result.transcript);
    if (result.reason === 'off') setModel('off');
    fail(`voice.err.${result.reason}`);
  };

  const readTyped = async () => {
    const text = typed.trim().slice(0, TEXT_MAX_LENGTH);
    if (!text || phase === 'thinking') return;
    haptic('tap');
    setError(null);
    // With the model the sentence is read like speech; without it, on the device.
    if (supabase && auth.user && model === 'on') {
      setPhase('thinking');
      const result = await readEntries(supabase, { lang, currency, incomeSources, text });
      if (!openRef.current) return;
      if (result.ok) {
        setTyped('');
        return show(result.drafts, '');
      }
      if (result.reason !== 'network' && result.reason !== 'limit') return fail(`voice.err.${result.reason}`);
    }
    setTyped('');
    show(readLocally(text, incomeSources), '');
  };

  // Opened from the mic button: already listening, no second tap.
  useEffect(() => {
    if (!open || !autoStart || started.current || model === 'unknown' || !voiceUsable) return;
    started.current = true;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoStart, model, voiceUsable]);

  const patch = (key: string, change: Partial<VoiceDraft>) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...change } : d)));
  const drop = (key: string) => {
    haptic('select');
    setDrafts((list) => {
      const next = list.filter((d) => d.key !== key);
      if (!next.length) setPhase('idle');
      return next;
    });
  };

  // Transfers may not take an account below zero: checked in order, as if each before it was already added.
  const problems = (() => {
    const left = { ...balances } as Record<AccountType, number>;
    return drafts.map((d) => {
      if (!(d.amount > 0)) return 'amount' as const;
      const from = draftAccount(d, FALLBACK);
      if (d.type === 'transfer') {
        if (d.amount > left[from] + 0.001) return 'over' as const;
        left[from] -= d.amount;
        left[from === 'cash' ? 'bank' : 'cash'] += d.amount;
      } else left[from] += d.type === 'income' ? d.amount : -d.amount;
      return null;
    });
  })();
  const canAdd = drafts.length > 0 && problems.every((p) => p === null);
  const net = drafts.reduce((sum, d) => sum + (d.type === 'income' ? d.amount : d.type === 'expense' ? -d.amount : 0), 0);

  const addAll = () => {
    if (!canAdd) {
      haptic('warning');
      return;
    }
    const added: Transaction[] = drafts.map((d) => add(draftEntry(d, FALLBACK)));
    haptic('money');
    toast.show({
      message: added.length === 1 ? t('voice.addedOne') : t('voice.added', { count: added.length }),
      tone: net > 0 ? 'in' : net < 0 ? 'out' : 'neutral',
      action: {
        label: t('common.undo'),
        onAction: () => {
          removeMany(added.map((tx) => tx.id));
          haptic('select');
        },
      },
    });
    onClose();
    const income = added.find((tx) => tx.type === 'income');
    if (income && allocation.enabled) window.setTimeout(() => tools.open({ name: 'split', tx: income }), 450);
  };

  const restart = () => {
    haptic('select');
    setDrafts([]);
    setTranscript('');
    setError(null);
    setPhase('idle');
  };

  const listening = phase === 'recording';
  const thinking = phase === 'thinking';
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  const footer =
    phase === 'review' ? (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={restart}
          className="press flex min-h-14 shrink-0 items-center gap-1.5 rounded-2xl border border-line-strong px-4 text-[15px] font-medium text-ink-2 hover:bg-surface-2"
        >
          <RotateCcw className="size-4" aria-hidden />
          {t('voice.again')}
        </button>
        <button
          type="button"
          onClick={addAll}
          aria-disabled={!canAdd}
          className={`press flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold ${canAdd ? 'foil' : 'bg-surface-2 text-ink-3'}`}
        >
          <Check className="size-5" strokeWidth={2.5} aria-hidden />
          <span>{drafts.length === 1 ? t('voice.addOne') : t('voice.addAll')}</span>
          {drafts.length > 1 && (
            <span className="rounded-full bg-black/10 px-2 py-0.5 text-[13px] tabular" dir="ltr">
              {drafts.length}
            </span>
          )}
        </button>
      </div>
    ) : (
      <p className="text-center text-[12px] leading-snug text-ink-3">{t(voiceUsable ? 'voice.privacy' : 'voice.localNote')}</p>
    );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={t('voice.open')}
      title={t(phase === 'review' ? 'voice.review' : 'voice.title')}
      footer={footer}
    >
      {phase !== 'review' && (
        <div className="flex flex-col items-center pt-2 text-center">
          <p className="max-w-xs text-[15px] leading-relaxed text-ink-2">{t('voice.hint')}</p>

          {/* The orb: tap to speak, tap again to finish. */}
          <div
            ref={orbRef}
            className={`voice-orb my-6 ${listening ? 'is-listening' : ''} ${thinking ? 'is-thinking' : ''} ${voiceUsable ? '' : 'is-off'}`}
            style={{ '--lvl': 0 } as CSSProperties}
          >
            <span className="voice-ring" aria-hidden />
            <span className="voice-ring voice-ring-2" aria-hidden />
            <button
              type="button"
              onClick={() => void (listening ? stop() : start())}
              disabled={thinking}
              aria-label={t(listening ? 'voice.stop' : 'voice.start')}
              className="voice-button press"
            >
              {listening ? (
                <Square className="size-7" fill="currentColor" strokeWidth={0} aria-hidden />
              ) : thinking ? (
                <span className="voice-dots" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                <Mic className="size-9" strokeWidth={1.7} aria-hidden />
              )}
            </button>
          </div>

          <div className="min-h-[46px]" aria-live="polite">
            <p className="text-[16px] font-semibold">
              {listening ? t('voice.listening') : thinking ? t('voice.thinking') : t('voice.tap')}
            </p>
            {listening && (
              <p className="mt-0.5 text-[13px] text-ink-3">
                <span dir="ltr" className="tabular">
                  {clock}
                </span>{' '}
                · {t('voice.tapToStop')}
              </p>
            )}
          </div>

          {error && <ErrorNote message={t(error)} onSignIn={error === 'voice.err.signin' && auth.enabled ? auth.askToSignIn : undefined} />}

          {!listening && !thinking && (
            <ul className="mt-4 w-full space-y-1.5" aria-label={t('voice.hint')}>
              {(['voice.example1', 'voice.example2', 'voice.example3'] as const).map((key) => (
                <li key={key} className="rounded-xl bg-surface-2/70 px-3 py-2 text-[14px] text-ink-2">
                  {t(key)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {phase === 'review' && (
        <div className="space-y-3 pt-1">
          {transcript && (
            <figure className="rounded-2xl border border-line bg-surface px-4 py-3">
              <figcaption className="eyebrow mb-1">{t('voice.heard')}</figcaption>
              <blockquote className="text-[15px] leading-relaxed text-ink-2" dir="auto">
                «{transcript}»
              </blockquote>
            </figure>
          )}
          <p className="px-1 text-[13px] text-ink-3">{t('voice.reviewHint')}</p>
          {error && <ErrorNote message={t(error)} />}
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {drafts.map((d, i) => (
                <motion.li
                  key={d.key}
                  layout={!reduce}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { delay: Math.min(i, 5) * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] },
                  }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
                >
                  <DraftCard
                    draft={d}
                    problem={problems[i]}
                    incomeSources={incomeSources}
                    onChange={(change) => patch(d.key, change)}
                    onRemove={() => drop(d.key)}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <button
            type="button"
            onClick={() => {
              haptic('tap');
              setDrafts((list) => [...list, { ...blankDraft(), account: FALLBACK }]);
            }}
            className="press flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong text-[14px] font-medium text-ink-2 hover:bg-surface-2"
          >
            <Plus className="size-4" aria-hidden />
            {t('voice.addRow')}
          </button>
          {drafts.length > 1 && (
            <p className="flex items-center justify-between px-1 text-[13px] text-ink-3">
              <span>{t('voice.net')}</span>
              <Money value={net} sign className="text-[14px] font-semibold text-ink" />
            </p>
          )}
          {/* Speak again to add more to the same list. */}
          {voiceUsable && (
            <button
              type="button"
              onClick={() => void start()}
              className="press mx-auto flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium text-foil hover:bg-surface-2"
            >
              <Mic className="size-4" aria-hidden />
              {t('voice.tap')}
            </button>
          )}
        </div>
      )}

      {phase === 'idle' && (
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            void readTyped();
          }}
        >
          <div className="mb-2 flex items-center gap-3 text-[12px] text-ink-3">
            <span className="h-px flex-1 bg-line" />
            {t('voice.orType')}
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="flex items-center gap-2">
            <input
              className="field"
              value={typed}
              maxLength={TEXT_MAX_LENGTH}
              enterKeyHint="done"
              autoComplete="off"
              dir="auto"
              placeholder={t('voice.typePlaceholder')}
              aria-label={t('voice.orType')}
              onChange={(e) => setTyped(e.target.value)}
            />
            <button
              type="submit"
              disabled={!typed.trim()}
              className="foil press min-h-12 shrink-0 rounded-2xl px-4 text-[15px] font-semibold disabled:opacity-50"
            >
              {t('voice.read')}
            </button>
          </div>
        </form>
      )}
    </Sheet>
  );
}

function ErrorNote({ message, onSignIn }: { message: string; onSignIn?: () => void }) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="mt-3 w-full rounded-2xl px-4 py-3 text-start text-[14px] leading-relaxed"
      style={{ background: 'color-mix(in oklab, var(--out) 11%, var(--surface))' }}
    >
      <p>{message}</p>
      {onSignIn && (
        <button type="button" onClick={onSignIn} className="press mt-2 flex items-center gap-1.5 text-[14px] font-semibold text-foil">
          <LogIn className="size-4 rtl:-scale-x-100" aria-hidden />
          {t('cloud.signIn')}
        </button>
      )}
    </div>
  );
}

const TYPES: {
  value: TransactionType;
  icon: typeof ArrowUpRight;
  tone: string;
  key: 'common.expense' | 'common.income' | 'common.transfer';
}[] = [
  { value: 'expense', icon: ArrowUpRight, tone: 'var(--out)', key: 'common.expense' },
  { value: 'income', icon: ArrowDownLeft, tone: 'var(--in)', key: 'common.income' },
  { value: 'transfer', icon: ArrowLeftRight, tone: 'var(--ink)', key: 'common.transfer' },
];

/** One reviewed entry: every field a tap away. */
function DraftCard({
  draft,
  problem,
  incomeSources,
  onChange,
  onRemove,
}: {
  draft: VoiceDraft;
  problem: 'amount' | 'over' | null;
  incomeSources: string[];
  onChange: (change: Partial<VoiceDraft>) => void;
  onRemove: () => void;
}) {
  const { t, accountName, currencySymbol, symbolFirst, localize } = useI18n();
  const [raw, setRaw] = useState(() => (draft.amount ? String(draft.amount) : ''));
  const account = draftAccount(draft, FALLBACK);
  const other: AccountType = account === 'cash' ? 'bank' : 'cash';
  const tone = TYPES.find((x) => x.value === draft.type)!.tone;

  const day =
    draft.daysAgo === 0 ? t('voice.today') : draft.daysAgo === 1 ? t('voice.yesterday') : t('voice.daysAgo', { count: draft.daysAgo });

  return (
    <div className="card overflow-hidden border-s-[3px]" style={{ borderInlineStartColor: tone }}>
      <div className="flex items-center gap-1.5 px-3 pt-3">
        <div className="flex flex-1 gap-1" role="radiogroup" aria-label={t('composer.type')}>
          {TYPES.map(({ value, icon: Icon, tone: c, key }) => {
            const on = draft.type === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  haptic('select');
                  onChange({ type: value });
                }}
                className={`press flex min-h-9 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium transition-colors ${on ? 'text-bg' : 'text-ink-3 hover:text-ink'}`}
                style={on ? { background: c } : undefined}
              >
                <Icon className="size-3.5" aria-hidden />
                {t(key)}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            haptic('select');
            onChange({ daysAgo: draft.daysAgo ? 0 : 1 });
          }}
          className="press flex min-h-9 items-center gap-1 rounded-full px-2 text-[12px] text-ink-3 hover:bg-surface-2"
          aria-label={day}
        >
          <CalendarDays className="size-3.5" aria-hidden />
          {day}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('voice.remove')}
          className="press grid size-9 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-out"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 pt-2.5">
        <label className="relative min-w-0 flex-1" dir="ltr">
          <span className="sr-only">{t('voice.amount')}</span>
          {symbolFirst && (
            <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[15px] text-ink-3">{currencySymbol}</span>
          )}
          <input
            className={`field font-display !text-[22px] tabular ${symbolFirst ? 'ps-10' : 'pe-12'}`}
            inputMode="decimal"
            dir="ltr"
            value={raw}
            placeholder="0"
            aria-invalid={problem !== null}
            onChange={(e) => {
              const v = e.target.value.replace(/[٠-٩]/g, (ch) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch))).replace(/[^\d.,]/g, '');
              setRaw(v);
              onChange({ amount: roundMoney(parseFloat(v.replace(',', '.')) || 0) });
            }}
          />
          {!symbolFirst && (
            <span className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-[15px] text-ink-3">{currencySymbol}</span>
          )}
        </label>

        {/* Account: one tap swaps it (for a transfer, both ends). */}
        <button
          type="button"
          onClick={() => {
            haptic('select');
            onChange({ account: other });
          }}
          className="press flex min-h-12 shrink-0 items-center gap-1.5 rounded-2xl border border-line-strong px-3 text-[14px] font-medium hover:bg-surface-2"
          aria-label={draft.type === 'transfer' ? `${accountName(account)} → ${accountName(other)}` : accountName(account)}
        >
          {account === 'cash' ? (
            <Wallet className="size-4 text-coin" aria-hidden />
          ) : (
            <Landmark className="size-4 text-ink-2" aria-hidden />
          )}
          {accountName(account)}
          {draft.type === 'transfer' && (
            <>
              <ArrowLeftRight className="size-3.5 text-ink-3" aria-hidden />
              {accountName(other)}
            </>
          )}
        </button>
      </div>
      {problem && (
        <p className="px-4 pt-1.5 text-[12px] font-medium text-out" role="alert">
          {problem === 'over' ? t('voice.over', { account: accountName(account) }) : t('voice.needAmount')}
        </p>
      )}

      {draft.type === 'expense' && (
        <div
          className="no-scrollbar rail-fade flex gap-1.5 overflow-x-auto px-3 pt-2.5"
          role="radiogroup"
          aria-label={t('composer.category')}
        >
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const on = draft.category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  haptic('select');
                  onChange({ category: c.id });
                }}
                className={`chip press !min-h-[34px] shrink-0 !px-2.5 !text-[13px] ${on ? '!border-transparent !text-ink' : ''}`}
                style={
                  on
                    ? { background: `color-mix(in oklab, ${c.hue} 24%, var(--surface))`, boxShadow: `inset 0 0 0 1.5px ${c.hue}` }
                    : undefined
                }
              >
                <Icon className="size-3.5 shrink-0" style={{ color: `color-mix(in oklab, ${c.hue} 80%, var(--ink))` }} aria-hidden />
                {t(c.labelKey)}
              </button>
            );
          })}
        </div>
      )}
      {draft.type === 'income' && incomeSources.length > 0 && (
        <div
          className="no-scrollbar rail-fade flex gap-1.5 overflow-x-auto px-3 pt-2.5"
          role="radiogroup"
          aria-label={t('composer.source')}
        >
          {incomeSources.map((s) => {
            const on = draft.source === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  haptic('select');
                  onChange({ source: on ? '' : s });
                }}
                className={`chip press !min-h-[34px] shrink-0 !px-2.5 !text-[13px] ${on ? '!border-transparent !text-ink' : ''}`}
                style={
                  on
                    ? { background: 'color-mix(in oklab, var(--in) 20%, var(--surface))', boxShadow: 'inset 0 0 0 1.5px var(--in)' }
                    : undefined
                }
              >
                {localize(s)}
              </button>
            );
          })}
        </div>
      )}

      <div className="p-3 pt-2.5">
        <input
          className="field !min-h-11 !text-[14px]"
          value={draft.note}
          maxLength={60}
          dir="auto"
          placeholder={t('voice.note')}
          aria-label={t('voice.note')}
          onChange={(e) => onChange({ note: e.target.value })}
        />
      </div>
    </div>
  );
}
