import { motion } from 'motion/react';
import { ScanLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { categoryById, resolveCategory, type CategoryId } from '../../lib/categories';
import { haptic } from '../../lib/haptics';
import { roundMoney } from '../../lib/ledger';
import { parseReceipt, tesseractReader, type ReceiptReader } from '../../lib/receipt';
import { applyRules } from '../../lib/rules';
import { usePlanner } from '../../state/PlannerContext';
import type { AccountType } from '../../types';
import { AmountField } from '../ui/AmountField';
import { AccountPicker, CategoryGrid, TextField, parseNumber } from '../ui/Pickers';
import { Sheet } from '../ui/Sheet';
import { useRecord } from './QuickRecord';

/** The reader in use; swap it here for another one (a vision model behind the app's own server, say). */
const reader: ReceiptReader = tesseractReader;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * A photographed receipt: read on the device, then every field is shown for review.
 * Nothing is recorded until the user saves.
 */
export function ScanSheet({ file, onClose }: { file: File | null; onClose: () => void }) {
  const { t, localize } = useI18n();
  const { rulesRef } = usePlanner();
  const record = useRecord();
  const [status, setStatus] = useState<'reading' | 'review' | 'failed'>('reading');
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [store, setStore] = useState('');
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState<CategoryId>('groceries');
  const [account, setAccount] = useState<AccountType>('cash');
  const [error, setError] = useState('');
  const run = useRef(0);

  useEffect(() => {
    if (!file) return;
    const id = ++run.current;
    const src = URL.createObjectURL(file);
    setPreview(src);
    setStatus('reading');
    setProgress(0);
    setError('');
    setAmount('');
    setStore('');
    setDate(today());
    setCategory('groceries');
    setAccount('cash');
    reader
      .read(file, (p) => run.current === id && setProgress(p))
      .then((text) => {
        if (run.current !== id) return;
        const parsed = parseReceipt(text);
        // The automation rules are applied before the review, so the user sees what will be saved.
        const guess = applyRules(
          {
            type: 'expense' as const,
            amount: parsed.amount ?? 0,
            account: 'cash',
            reason: parsed.store ?? '',
            category: categoryById(parsed.category ?? 'groceries').stored,
          },
          rulesRef.current,
          localize,
        );
        setAmount(parsed.amount !== null ? String(parsed.amount) : '');
        setStore(guess.reason);
        if (parsed.date) setDate(parsed.date);
        setCategory(resolveCategory(guess.category).id);
        setAccount(guess.account === 'bank' ? 'bank' : 'cash');
        setStatus('review');
        haptic(parsed.amount !== null ? 'success' : 'warning');
      })
      .catch(() => run.current === id && setStatus('failed'));
    return () => URL.revokeObjectURL(src);
  }, [file, rulesRef, localize]);

  const save = () => {
    const value = roundMoney(parseNumber(amount));
    if (!Number.isFinite(value) || value <= 0) return setError(t('edit.errAmount'));
    const d = new Date(`${date}T12:00`);
    const isToday = date === today();
    record({
      amount: value,
      type: 'expense',
      account,
      reason: store.trim() || categoryById(category).stored,
      category: categoryById(category).stored,
      timestamp: isToday || Number.isNaN(d.getTime()) ? undefined : d.toISOString(),
      skipRules: true,
    });
    onClose();
  };

  return (
    <Sheet
      open={file !== null}
      onClose={onClose}
      title={t('scan.title')}
      footer={
        status === 'reading' ? undefined : (
          <button type="button" onClick={save} className="foil press min-h-13 w-full rounded-2xl text-[16px] font-semibold">
            {t('scan.save')}
          </button>
        )
      }
    >
      {status === 'reading' && (
        <div className="flex flex-col items-center py-4 text-center">
          <div className="relative h-56 w-44 overflow-hidden rounded-2xl bg-surface-2">
            {preview && <img src={preview} alt="" className="size-full object-cover opacity-80" />}
            <motion.span
              className="absolute inset-x-0 h-12"
              style={{
                background: 'linear-gradient(to bottom, transparent, color-mix(in oklab, var(--coin) 55%, transparent), transparent)',
              }}
              animate={{ top: ['-15%', '95%', '-15%'] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden
            />
          </div>
          <p className="mt-4 flex items-center gap-2 text-[15px] font-medium" role="status">
            <ScanLine className="size-4 text-foil" aria-hidden />
            {t('scan.reading')}
          </p>
          <div className="mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div
              className="h-full rounded-full bg-foil transition-[width] duration-300"
              style={{ width: `${Math.max(6, progress * 100)}%` }}
            />
          </div>
          <p className="mt-3 max-w-xs text-[12px] leading-relaxed text-ink-3">{t('scan.private')}</p>
        </div>
      )}

      {status !== 'reading' && (
        <div className="space-y-5">
          <div
            className={`flex items-center gap-3 rounded-2xl p-3 ${status === 'failed' ? 'bg-surface-2 text-out' : 'bg-surface-2 text-ink-2'}`}
          >
            {preview && <img src={preview} alt="" className="size-14 shrink-0 rounded-xl object-cover" />}
            <p className="text-[13px] leading-relaxed">{status === 'failed' ? t('scan.failed') : t('scan.review')}</p>
          </div>
          <AmountField
            label={t('composer.amount')}
            value={amount}
            onChange={(v) => {
              setAmount(v);
              setError('');
            }}
            error={error}
          />
          <TextField label={t('scan.store')} value={store} onChange={setStore} maxLength={60} />
          <TextField label={t('scan.date')} value={date} onChange={setDate} type="date" dir="ltr" />
          <AccountPicker value={account} onChange={setAccount} />
          <CategoryGrid value={category} onChange={setCategory} />
        </div>
      )}
    </Sheet>
  );
}
