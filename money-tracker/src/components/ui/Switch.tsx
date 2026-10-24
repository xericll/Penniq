import { motion } from 'motion/react';

/** The visual part of a switch; the row or button around it carries role="switch". */
export function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors ${on ? 'bg-foil' : 'bg-surface-2'}`}
      aria-hidden
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 600, damping: 36 }}
        className={`size-6 rounded-full shadow-sm ${on ? 'ms-auto bg-on-foil' : 'bg-ink-3'}`}
      />
    </span>
  );
}
