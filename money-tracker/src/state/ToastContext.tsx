import { AnimatePresence, motion } from 'motion/react';
import { Check, Info, Undo2 } from 'lucide-react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ToastInput {
  message: string;
  tone?: 'neutral' | 'in' | 'out';
  /** The button beside the message. Its icon is the undo arrow unless another one is given. */
  action?: { label: string; onAction: () => void; icon?: React.ReactNode };
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
      {/* In <body>, like the sheets, so a toast raised from inside a sheet shows above it. */}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4 bottom-[calc(env(safe-area-inset-bottom)+104px)] lg:bottom-8"
        >
          <AnimatePresence>
            {toast && (
              <motion.div
                key={toast.id}
                role="status"
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.16 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="pointer-events-auto relative flex w-full max-w-md items-center gap-3 overflow-hidden rounded-2xl bg-ink py-3 ps-4 pe-2 text-bg shadow-[0_20px_40px_-16px_rgba(0,0,0,0.6)]"
              >
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-full"
                  style={{
                    background:
                      toast.tone === 'in'
                        ? 'color-mix(in oklab, var(--in) 30%, transparent)'
                        : toast.tone === 'out'
                          ? 'color-mix(in oklab, var(--out) 30%, transparent)'
                          : 'color-mix(in oklab, var(--bg) 16%, transparent)',
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
                    className="press flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[15px] font-semibold text-bg hover:bg-bg/10"
                  >
                    {toast.action.icon ?? <Undo2 className="size-4 rtl:-scale-x-100" aria-hidden />}
                    {toast.action.label}
                  </button>
                ) : (
                  <span className="w-2" />
                )}
                <motion.span
                  aria-hidden
                  className="absolute bottom-0 h-[2px] bg-bg/35 start-0"
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: toast.duration / 1000, ease: 'linear' }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
