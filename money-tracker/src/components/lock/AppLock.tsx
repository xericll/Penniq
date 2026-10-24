import { AnimatePresence, motion } from 'motion/react';
import { Copy, Delete, Fingerprint, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { haptic } from '../../lib/haptics';
import {
  LOCK_TIMEOUTS,
  biometricAvailable,
  checkPin,
  checkRecovery,
  createLock,
  loadLock,
  newRecoveryCode,
  registerBiometric,
  saveLock,
  verifyBiometric,
  type LockConfig,
  type LockTimeout,
} from '../../lib/lock';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { Mark } from '../ui/Logo';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { Switch } from '../ui/Switch';

const PIN_LENGTH = 4;
const MAX_TRIES = 5;
const COOLDOWN_MS = 30_000;

interface LockValue {
  config: LockConfig | null;
  locked: boolean;
  setConfig: (c: LockConfig | null) => void;
  unlock: () => void;
}

const LockContext = createContext<LockValue | null>(null);

export function useAppLock(): LockValue {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useAppLock must be used inside <LockProvider>');
  return ctx;
}

/**
 * Keeps the lock state: locked at every start while a PIN is set, and again after the app was
 * left (or not touched) for the chosen time. "Immediately" locks as soon as the app is left.
 */
export function LockProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<LockConfig | null>(loadLock);
  const [locked, setLocked] = useState(() => loadLock() !== null);
  const lastActive = useRef(Date.now());
  const hiddenAt = useRef<number | null>(null);

  const setConfig = useCallback((c: LockConfig | null) => {
    saveLock(c);
    setConfigState(c);
  }, []);
  const unlock = useCallback(() => {
    lastActive.current = Date.now();
    setLocked(false);
  }, []);

  useEffect(() => {
    if (!config) return;
    const limit = config.timeout * 1000;
    const touch = () => (lastActive.current = Date.now());
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (hiddenAt.current !== null && Date.now() - hiddenAt.current >= limit) setLocked(true);
    };
    const idle = window.setInterval(() => {
      if (limit > 0 && document.visibilityState === 'visible' && Date.now() - lastActive.current >= limit) setLocked(true);
    }, 10_000);
    window.addEventListener('pointerdown', touch, { passive: true });
    window.addEventListener('keydown', touch);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(idle);
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [config]);

  const value = useMemo(() => ({ config, locked: locked && config !== null, setConfig, unlock }), [config, locked, setConfig, unlock]);
  return (
    <LockContext.Provider value={value}>
      {children}
      <AnimatePresence>{value.locked && <LockScreen key="lock" />}</AnimatePresence>
    </LockContext.Provider>
  );
}

/* ---------------- PIN entry ---------------- */

function PinDots({ length, filled, error }: { length: number; filled: number; error: boolean }) {
  return (
    <div className={`flex justify-center gap-4 ${error ? 'shake' : ''}`} dir="ltr" aria-hidden>
      {Array.from({ length }, (_, i) => (
        <motion.span
          key={i}
          animate={{ scale: i < filled ? 1.15 : 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          className={`size-3.5 rounded-full border-2 ${i < filled ? (error ? 'border-out bg-out' : 'border-coin bg-coin') : 'border-line-strong'}`}
        />
      ))}
    </div>
  );
}

function PinPad({ onDigit, onBack, extra }: { onDigit: (d: string) => void; onBack: () => void; extra?: React.ReactNode }) {
  const { t } = useI18n();
  const key = 'press grid h-16 place-items-center rounded-full text-[26px] font-display tabular hover:bg-surface-2 active:bg-surface-2';
  return (
    <div
      dir="ltr"
      className="mx-auto grid w-full max-w-[300px] grid-cols-3 gap-3 touch-manipulation"
      role="group"
      aria-label={t('keypad.label')}
    >
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button key={d} type="button" className={key} onClick={() => onDigit(d)}>
          {d}
        </button>
      ))}
      <div className="grid place-items-center">{extra}</div>
      <button type="button" className={key} onClick={() => onDigit('0')}>
        0
      </button>
      <button type="button" className={`${key} text-ink-2`} onClick={onBack} aria-label={t('keypad.delete')}>
        <Delete className="size-6" />
      </button>
    </div>
  );
}

