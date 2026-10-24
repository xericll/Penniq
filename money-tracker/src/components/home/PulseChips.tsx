import { AnimatePresence, motion } from 'motion/react';
import { useI18n } from '../../i18n/LanguageContext';
import type { Pulse } from '../../state/WalletContext';

/** Floating "+20 €" / "−12 €" labels that rise out of a balance when it changes. */
export function PulseChips({ pulses, className = '', align = 'end' }: { pulses: Pulse[]; className?: string; align?: 'start' | 'end' }) {
  const { money } = useI18n();
  return (
    <div className={`pointer-events-none absolute z-10 ${className}`} aria-hidden>
      <AnimatePresence>
        {pulses.map((p) => (
          <motion.span
            key={p.id}
            dir="ltr"
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: -18, scale: 1 }}
            exit={{ opacity: 0, y: -34 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={`money tabular absolute top-0 rounded-full ${align === 'end' ? 'end-0' : 'start-0'} px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap`}
            style={{
              background:
                p.delta > 0 ? 'color-mix(in oklab, var(--in) 22%, var(--surface))' : 'color-mix(in oklab, var(--out) 22%, var(--surface))',
              color: p.delta > 0 ? 'var(--in)' : 'var(--out)',
            }}
          >
            {money(p.delta, { sign: true })}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
