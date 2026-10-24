import { Eye, EyeOff } from 'lucide-react';
import { useRef } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { usePrivacy } from '../../state/PrivacyContext';

/** Tap to hide/show every amount; while hidden, press and hold to peek. */
export function PrivacyButton({ className = '' }: { className?: string }) {
  const { hidden, toggle, peek } = usePrivacy();
  const { t } = useI18n();
  const timer = useRef<number | undefined>(undefined);
  const held = useRef(false);

  const end = () => {
    window.clearTimeout(timer.current);
    if (held.current) peek(false);
  };

  return (
    <button
      type="button"
      aria-pressed={hidden}
      aria-label={hidden ? t('privacy.show') : t('privacy.hide')}
      title={hidden ? t('privacy.hint') : t('privacy.hide')}
      onPointerDown={() => {
        held.current = false;
        if (!hidden) return;
        timer.current = window.setTimeout(() => {
          held.current = true;
          peek(true);
        }, 260);
      }}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={end}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (held.current) {
          held.current = false;
          return;
        }
        toggle();
      }}
      className={`press grid size-11 place-items-center rounded-full ${className}`}
    >
      {hidden ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
    </button>
  );
}
