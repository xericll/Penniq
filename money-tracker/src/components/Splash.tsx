import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { SPLASH_MS, SPLASH_ON_LOAD } from '../lib/boot';
import { Logo } from './ui/Logo';

/* The splash wears the logo's own colours, whatever appearance the app is in. */
const CREAM = '#f5f0e5';
const NAVY = '#1f2635';
const GOLD = '#a8875a';
const EASE = [0.16, 1, 0.3, 1] as const;

/** Launch moment: a soft gold light rises, the logo is unveiled left to right as if the vine grows, then the tagline. */
export function Splash() {
  const { t, lang } = useI18n();
  const [visible, setVisible] = useState(SPLASH_ON_LOAD);

  useEffect(() => {
    if (!visible) return;
    try {
      sessionStorage.setItem('qirsh_splash_seen', '1');
    } catch {
      // ignore
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(() => setVisible(false), reduced ? 300 : SPLASH_MS);
    return () => window.clearTimeout(id);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden text-center"
          style={{ background: CREAM, color: NAVY }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: 'easeOut' } }}
          onClick={() => setVisible(false)}
          aria-hidden
        >
          {/* Gold light behind the logo */}
          <motion.span
            className="pointer-events-none absolute top-1/2 left-1/2 size-[520px] -translate-x-1/2 -translate-y-[58%] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(205,182,140,0.42) 0%, rgba(205,182,140,0) 62%)' }}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.4, ease: EASE }}
          />

          <div className="relative -mt-10 flex flex-col items-center">
            <motion.div
              initial={{ clipPath: 'inset(0 100% 0 0)', y: 10, scale: 0.97 }}
              animate={{ clipPath: 'inset(-12% -4% -12% -4%)', y: 0, scale: 1 }}
              transition={{ duration: 1, delay: 0.05, ease: EASE }}
            >
              <Logo size={128} variant="stacked" color={NAVY} />
            </motion.div>

            <motion.p
              className="font-display mt-10 text-[28px] leading-tight"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.85, ease: EASE }}
            >
              {t('app.tagline')}
            </motion.p>
            {lang === 'ar' && (
              <motion.p
                dir="ltr"
                lang="en"
                className="font-display mt-1 text-[15px] italic"
                style={{ color: GOLD }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 1.05 }}
              >
                Every penny, accounted for.
              </motion.p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
