import { CloudDownload, CloudUpload, LoaderCircle, LogOut, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { deleteAccount } from '../../lib/cloud';
import { haptic } from '../../lib/haptics';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { useWallet } from '../../state/WalletContext';
import { Sheet } from '../ui/Sheet';

/* ---------- First sign-in on a device that already has entries ---------- */

export function AdoptSheet() {
  const { t } = useI18n();
  const { cloud } = useWallet();
  const { signOut } = useAuth();
  const [last, setLast] = useState(cloud.adoption);

  // Keep the numbers on screen while the sheet animates out.
  useEffect(() => {
    if (cloud.adoption) setLast(cloud.adoption);
  }, [cloud.adoption]);

  const choose = (choice: 'merge' | 'replace') => {
    haptic('success');
    cloud.resolveAdoption(choice);
  };

  return (
    // Closing without choosing leaves the device as it was: signed out, entries untouched.
    <Sheet open={cloud.adoption !== null} onClose={() => void signOut()} title={t('cloud.adopt.title')}>
      <p className="text-[15px] leading-relaxed text-ink-2">
        {t('cloud.adopt.body', { local: last?.local ?? 0, remote: last?.remote ?? 0 })}
      </p>
      <div className="mt-5 space-y-2.5">
        <button
          type="button"
          data-autofocus
          onClick={() => choose('merge')}
          className="foil press flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold"
        >
          <CloudUpload className="size-5" aria-hidden />
          {t('cloud.adopt.merge')}
        </button>
        <button
          type="button"
          onClick={() => choose('replace')}
          className="press flex min-h-14 w-full flex-col items-center justify-center rounded-2xl border border-line-strong px-4 py-2 hover:bg-surface-2"
        >
          <span className="flex items-center gap-2 text-[15px] font-semibold">
            <CloudDownload className="size-[18px]" aria-hidden />
            {t('cloud.adopt.replace')}
          </span>
          <span className="text-[13px] text-ink-3">{t('cloud.adopt.replaceHint')}</span>
        </button>
      </div>
    </Sheet>
  );
}

/* ---------- Sign out ---------- */

export function SignOutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { cloud } = useWallet();
  const { signOut } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { sync } = cloud;

  // Upload whatever is still waiting, so the warning below only shows what really cannot be saved.
  useEffect(() => {
    if (open) void sync();
  }, [open, sync]);

  const confirm = async () => {
    setBusy(true);
    await sync();
    cloud.forget();
    await signOut();
    setBusy(false);
    onClose();
    toast.show({ message: t('cloud.signedOut') });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('cloud.signOut')}
      footer={
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="press flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[16px] font-semibold text-bg disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <LogOut className="size-5 rtl:-scale-x-100" aria-hidden />}
          {t('cloud.signOut')}
        </button>
      }
    >
      <p className="text-[15px] leading-relaxed text-ink-2">{t('cloud.signOut.body')}</p>
      {cloud.pending > 0 && cloud.status !== 'syncing' && (
        <p role="alert" className="mt-4 rounded-2xl bg-out/10 p-3.5 text-[14px] leading-snug font-medium text-out">
          {t('cloud.signOut.pending', { count: cloud.pending })}
        </p>
      )}
    </Sheet>
  );
}

/* ---------- Delete the account ---------- */

export function DeleteAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { cloud } = useWallet();
  const { signOut } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (open) setFailed(false);
  }, [open]);

  const confirm = async () => {
    if (!supabase) return;
    setBusy(true);
    setFailed(false);
    try {
      await deleteAccount(supabase);
    } catch {
      setBusy(false);
      setFailed(true);
      haptic('warning');
      return;
    }
    cloud.forget();
    await signOut();
    setBusy(false);
    onClose();
    toast.show({ message: t('cloud.deleted'), tone: 'out' });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('cloud.delete')}
      footer={
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="press flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-out text-[16px] font-semibold text-bg disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Trash2 className="size-5" aria-hidden />}
          {t('cloud.delete.confirm')}
        </button>
      }
    >
      <p className="text-[15px] leading-relaxed text-ink-2">{t('cloud.delete.body')}</p>
      {failed && (
        <p role="alert" className="mt-4 text-[14px] font-medium text-out">
          {t('cloud.delete.failed')}
        </p>
      )}
    </Sheet>
  );
}