/** Collects four digits and hands them over; `error` shakes the dots and clears them. */
function usePinInput(onComplete: (pin: string) => void) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const push = (d: string) => {
    if (busy.current) return;
    haptic('tap');
    setError(false);
    setPin((p) => {
      const next = (p + d).slice(0, PIN_LENGTH);
      if (next.length === PIN_LENGTH) {
        busy.current = true;
        window.setTimeout(() => {
          onComplete(next);
          busy.current = false;
        }, 120);
      }
      return next;
    });
  };
  const back = () => setPin((p) => p.slice(0, -1));
  const fail = () => {
    haptic('warning');
    setError(true);
    window.setTimeout(() => setPin(''), 380);
  };
  return { pin, error, push, back, fail, reset: () => setPin('') };
}

/* ---------------- Lock screen ---------------- */

function LockScreen() {
  const { t } = useI18n();
  const { config, unlock, setConfig } = useAppLock();
  const auth = useAuth();
  const toast = useToast();
  const [tries, setTries] = useState(0);
  const [until, setUntil] = useState(0);
  const [mode, setMode] = useState<'pin' | 'forgot'>('pin');
  const [, tick] = useState(0);
  const input = usePinInput(async (pin) => {
    if (!config) return;
    if (await checkPin(config, pin)) {
      haptic('success');
      unlock();
      return;
    }
    input.fail();
    const n = tries + 1;
    setTries(n);
    if (n >= MAX_TRIES) {
      setUntil(Date.now() + COOLDOWN_MS);
      setTries(0);
    }
  });
  const waiting = until > Date.now();

  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => tick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [waiting]);

  const bio = async () => {
    if (!config?.credentialId) return;
    if (await verifyBiometric(config.credentialId)) {
      haptic('success');
      unlock();
    }
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={t('lock.title')}
      // Appears at once (nothing of the wallet may show through); fades away once unlocked.
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      className="fixed inset-0 z-[100] flex flex-col items-center overflow-y-auto bg-bg px-6 pt-[calc(env(safe-area-inset-top)+48px)] pb-[calc(env(safe-area-inset-bottom)+24px)] text-ink"
    >
      <motion.div
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="coin grid size-16 place-items-center rounded-full">
          <Mark size={26} color="var(--on-coin)" />
        </span>
      </motion.div>
      {mode === 'pin' ? (
        <>
          <h1 className="font-display mt-5 text-[26px]">{t('lock.title')}</h1>
          <p className="mt-1 min-h-5 text-[14px] text-ink-3" role="status">
            {waiting
              ? t('lock.wait', { seconds: Math.ceil((until - Date.now()) / 1000) })
              : input.error
                ? t('lock.wrong')
                : t('lock.enter')}
          </p>
          <div className="mt-7 mb-9">
            <PinDots length={PIN_LENGTH} filled={input.pin.length} error={input.error} />
          </div>
          <div className={`w-full ${waiting ? 'pointer-events-none opacity-40' : ''}`}>
            <PinPad
              onDigit={input.push}
              onBack={input.back}
              extra={
                config?.credentialId ? (
                  <button
                    type="button"
                    onClick={() => void bio()}
                    aria-label={t('lock.biometric')}
                    className="press grid size-16 place-items-center rounded-full text-foil hover:bg-surface-2"
                  >
                    <Fingerprint className="size-7" />
                  </button>
                ) : null
              }
            />
          </div>
          <button
            type="button"
            onClick={() => setMode('forgot')}
            className="press mt-6 min-h-11 rounded-xl px-4 text-[14px] font-medium text-foil"
          >
            {t('lock.forgot')}
          </button>
        </>
      ) : (
        <ForgotPanel
          onBack={() => setMode('pin')}
          onRecovered={() => {
            setConfig(null);
            unlock();
            toast.show({ message: t('lock.recovered'), duration: 7000 });
          }}
          email={auth.user?.email}
          signIn={auth.enabled && auth.user ? auth.signIn : undefined}
          config={config}
        />
      )}
    </motion.div>
  );
}

