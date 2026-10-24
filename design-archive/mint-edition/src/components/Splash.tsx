import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { SPLASH_MS, SPLASH_ON_LOAD } from '../lib/boot';
import { Guilloche } from './ui/Engraving';
import { Logo } from './ui/Logo';

/** A short "minting" moment on launch: the rosette unfolds and the mark is struck in foil. */
export function Splash() {
  const { t } = useI18n();
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
          className="fixed inset-0 z-[100] grid place-items-center bg-bg"
          exit={{ opacity: 0, transition: { duration: 0.35, ease: 'easeOut' } }}
          onClick={() => setVisible(false)}
          aria-hidden
        >
          <motion.div
            className="absolute text-foil"
            initial={{ scale: 0.6, opacity: 0, rotate: -40 }}
            animate={{ scale: 1, opacity: 0.35, rotate: 0 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <Guilloche className="size-[340px]" strokeWidth={0.7} />
          </motion.div>
          <motion.div
            className="relative flex flex-col items-center"
            initial={{ scale: 1.08, opacity: 0, filter: 'blur(8px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <Logo variant="stacked" size={96} />
            <p className="mt-4 text-[14px] text-ink-2">{t('app.tagline')}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
