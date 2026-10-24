import { Sparkles } from 'lucide-react';
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
      className="press grid size-11 shrink-0 place-items-center rounded-full border border-line-strong text-foil hover:bg-surface-2"
    >
      <Sparkles className="size-5" aria-hidden />
    </button>
  );
}
