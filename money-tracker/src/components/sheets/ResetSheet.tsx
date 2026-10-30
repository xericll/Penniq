import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { haptic } from '../../lib/haptics';
import { useToast } from '../../state/ToastContext';
import { useWallet, type ResetTarget } from '../../state/WalletContext';
import { Sheet } from '../ui/Sheet';

export function ResetSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { reset, restore, countFor } = useWallet();
  const toast = useToast();
  const [target, setTarget] = useState<ResetTarget>('all');

  useEffect(() => {
    if (open) setTarget('all');
  }, [open]);

  const count = countFor(target);

  const confirm = () => {
    const removed = reset(target);
    haptic('warning');
    onClose();
    toast.show({
      message: t('toast.reset'),
      tone: 'out',
      duration: 10_000,
      action: {
        label: t('common.undo'),
        onAction: () => {
          restore(removed);
          haptic('success');
        },
      },
    });
  };

  const options: { value: ResetTarget; label: string }[] = [
    { value: 'all', label: t('reset.all') },
    { value: 'cash', label: t('reset.cash') },
    { value: 'bank', label: t('reset.bank') },
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('reset.title')}
      footer={
        <button
          type="button"
          onClick={confirm}
          disabled={count === 0}
          className="press flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-out text-[16px] font-semibold text-bg disabled:opacity-40"
        >
          <RotateCcw className="size-5" aria-hidden />
          {t('reset.confirm')}
        </button>
      }
    >
      <p className="text-[15px] leading-relaxed text-ink-2">{t('reset.body')}</p>
      <div role="radiogroup" aria-label={t('reset.title')} className="mt-5 space-y-2">
        {options.map((o) => {
          const active = target === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                haptic('select');
                setTarget(o.value);
              }}
              className={`press flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-start transition-colors ${
                active ? 'border-out bg-out/10' : 'border-line hover:border-line-strong'
              }`}
            >
              <span
                className={`grid size-5 place-items-center rounded-full border-2 ${active ? 'border-out' : 'border-line-strong'}`}
                aria-hidden
              >
                {active && <span className="size-2.5 rounded-full bg-out" />}
              </span>
              <span className="flex-1 text-[15px] font-medium">{o.label}</span>
              <span className="text-[13px] text-ink-3 tabular">{t('common.entries', { count: countFor(o.value) })}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-[13px] text-ink-3">{t('reset.affects', { count })}</p>
    </Sheet>
  );
}