/** Forgot the PIN: the recovery code, or the account password when signed in. The data is never touched. */
function ForgotPanel({
  onBack,
  onRecovered,
  email,
  signIn,
  config,
}: {
  onBack: () => void;
  onRecovered: () => void;
  email?: string;
  signIn?: (email: string, password: string) => Promise<{ ok: boolean }>;
  config: LockConfig | null;
}) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const withCode = async () => {
    if (!config || busy) return;
    setBusy(true);
    const ok = await checkRecovery(config, code);
    setBusy(false);
    if (ok) onRecovered();
    else {
      haptic('warning');
      setError(t('lock.badCode'));
    }
  };
  const withPassword = async () => {
    if (!email || !signIn || busy) return;
    setBusy(true);
    const res = await signIn(email, password);
    setBusy(false);
    if (res.ok) onRecovered();
    else {
      haptic('warning');
      setError(t('lock.badPassword'));
    }
  };

  return (
    <div className="mt-5 w-full max-w-sm">
      <h1 className="font-display text-center text-[24px]">{t('lock.forgotTitle')}</h1>
      <p className="mt-2 text-center text-[14px] leading-relaxed text-ink-2">{t('lock.forgotBody')}</p>
      <form
        className="mt-6 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void withCode();
        }}
      >
        <label className="eyebrow block" htmlFor="lock-code">
          {t('lock.recoveryCode')}
        </label>
        <input
          id="lock-code"
          className="field font-mono tracking-[0.2em] uppercase"
          dir="ltr"
          autoComplete="off"
          value={code}
          placeholder="XXXX-XXXX-XXXX"
          onChange={(e) => {
            setCode(e.target.value);
            setError('');
          }}
        />
        <button type="submit" className="foil press min-h-12 w-full rounded-2xl text-[15px] font-semibold">
          {t('lock.useCode')}
        </button>
      </form>
      {email && signIn && (
        <form
          className="mt-6 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void withPassword();
          }}
        >
          <label className="eyebrow block" htmlFor="lock-pass">
            {t('lock.accountPassword', { email })}
          </label>
          <input
            id="lock-pass"
            type="password"
            className="field"
            dir="ltr"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
          />
          <button
            type="submit"
            className="press min-h-12 w-full rounded-2xl border border-line-strong text-[15px] font-medium hover:bg-surface-2"
          >
            {t('lock.usePassword')}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-3 text-center text-[13px] font-medium text-out">
          {error}
        </p>
      )}
      <p className="mt-5 rounded-2xl bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-ink-2">{t('lock.dataSafe')}</p>
      <button
        type="button"
        onClick={onBack}
        className="press mx-auto mt-4 block min-h-11 rounded-xl px-4 text-[14px] font-medium text-foil"
      >
        {t('lock.backToPin')}
      </button>
    </div>
  );
}

/* ---------------- Settings: set up, change, turn off ---------------- */

type Step = 'overview' | 'verify' | 'new' | 'confirm' | 'recovery';

