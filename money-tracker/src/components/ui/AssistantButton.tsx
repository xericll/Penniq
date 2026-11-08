import { Mic, Sparkle } from 'lucide-react';
import { useI18n } from '../../i18n/LanguageContext';
import { haptic } from '../../lib/haptics';

/** Opens the assistant from a screen header. */
export function AssistantButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => {
        haptic('tap');
        onClick();
      }}
      aria-label={t('assistant.open')}
      title={t('assistant.open')}
      className="press grid size-[38px] shrink-0 place-items-center rounded-full text-ink hover:brightness-95"
      style={{ background: 'var(--assist-bg)' }}
    >
      <Sparkle className="size-[17px]" strokeWidth={1.8} aria-hidden />
    </button>
  );
}

/** Opens voice entry, already listening. Beside the assistant in the Home header. */
export function VoiceButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => {
        haptic('tap');
        onClick();
      }}
      aria-label={t('voice.open')}
      title={t('voice.open')}
      className="press flex h-[38px] shrink-0 items-center gap-1.5 rounded-full ps-3 pe-3.5 text-[13px] font-semibold text-ink hover:brightness-95"
      style={{ background: 'var(--assist-bg)' }}
    >
      <Mic className="size-[16px]" strokeWidth={1.9} aria-hidden />
      {t('voice.short')}
    </button>
  );
}
