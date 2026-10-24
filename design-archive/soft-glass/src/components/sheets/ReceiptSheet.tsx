import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { haptic } from '../../lib/haptics';
import { serialNumbers, signedAmount } from '../../lib/ledger';
import { useToast } from '../../state/ToastContext';
import { useWallet } from '../../state/WalletContext';
import type { Transaction } from '../../types';
import { TxGlyph, useDescribe } from '../tx/describe';
import { Guilloche } from '../ui/Engraving';
import { Money } from '../ui/Money';
import { Sheet } from '../ui/Sheet';

interface ReceiptSheetProps {
  tx: Transaction | null;
  onClose: () => void;
  onEdit: (tx: Transaction) => void;
}

/** A transaction shown as a printed receipt: perforated edge, serial number, dotted rules. */
export function ReceiptSheet({ tx, onClose, onEdit }: ReceiptSheetProps) {
  const { t, accountName, dateLabel, timeLabel, dir } = useI18n();
  const { transactions, remove, restore } = useWallet();
  const toast = useToast();
  const describe = useDescribe();
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // Keep showing the last receipt while the sheet animates out.
  const lastTx = useRef<Transaction | null>(null);
  if (tx) lastTx.current = tx;
  const shown = tx ?? lastTx.current;

  const serials = useMemo(() => serialNumbers(transactions), [transactions]);

  useEffect(() => {
    setConfirming(false);
    return () => window.clearTimeout(timer.current);
  }, [tx]);

  if (!shown) return null;
  const view = describe(shown);
  const date = new Date(shown.timestamp);
  const serial = serials.get(shown.id);
  const typeLabel = view.adjustment ? t('receipt.correction') : t(`common.${shown.type}`);
  const value = shown.type === 'transfer' ? shown.amount : signedAmount(shown);
  const to = shown.toAccount ?? (shown.account === 'cash' ? 'bank' : 'cash');
  const arrow = dir === 'rtl' ? '←' : '→';

  const onDelete = () => {
    if (!confirming) {
      haptic('warning');
      setConfirming(true);
      timer.current = window.setTimeout(() => setConfirming(false), 3500);
      return;
    }
    const removed = remove(shown.id);
    haptic('money');
    onClose();
    if (removed) {
      toast.show({
        message: t('toast.deleted'),
        action: { label: t('common.undo'), onAction: () => restore([removed]) },
      });
    }
  };

  return (
    <Sheet
      open={tx !== null}
      onClose={onClose}
      title={t('receipt.title')}
      hideTitle
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onEdit(shown)}
            className="press glass-pill flex min-h-12 items-center justify-center gap-2 rounded-full text-[15px] font-medium"
          >
            <Pencil className="size-4" aria-hidden />
            {t('common.edit')}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className={`press flex min-h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-colors ${
              confirming ? 'bg-out text-bg' : 'text-out hover:bg-out/10'
            }`}
            style={confirming ? undefined : { boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--out) 45%, transparent)' }}
          >
            <Trash2 className="size-4" aria-hidden />
            {confirming ? t('receipt.confirmDelete') : t('common.delete')}
          </button>
          {confirming && (
            <p role="alert" className="col-span-2 text-center text-[13px] text-ink-3">
              {t('receipt.deleteHint')}
            </p>
          )}
        </div>
      }
    >
      <div
        className="perforated relative overflow-hidden rounded-b-3xl px-5 pt-7 pb-6"
        style={{
          background: 'var(--paper)',
          boxShadow: '0 1px 2px rgb(var(--shadow) / 0.08), 0 18px 36px -24px rgb(var(--shadow) / 0.45)',
        }}
      >
        <Guilloche className="pointer-events-none absolute -end-24 -top-24 size-64 text-ink opacity-[0.06]" density="light" />

        <div className="relative flex items-center gap-3">
          <TxGlyph view={view} size={48} />
          <div className="min-w-0 flex-1">
            <div className="eyebrow">{typeLabel}</div>
            <p className="truncate text-[17px] font-semibold">{view.title}</p>
          </div>
        </div>

        <Money
          value={value}
          sign={shown.type !== 'transfer'}
          tone={shown.type !== 'transfer' && !view.adjustment}
          decimals="always"
          className="font-display relative mt-5 block text-[44px] leading-none font-light"
        />
        {view.adjustment && <p className="mt-2 text-[13px] text-ink-3">{t('receipt.correctionHint')}</p>}

        <div className="dashed-rule my-5" />

        <dl className="space-y-3 text-[15px]">
          {shown.type === 'transfer' ? (
            <Line label={t('receipt.route')}>
              {accountName(shown.account)} {arrow} {accountName(to)}
            </Line>
          ) : (
            <Line label={t('receipt.account')}>{accountName(shown.account)}</Line>
          )}
          {view.categoryLabel && <Line label={t('receipt.category')}>{view.categoryLabel}</Line>}
          {!Number.isNaN(date.getTime()) && (
            <>
              <Line label={t('receipt.date')}>{dateLabel(date)}</Line>
              <Line label={t('receipt.time')}>{timeLabel(date)}</Line>
            </>
          )}
        </dl>

        <div className="dashed-rule my-5" />

        <div className="flex items-center justify-between">
          <span className="eyebrow">{t('receipt.no')}</span>
          <span className="serial text-ink-2" dir="ltr">
            № {String(serial ?? 0).padStart(6, '0')}
          </span>
        </div>
      </div>
    </Sheet>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className="min-w-0 text-end font-medium">{children}</dd>
    </div>
  );
}