export function LockSetupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { config, setConfig } = useAppLock();
  const toast = useToast();
  const [step, setStep] = useState<Step>('overview');
  const [purpose, setPurpose] = useState<'change' | 'off'>('change');
  const [first, setFirst] = useState('');
  const [code, setCode] = useState('');
  const [timeout, setTimeoutValue] = useState<LockTimeout>(60);
  const [canBio, setCanBio] = useState(false);
  const [useBio, setUseBio] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(config ? 'overview' : 'new');
    setFirst('');
    setTimeoutValue(config?.timeout ?? 60);
    setUseBio(!!config?.credentialId);
    void biometricAvailable().then(setCanBio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const verify = usePinInput(async (pin) => {
    if (config && (await checkPin(config, pin))) {
      verify.reset();
      if (purpose === 'off') {
        setConfig(null);
        haptic('success');
        toast.show({ message: t('lock.turnedOff') });
        onClose();
      } else setStep('new');
    } else verify.fail();
  });
  const choose = usePinInput((pin) => {
    setFirst(pin);
    choose.reset();
    setStep('confirm');
  });
  const confirm = usePinInput(async (pin) => {
    if (pin !== first) {
      confirm.fail();
      window.setTimeout(() => setStep('new'), 500);
      return;
    }
    confirm.reset();
    const recovery = newRecoveryCode();
    setCode(recovery);
    const next = await createLock(pin, recovery, timeout);
    setConfig({ ...next, credentialId: config?.credentialId });
    setStep('recovery');
  });

  const toggleBio = async () => {
    if (!config) return;
    if (useBio) {
      setConfig({ ...config, credentialId: undefined });
      setUseBio(false);
      return;
    }
    const id = await registerBiometric(t('lock.passkeyName'));
    if (id) {
      setConfig({ ...config, credentialId: id });
      setUseBio(true);
      haptic('success');
    } else toast.show({ message: t('lock.bioFailed') });
  };

  const pinStep = (title: string, input: ReturnType<typeof usePinInput>, hint?: string) => (
    <div className="flex flex-col items-center py-2">
      <p className="text-[16px] font-semibold">{title}</p>
      <p className="mt-1 min-h-5 text-[13px] text-ink-3">{input.error ? t('lock.mismatch') : hint}</p>
      <div className="mt-5 mb-6">
        <PinDots length={PIN_LENGTH} filled={input.pin.length} error={input.error} />
      </div>
      <PinPad onDigit={input.push} onBack={input.back} />
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={t('lock.settingsTitle')}>
      {step === 'overview' && config && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4">
            <span className="coin grid size-11 shrink-0 place-items-center rounded-full" aria-hidden>
              <ShieldCheck className="size-5" />
            </span>
            <p className="text-[14px] leading-relaxed text-ink-2">{t('lock.onBody')}</p>
          </div>
          <div>
            <span className="eyebrow mb-2 block">{t('lock.after')}</span>
            <Segmented
              label={t('lock.after')}
              value={String(config.timeout)}
              onChange={(v) => {
                const tv = Number(v) as LockTimeout;
                setTimeoutValue(tv);
                setConfig({ ...config, timeout: tv });
              }}
              options={LOCK_TIMEOUTS.map((s) => ({ value: String(s), label: t(`lock.timeout.${s}`) }))}
            />
          </div>
          {canBio && (
            <button
              type="button"
              role="switch"
              aria-checked={useBio}
              onClick={() => void toggleBio()}
              className="press flex min-h-[60px] w-full items-center gap-3 rounded-2xl border border-line px-4 py-3 text-start"
            >
              <Fingerprint className="size-5 shrink-0 text-foil" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">{t('lock.biometric')}</span>
                <span className="mt-0.5 block text-[13px] text-ink-3">{t('lock.biometricHint')}</span>
              </span>
              <Switch on={useBio} />
            </button>
          )}
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => {
                setPurpose('change');
                setStep('verify');
              }}
              className="press flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line-strong text-[15px] font-medium hover:bg-surface-2"
            >
              <KeyRound className="size-4" aria-hidden />
              {t('lock.change')}
            </button>
            <button
              type="button"
              onClick={() => {
                setPurpose('off');
                setStep('verify');
              }}
              className="press min-h-12 rounded-2xl text-[15px] font-medium text-out hover:bg-surface-2"
            >
              {t('lock.turnOff')}
            </button>
          </div>
        </div>
      )}

      {step === 'verify' && pinStep(t('lock.current'), verify)}
      {step === 'new' && (
        <>
          {!config && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-surface-2 p-4">
              <Lock className="size-5 shrink-0 text-foil" aria-hidden />
              <p className="text-[14px] leading-relaxed text-ink-2">{t('lock.intro')}</p>
            </div>
          )}
          {pinStep(t('lock.choose'), choose, t('lock.chooseHint'))}
        </>
      )}
      {step === 'confirm' && pinStep(t('lock.repeat'), confirm)}
      {step === 'recovery' && (
        <div className="space-y-4">
          <p className="text-[15px] leading-relaxed text-ink-2">{t('lock.recoveryBody')}</p>
          <div className="rounded-2xl border border-dashed border-foil bg-surface-2 p-5 text-center">
            <span className="serial block text-[22px] tracking-[0.18em] text-ink" dir="ltr">
              {code}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(code).then(
                () => toast.show({ message: t('share.copied') }),
                () => undefined,
              );
            }}
            className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line-strong text-[15px] font-medium hover:bg-surface-2"
          >
            <Copy className="size-4" aria-hidden />
            {t('lock.copyCode')}
          </button>
          <button
            type="button"
            onClick={() => {
              haptic('success');
              toast.show({ message: t('lock.turnedOn') });
              onClose();
            }}
            className="foil press min-h-13 w-full rounded-2xl text-[16px] font-semibold"
          >
            {t('lock.saved')}
          </button>
        </div>
      )}
    </Sheet>
  );
}
