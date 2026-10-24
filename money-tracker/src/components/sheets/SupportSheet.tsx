import { Bug, Lightbulb, LoaderCircle, LogIn, Mail, MessageCircle, Send } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { APP_VERSION } from '../../lib/boot';
import { haptic } from '../../lib/haptics';
import { SUPPORT_EMAIL } from '../../lib/links';
import { supabase } from '../../lib/supabase';
import {
  SUPPORT_MAX_LENGTH,
  pullSupport,
  sendSupport,
  type SupportFailure,
  type SupportKind,
  type SupportMessage,
} from '../../lib/support';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { Guilloche } from '../ui/Engraving';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';

/** True when this build has any way to reach the team (an account to write from, or an address). */
export function supportAvailable(cloud: boolean): boolean {
  return cloud || SUPPORT_EMAIL !== '';
}

/** A problem, a wish or anything else, sent to the team from the signed-in account; earlier messages and their answers below. */
export function SupportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, dayLabel } = useI18n();
  const auth = useAuth();
  const toast = useToast();
  const [kind, setKind] = useState<SupportKind>('problem');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SupportFailure | 'empty' | null>(null);
  const [history, setHistory] = useState<SupportMessage[]>([]);
  const fieldId = useId();
  const userId = auth.user?.id ?? null;
  const message = text.trim();

  // Another account, another conversation.
  useEffect(() => {
    setHistory([]);
    setText('');
    setError(null);
  }, [userId]);

  useEffect(() => {
    if (!open || !supabase || !userId) return;
    let stale = false;
    pullSupport(supabase)
      .then((list) => !stale && setHistory(list))
      .catch(() => {
        // Offline: the form still works once the connection is back.
      });
    return () => {
      stale = true;
    };
  }, [open, userId]);

  const send = async () => {
    if (!supabase || busy) return;
    if (!message) {
      setError('empty');
      return haptic('warning');
    }
    setBusy(true);
    setError(null);
    const result = await sendSupport(supabase, kind, message, {
      version: APP_VERSION,
      lang,
      edition: document.documentElement.dataset.edition ?? '',
      agent: navigator.userAgent.slice(0, 200),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.reason);
      return haptic('warning');
    }
    setHistory((list) => [result.message, ...list]);
    setText('');
    haptic('success');
    toast.show({ message: t('support.sent') });
  };

  const email = SUPPORT_EMAIL && (
    <a
      href={`mailto:${SUPPORT_EMAIL}`}
      className="press flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line-strong px-4 text-[15px] font-medium hover:bg-surface-2"
    >
      <Mail className="size-[18px] shrink-0" aria-hidden />
      <span dir="ltr">{SUPPORT_EMAIL}</span>
    </a>
  );

  if (!supabase || !userId) {
    return (
      <Sheet open={open} onClose={onClose} title={t('support.title')}>
        <div className="flex flex-col items-center px-2 pt-1 pb-4 text-center">
          <Guilloche className="size-20 text-foil opacity-50" density="light" />
          <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-2">
            {t(auth.enabled ? 'support.signInLead' : 'support.emailLead')}
          </p>
        </div>
        <div className="space-y-2.5">
          {auth.enabled && (
            <button
              type="button"
              data-autofocus
              onClick={() => {
                onClose();
                auth.askToSignIn();
              }}
              className="foil press flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold"
            >
              <LogIn className="size-5 rtl:-scale-x-100" aria-hidden />
              {t('cloud.signIn')}
            </button>
          )}
          {email}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('support.title')}
      footer={
        <button
          type="submit"
          form="support-form"
          disabled={busy}
          className="foil press flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Send className="size-5 rtl:-scale-x-100" aria-hidden />}
          {t('support.send')}
        </button>
      }
    >
      <form
        id="support-form"
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <p className="text-[15px] leading-relaxed text-ink-2">{t('support.lead')}</p>

        <Segmented
          label={t('support.kind')}
          value={kind}
          onChange={(k: SupportKind) => setKind(k)}
          options={[
            { value: 'problem', label: t('support.kind.problem'), icon: <Bug className="size-4 shrink-0" aria-hidden /> },
            { value: 'request', label: t('support.kind.request'), icon: <Lightbulb className="size-4 shrink-0" aria-hidden /> },
            { value: 'other', label: t('support.kind.other'), icon: <MessageCircle className="size-4 shrink-0" aria-hidden /> },
          ]}
        />

        <div>
          <label htmlFor={fieldId} className="eyebrow mb-2 block">
            {t('support.message')}
          </label>
          <textarea
            id={fieldId}
            data-autofocus
            className="field min-h-36 resize-none py-3 leading-relaxed"
            value={text}
            maxLength={SUPPORT_MAX_LENGTH}
            placeholder={t(`support.placeholder.${kind}`)}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error === 'empty'}
            aria-describedby={`${fieldId}-note`}
          />
          <div id={`${fieldId}-note`} className="mt-1.5 flex items-start justify-between gap-3 text-[13px]">
            {error ? (
              <p role="alert" className="font-medium text-out">
                {t(`support.err.${error}`)}
              </p>
            ) : (
              <p className="text-ink-3">{t('support.contextNote')}</p>
            )}
            <span className="shrink-0 tabular text-ink-3" dir="ltr">
              {text.length}/{SUPPORT_MAX_LENGTH}
            </span>
          </div>
        </div>
      </form>

      {email && (
        <div className="mt-5">
          <p className="mb-2 text-[13px] text-ink-3">{t('support.orEmail')}</p>
          {email}
        </div>
      )}

      {history.length > 0 && (
        <section className="mt-7">
          <h3 className="eyebrow mb-2">{t('support.history')}</h3>
          <ul className="space-y-2.5">
            {history.map((m) => (
              <li key={m.id} className="rounded-2xl border border-line p-3.5">
                <div className="flex items-center gap-2 text-[13px] text-ink-3">
                  <span className="font-medium text-ink-2">{t(`support.kind.${m.kind}`)}</span>
                  <span aria-hidden>·</span>
                  <span className="min-w-0 flex-1 truncate">{dayLabel(new Date(m.createdAt))}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium ${m.status === 'open' ? 'bg-surface-2 text-ink-2' : 'bg-in/15 text-in'}`}
                  >
                    {t(`support.status.${m.status}`)}
                  </span>
                </div>
                <p className="mt-2 text-[15px] leading-relaxed break-words whitespace-pre-wrap" dir="auto">
                  {m.message}
                </p>
                {m.reply && (
                  <div className="mt-3 rounded-xl bg-surface-2 p-3">
                    <p className="eyebrow mb-1 !text-foil">{t('support.reply')}</p>
                    <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap" dir="auto">
                      {m.reply}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Sheet>
  );
}
