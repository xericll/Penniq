import { motion } from 'motion/react';
import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { APP_VERSION } from '../../lib/boot';
import { haptic } from '../../lib/haptics';
import { APP_URL, STORE_URL } from '../../lib/links';
import { KEYS, write } from '../../lib/storage';
import { sendSupport } from '../../lib/support';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { Sheet } from '../ui/Sheet';

/** "Share app": the system share sheet where there is one, otherwise the link is copied. */
export function useShareApp() {
  const { t } = useI18n();
  const toast = useToast();
  return async () => {
    const text = t('share.text');
    haptic('select');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Penniq', text, url: APP_URL });
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${APP_URL}`);
      toast.show({ message: t('share.copied') });
    } catch {
      toast.show({ message: APP_URL, duration: 8000 });
    }
  };
}

/** "Rate app": five stars and an optional comment. Signed-in users send it to the team as a support message. */
export function RateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStars(0);
    setComment('');
  }, [open]);

  const submit = async () => {
    if (!stars) return haptic('warning');
    write(KEYS.rating, JSON.stringify({ stars, comment: comment.trim(), at: new Date().toISOString() }));
    if (STORE_URL && stars >= 4) {
      window.open(STORE_URL, '_blank', 'noopener');
    } else if (supabase && user) {
      setBusy(true);
      await sendSupport(supabase, 'other', `★ ${stars}/5${comment.trim() ? `\n${comment.trim()}` : ''}`, {
        version: APP_VERSION,
        lang,
        edition: document.documentElement.dataset.edition ?? '',
        agent: navigator.userAgent.slice(0, 200),
      });
      setBusy(false);
    }
    haptic('success');
    toast.show({ message: t('rate.thanks') });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('rate.title')}
      footer={
        <button
          type="button"
          onClick={() => void submit()}
          aria-disabled={!stars || busy}
          className={`press min-h-13 w-full rounded-2xl text-[16px] font-semibold ${stars ? 'foil' : 'bg-surface-2 text-ink-3'}`}
        >
          {t('rate.send')}
        </button>
      }
    >
      <p className="text-center text-[15px] leading-relaxed text-ink-2">{t('rate.question')}</p>
      <div className="mt-5 flex justify-center gap-1.5" dir="ltr" role="radiogroup" aria-label={t('rate.title')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <motion.button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={t('rate.stars', { count: n })}
            whileTap={{ scale: 0.85 }}
            animate={{ scale: n <= stars ? 1.08 : 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18, delay: n <= stars ? (n - 1) * 0.04 : 0 }}
            onClick={() => {
              haptic('select');
              setStars(n);
            }}
            className="grid size-12 place-items-center rounded-full"
          >
            <Star className="size-9" strokeWidth={1.5} style={{ color: 'var(--coin)', fill: n <= stars ? 'var(--coin)' : 'transparent' }} />
          </motion.button>
        ))}
      </div>
      <p className="mt-2 min-h-5 text-center text-[14px] font-medium text-foil">
        {stars ? t(`rate.label.${stars}` as 'rate.label.1') : ''}
      </p>
      <label className="mt-5 block">
        <span className="eyebrow mb-2 block">
          {t('rate.comment')} · {t('common.optional')}
        </span>
        <textarea
          className="field min-h-[110px] py-3 leading-relaxed"
          maxLength={600}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('rate.placeholder')}
        />
      </label>
      {!user && <p className="mt-2 text-[12px] text-ink-3">{t('rate.local')}</p>}
    </Sheet>
  );
}
