import { AnimatePresence, motion } from 'motion/react';
import { Check, Info, Undo2 } from 'lucide-react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export interface ToastInput {
  message: string;
  tone?: 'neutral' | 'in' | 'out';
  action?: { label: string; onAction: () => void };
  /** Milliseconds; defaults to 4s, or 6s when an action is attached. */
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
  duration: number;
}

interface ToastValue {
  show: (toast: ToastInput) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const counter = useRef(0);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((input: ToastInput) => {
    window.clearTimeout(timer.current);
    const duration = input.duration ?? (input.action ? 6000 : 3500);
    const item = { ...input, id: ++counter.current, duration };
    setToast(item);
    timer.current = window.setTimeout(() => setToast((t) => (t?.id === item.id ? null : t)), duration);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4 bottom-[calc(env(safe-area-inset-bottom)+104px)] lg:bottom-8"
      >
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              role="status"
              initial={{ opacity: 0, y: 28, scale: 0.9, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.16 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className="btn-primary pointer-events-auto relative flex w-full max-w-md items-center gap-3 overflow-hidden rounded-[26px] py-2.5 ps-3 pe-2 text-on-primary"
            >
              <span
                className="grid size-7 shrink-0 place-items-center rounded-full"
                style={{
                  background:
                    toast.tone === 'in'
                      ? 'color-mix(in oklab, var(--in) 30%, transparent)'
                      : toast.tone === 'out'
                        ? 'color-mix(in oklab, var(--out) 30%, transparent)'
                        : 'color-mix(in oklab, var(--on-primary) 16%, transparent)',
                }}
                aria-hidden
              >
                {toast.action ? <Info className="size-4" /> : <Check className="size-4" strokeWidth={2.5} />}
              </span>
              <p className="min-w-0 flex-1 text-[15px] leading-snug font-medium">{toast.message}</p>
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.action!.onAction();
                    dismiss();
                  }}
                  className="press flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-on-primary/12 px-4 text-[15px] font-semibold text-on-primary hover:bg-on-primary/20"
                >
                  <Undo2 className="size-4 rtl:-scale-x-100" aria-hidden />
                  {toast.action.label}
                </button>
              ) : (
                <span className="w-2" />
              )}
              <motion.span
                aria-hidden
                className="absolute bottom-0 h-[2px] bg-on-primary/35 start-0"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: toast.duration / 1000, ease: 'linear' }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
