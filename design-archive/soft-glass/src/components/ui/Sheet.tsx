import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/LanguageContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** Small line above the title. */
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
  /** Pinned under the scrolling body (primary action). */
  footer?: React.ReactNode;
  /** Extra controls placed beside the close button. */
  headerExtra?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Hide the visual title (still announced to screen readers). */
  hideTitle?: boolean;
  /** Called once the exit animation finishes. */
  onExited?: () => void;
}

let openSheets = 0;

function lockScroll(lock: boolean) {
  openSheets = Math.max(0, openSheets + (lock ? 1 : -1));
  document.documentElement.style.overflow = openSheets > 0 ? 'hidden' : '';
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet on phones (drag the handle down to dismiss), centred dialog on desktop.
 * Escape closes, focus is trapped inside and restored to the trigger afterwards.
 */
export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  headerExtra,
  className = '',
  bodyClassName = '',
  hideTitle = false,
  onExited,
}: SheetProps) {
  const { t } = useI18n();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const dragControls = useDragControls();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    lockScroll(true);

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const preferred = panel.querySelector<HTMLElement>('[data-autofocus]');
      (preferred ?? panel).focus({ preventScroll: true });
    }, 60);

    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      // Only the top-most sheet reacts.
      const sheets = document.querySelectorAll('[data-sheet-panel]');
      if (sheets[sheets.length - 1] !== panel) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === 'Tab') {
        const nodes = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null);
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);

    const panelAtOpen = panelRef.current;
    return () => {
      // While animating out, this panel must no longer count as the top-most sheet.
      panelAtOpen?.removeAttribute('data-sheet-panel');
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      lockScroll(false);
      restoreRef.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) onClose();
  };

  return createPortal(
    <AnimatePresence onExitComplete={onExited}>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center lg:items-center lg:p-6">
          <motion.div
            className="absolute inset-0 backdrop-blur-[6px]"
            style={{ background: 'var(--scrim)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            data-sheet-panel
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            drag={desktop ? false : 'y'}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.6 }}
            onDragEnd={onDragEnd}
            initial={desktop ? { opacity: 0, scale: 0.96, y: 12 } : { y: '100%' }}
            animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={
              desktop
                ? { opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.16 } }
                : { y: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }
            }
            transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }}
            className={`relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[32px] text-ink outline-none lg:max-h-[88dvh] lg:max-w-lg lg:rounded-[32px] ${className}`}
            style={{
              background: 'var(--bg-elev)',
              WebkitBackdropFilter: 'blur(36px) saturate(180%)',
              backdropFilter: 'blur(36px) saturate(180%)',
              boxShadow: 'inset 0 1px 0 var(--rim-strong), inset 0 0 0 1px var(--rim), 0 -30px 70px -30px rgb(var(--shadow) / 0.5)',
            }}
          >
            {/* Grab zone: handle + header start the drag gesture */}
            <div className="shrink-0 touch-none select-none lg:touch-auto" onPointerDown={(e) => !desktop && dragControls.start(e)}>
              <div className="mx-auto mt-2.5 h-[5px] w-11 rounded-full bg-ink/15 lg:hidden" aria-hidden />
              <div className={`flex items-start gap-3 px-5 pt-3 pb-3 ${hideTitle ? 'lg:pt-4' : ''}`}>
                <div className={`min-w-0 flex-1 ${hideTitle ? 'sr-only' : ''}`}>
                  {eyebrow && <div className="eyebrow mb-0.5">{eyebrow}</div>}
                  <h2 id={titleId} className="text-[19px] leading-tight font-semibold">
                    {title}
                  </h2>
                </div>
                {hideTitle && <div className="flex-1" />}
                {headerExtra}
                <button
                  type="button"
                  onClick={onClose}
                  className="press glass-pill -me-1.5 grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:text-ink"
                  aria-label={t('common.close')}
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 ${bodyClassName}`}>{children}</div>

            {footer && (
              <div className="shrink-0 border-t border-line px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+14px)] lg:pb-4">{footer}</div>
            )}
            {!footer && <div className="h-[env(safe-area-inset-bottom)] shrink-0" />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
