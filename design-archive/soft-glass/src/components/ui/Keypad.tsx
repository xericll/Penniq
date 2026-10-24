import { Delete } from 'lucide-react';
import { useRef } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { haptic } from '../../lib/haptics';

interface KeypadProps {
  onDigit: (d: string) => void;
  onDecimal: () => void;
  onBackspace: () => void;
  onClear: () => void;
}

/** Engraved number pad. Hold ⌫ to clear everything. */
export function Keypad({ onDigit, onDecimal, onBackspace, onClear }: KeypadProps) {
  const { t, lang } = useI18n();
  const holdTimer = useRef<number | undefined>(undefined);
  const held = useRef(false);
  const decimal = lang === 'de' ? ',' : '.';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimal, '0', 'del'];

  const base =
    'press key-glass relative grid h-[52px] select-none place-items-center rounded-[20px] text-ink [@media(max-height:860px)]:h-12';

  return (
    <div dir="ltr" role="group" aria-label={t('keypad.label')} className="grid grid-cols-3 gap-2 touch-manipulation">
      {keys.map((k) => {
        if (k === 'del') {
          return (
            <button
              key={k}
              type="button"
              aria-label={t('keypad.delete')}
              className={`${base} text-ink-2`}
              onPointerDown={() => {
                held.current = false;
                holdTimer.current = window.setTimeout(() => {
                  held.current = true;
                  haptic('warning');
                  onClear();
                }, 450);
              }}
              onPointerUp={() => window.clearTimeout(holdTimer.current)}
              onPointerLeave={() => window.clearTimeout(holdTimer.current)}
              onClick={() => {
                if (held.current) return;
                haptic('tap');
                onBackspace();
              }}
            >
              <Delete className="size-6" strokeWidth={1.75} />
            </button>
          );
        }
        const isDecimal = k === decimal;
        return (
          <button
            key={k}
            type="button"
            aria-label={isDecimal ? t('keypad.decimal') : k}
            className={`${base} font-display text-[26px] font-light`}
            onClick={() => {
              haptic('tap');
              if (isDecimal) onDecimal();
              else onDigit(k);
            }}
          >
            {k}
          </button>
        );
      })}
    </div>
  );
}
