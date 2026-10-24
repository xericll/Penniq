import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Eye, EyeOff, LoaderCircle, MailCheck } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Guilloche, MicroBorder } from '../components/ui/Engraving';
import { Logo } from '../components/ui/Logo';
import { Segmented } from '../components/ui/Segmented';
import { useI18n } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/translations';
import { LANGUAGES, type Language } from '../i18n/types';
import { haptic } from '../lib/haptics';
import { useAuth, type AuthFailure, type AuthResult } from '../state/AuthContext';

type Mode = 'signin' | 'signup' | 'forgot';

const MIN_PASSWORD = 8;

const FAILURES: Record<AuthFailure, TranslationKey> = {
  invalid: 'auth.err.invalid',
  exists: 'auth.err.exists',
  weak: 'auth.err.weak',
  unconfirmed: 'auth.err.unconfirmed',
  rate: 'auth.err.rate',
  email: 'auth.err.email',
  notAllowed: 'auth.err.notAllowed',
  network: 'auth.err.network',
  unknown: 'auth.err.unknown',
};

/**
 * The door to the wallet: sign in, open an account, or reset a password.
 * Also shown to choose a new password after following a reset e-mail.
 */
export function AuthScreen() {
  const { t, lang, setLang } = useI18n();
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  /** Shown instead of the form after an e-mail went out. */
  const [sent, setSent] = useState<'confirm' | 'reset' | null>(null);
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  const recovering = auth.recovering;
  const needsEmail = !recovering;
  const needsPassword = recovering || mode !== 'forgot';
  const choosing = recovering || mode === 'signup';

  useEffect(() => setError(null), [mode, recovering]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const address = email.trim();
    if (needsEmail && !/^\S+@\S+\.\S+$/.test(address)) return fail('auth.err.email');
    if (needsPassword && choosing && password.length < MIN_PASSWORD) return fail('auth.err.weak');
    if (needsPassword && !password) return fail('auth.err.invalid');

    setBusy(true);
    setError(null);
    let result: AuthResult;
    if (recovering) result = await auth.updatePassword(password);
    else if (mode === 'signin') result = await auth.signIn(address, password);
    else if (mode === 'signup') result = await auth.signUp(address, password);
    else result = await auth.sendReset(address);
    setBusy(false);

    if (!result.ok) return fail(FAILURES[result.reason]);
    haptic('success');
    setPassword('');
    if (mode === 'forgot' && !recovering) setSent('reset');
    else if (result.confirmEmail) setSent('confirm');
  };

  const fail = (key: TranslationKey) => {
    haptic('warning');
    setError(key);
  };

  const title = recovering ? t('auth.newPassword.title') : mode === 'forgot' ? t('auth.forgot.title') : t('auth.title');
  const lead = recovering ? t('auth.newPassword.lead') : mode === 'forgot' ? t('auth.forgot.lead') : t('auth.lead');
  const action = recovering
    ? t('auth.newPassword.submit')
    : mode === 'signin'
      ? t('auth.signIn')
      : mode === 'signup'
        ? t('auth.signUp')
        : t('auth.forgot.submit');

  return (
    // overflow-clip, not hidden: a hidden box still scrolls sideways to the engraving when a field is focused.
    <main className="relative isolate grid min-h-dvh place-items-center overflow-clip px-4 pt-[calc(env(safe-area-inset-top)+20px)] pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <Guilloche className="absolute -top-28 -end-28 -z-10 size-[420px] text-foil opacity-[0.16]" spin />
      <Guilloche className="absolute -bottom-40 -start-36 -z-10 size-[360px] text-foil opacity-[0.07]" density="light" />

      <motion.div
        className="w-full max-w-[420px]"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo variant="stacked" size={64} />
          <p className="mt-2.5 text-[14px] text-ink-2">{t('app.tagline')}</p>
        </div>

        <section className="card relative overflow-hidden p-6 sm:p-7" aria-labelledby="auth-title">
          <MicroBorder radius={24} className="text-foil opacity-30" />

          <AnimatePresence mode="wait" initial={false}>
            {sent ? (
              <motion.div
                key="sent"
                className="relative flex flex-col items-center py-4 text-center"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <span className="foil grid size-14 place-items-center rounded-full" aria-hidden>
                  <MailCheck className="size-6" />
                </span>
                <h1 id="auth-title" className="mt-4 text-[20px] font-semibold">
                  {t('auth.sent.title')}
                </h1>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
                  {t(sent === 'confirm' ? 'auth.sent.confirm' : 'auth.sent.reset')}
                </p>
                <p className="serial mt-3 break-all text-ink-3" dir="ltr">
                  {email.trim()}
                </p>
                <button
                  type="button"
                  className="press mt-6 min-h-12 w-full rounded-2xl border border-line-strong text-[15px] font-semibold hover:bg-surface-2"
                  onClick={() => {
                    setSent(null);
                    setMode('signin');
                  }}
                >
                  {t('auth.backToSignIn')}
                </button>
              </motion.div>
            ) : (
              <motion.div key="form" className="relative" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h1 id="auth-title" className="text-[22px] leading-tight font-semibold">
                  {title}
                </h1>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{lead}</p>

                {!recovering && mode !== 'forgot' && (
                  <Segmented
                    className="mt-5"
                    label={t('auth.title')}
                    value={mode}
                    onChange={(m: Mode) => setMode(m)}
                    options={[
                      { value: 'signin', label: t('auth.tab.signIn') },
                      { value: 'signup', label: t('auth.tab.signUp') },
                    ]}
                    size="lg"
                  />
                )}

                <form className="mt-5 space-y-3.5" onSubmit={submit} noValidate>
                  {needsEmail && (
                    <div>
                      <label htmlFor={emailId} className="eyebrow mb-1.5 block">
                        {t('auth.email')}
                      </label>
                      <input
                        id={emailId}
                        className="field"
                        type="email"
                        dir="ltr"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        aria-invalid={error === 'auth.err.email'}
                        aria-describedby={error ? errorId : undefined}
                      />
                    </div>
                  )}

                  {needsPassword && (
                    <div>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <label htmlFor={passwordId} className="eyebrow">
                          {t(recovering ? 'auth.newPassword.label' : 'auth.password')}
                        </label>
                        {mode === 'signin' && !recovering && (
                          <button
                            type="button"
                            className="text-[13px] font-medium text-foil hover:underline"
                            onClick={() => setMode('forgot')}
                          >
                            {t('auth.forgot.link')}
                          </button>
                        )}
                      </div>
                      <div className="relative" dir="ltr">
                        <input
                          id={passwordId}
                          className="field pe-12"
                          type={reveal ? 'text' : 'password'}
                          dir="ltr"
                          autoComplete={choosing ? 'new-password' : 'current-password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          aria-invalid={error === 'auth.err.weak' || error === 'auth.err.invalid'}
                          aria-describedby={error ? errorId : undefined}
                        />
                        <button
                          type="button"
                          className="press absolute end-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-xl text-ink-3 hover:text-ink"
                          onClick={() => setReveal((v) => !v)}
                          aria-label={t(reveal ? 'auth.hidePassword' : 'auth.showPassword')}
                          aria-pressed={reveal}
                        >
                          {reveal ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                        </button>
                      </div>
                      {choosing && <p className="mt-1.5 text-[13px] text-ink-3">{t('auth.passwordHint', { count: MIN_PASSWORD })}</p>}
                    </div>
                  )}

                  {error && (
                    <p id={errorId} role="alert" className="text-[14px] leading-snug font-medium text-out">
                      {t(error)}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="foil press flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold disabled:opacity-70"
                  >
                    {busy ? (
                      <LoaderCircle className="size-5 animate-spin" aria-hidden />
                    ) : (
                      <ArrowRight className="size-5 rtl:-scale-x-100" aria-hidden />
                    )}
                    {action}
                  </button>
                </form>

                {mode === 'forgot' && !recovering && (
                  <button
                    type="button"
                    className="press mt-3 min-h-11 w-full rounded-2xl text-[15px] font-medium text-ink-2 hover:text-ink"
                    onClick={() => setMode('signin')}
                  >
                    {t('auth.backToSignIn')}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {!recovering && (
          <div className="mt-4 text-center">
            <button
              type="button"
              className="press min-h-11 rounded-2xl px-4 text-[15px] font-medium text-ink-2 hover:text-ink"
              onClick={auth.continueAsGuest}
            >
              {t('auth.guest')}
            </button>
            <p className="mx-auto max-w-[320px] text-[13px] leading-relaxed text-ink-3">{t('auth.guestHint')}</p>
          </div>
        )}

        <div className="mt-3 flex justify-center gap-1" role="group" aria-label={t('settings.language')}>
          {(Object.keys(LANGUAGES) as Language[]).map((l) => (
            <button
              key={l}
              type="button"
              lang={l}
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className={`press min-h-10 rounded-xl px-3 text-[13px] ${lang === l ? 'font-semibold text-ink' : 'text-ink-3 hover:text-ink-2'}`}
            >
              {LANGUAGES[l].nativeName}
            </button>
          ))}
        </div>
      </motion.div>
    </main>
  );
}
