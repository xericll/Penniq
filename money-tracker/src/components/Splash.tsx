import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { SPLASH_MS, SPLASH_ON_LOAD } from '../lib/boot';
import { DESCRIPTOR, SYMBOL, WORDMARK } from './ui/brandArt';

/* The splash keeps the guideline's own colours whatever appearance the app is in. */
const NAVY = '#1f2635';
const PARCHMENT = '#efeadf';
const GOLD = '#c2a97d';
const SLATE = '#5a6478';
const EASE = [0.16, 1, 0.3, 1] as const;

/** Rising arcs: three cradles layered in navy tones (guideline, "Patterns — Rising Arcs"). */
const ARCS = [
  { d: 'M0 90 C 60 290, 330 320, 400 40 L 400 300 L 0 300 Z', opacity: 0.3 },
  { d: 'M0 150 C 80 300, 320 300, 400 110 L 400 300 L 0 300 Z', opacity: 0.42 },
  { d: 'M0 215 C 100 310, 300 310, 400 190 L 400 300 L 0 300 Z', opacity: 0.6 },
];

/** Launch moment: the arcs rise, the coin drops into the open hand, then the name is unveiled. */
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

  const wipe = (delay: number) => ({
    initial: { clipPath: 'inset(100% 0 0 0)', y: 18 },
    animate: { clipPath: 'inset(-10% 0 -10% 0)', y: 0 },
    transition: { duration: 0.8, delay, ease: EASE },
  });

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden text-center"
          style={{ background: NAVY, color: PARCHMENT }}
          exit={{ opacity: 0, transition: { duration: 0.4, ease: 'easeOut' } }}
          onClick={() => setVisible(false)}
          aria-hidden
        >
          <svg
            viewBox="0 0 400 300"
            preserveAspectRatio="none"
            className="absolute inset-x-[-10%] bottom-[-2%] h-[38%] w-[120%]"
            style={{ color: SLATE }}
          >
            {ARCS.map((a, i) => (
              <motion.path
                key={i}
                d={a.d}
                fill="currentColor"
                fillOpacity={a.opacity}
                initial={{ y: 300 }}
                animate={{ y: 0 }}
                transition={{ duration: 1.2, delay: i * 0.12, ease: EASE }}
              />
            ))}
          </svg>

          <div className="relative -mt-16 flex flex-col items-center">
            <svg viewBox={`0 0 ${SYMBOL.width} ${SYMBOL.height}`} width={136} height={85} className="overflow-visible">
              <motion.path
                d={SYMBOL.cradle}
                fill={PARCHMENT}
                style={{ transformBox: 'fill-box', transformOrigin: '50% 70%' }}
                initial={{ rotate: -18, scale: 0.6, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 170, damping: 14, delay: 0.1 }}
              />
              <motion.path
                d={SYMBOL.coin}
                fill={GOLD}
                initial={{ y: -520 }}
                animate={{ y: [-520, 12, -26, 4, 0] }}
                transition={{ duration: 1.1, delay: 0.3, times: [0, 0.55, 0.7, 0.84, 1], ease: 'easeIn' }}
              />
            </svg>

            <motion.svg
              viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`}
              width={190}
              height={(190 * WORDMARK.height) / WORDMARK.width}
              className="mt-6"
              {...wipe(0.95)}
            >
              <path d={WORDMARK.d} fill={PARCHMENT} />
            </motion.svg>
            <motion.svg
              viewBox={`0 0 ${DESCRIPTOR.width} ${DESCRIPTOR.height}`}
              width={88}
              height={(88 * DESCRIPTOR.height) / DESCRIPTOR.width}
              className="mt-3"
              {...wipe(1.15)}
            >
              <path d={DESCRIPTOR.d} fill={PARCHMENT} />
            </motion.svg>

            <motion.p
              className="font-display mt-12 text-[30px] leading-tight"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 1.35, ease: EASE }}
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
                transition={{ duration: 0.8, delay: 1.55 }}
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
