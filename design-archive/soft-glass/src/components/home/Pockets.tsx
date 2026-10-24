import { motion } from 'motion/react';
import { ArrowLeftRight, ChevronLeft, Landmark, Wallet } from 'lucide-react';
import { useI18n } from '../../i18n/LanguageContext';
import { haptic } from '../../lib/haptics';
import { useWallet } from '../../state/WalletContext';
import type { AccountType } from '../../types';
import { Lens, NO_BACKDROP } from '../ui/Lens';
import { Odometer } from '../ui/Money';
import { PulseChips } from './PulseChips';

interface PocketsProps {
  onOpenAccount: (a: AccountType) => void;
  onTransfer: () => void;
}

/** Cash and bank side by side, stitched together by the transfer coin. */
export function Pockets({ onOpenAccount, onTransfer }: PocketsProps) {
  const { t } = useI18n();
  return (
    <div className="relative grid grid-cols-2 gap-3">
      <Pocket account="cash" onOpen={onOpenAccount} />
      <Pocket account="bank" onOpen={onOpenAccount} />
      <motion.button
        type="button"
        onClick={() => {
          haptic('select');
          onTransfer();
        }}
        whileTap={{ scale: 0.86, rotate: 180 }}
        transition={{ type: 'spring', stiffness: 480, damping: 16 }}
        className="glass-pill iris absolute top-1/2 left-1/2 isolate z-10 grid size-[52px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-ink"
        style={{
          ...NO_BACKDROP,
          boxShadow: 'inset 0 1px 0 #fff, 0 2px 4px rgb(var(--shadow) / 0.12), 0 14px 28px -10px rgb(var(--shadow) / 0.45)',
        }}
        aria-label={t('home.transferBetween')}
        title={t('home.transferBetween')}
      >
        <Lens />
        <ArrowLeftRight className="size-5" strokeWidth={2.2} />
      </motion.button>
    </div>
  );
}

function Pocket({ account, onOpen }: { account: AccountType; onOpen: (a: AccountType) => void }) {
  const { t, accountName } = useI18n();
  const { balances, pulses } = useWallet();
  const mine = pulses.filter((p) => p.target === account);
  const last = mine[mine.length - 1];
  const balance = balances[account];
  const total = Math.max(0, balances.cash) + Math.max(0, balances.bank);
  const share = total > 0 ? Math.round((Math.max(0, balance) / total) * 100) : 0;
  const hue = account === 'cash' ? 'var(--cash)' : 'var(--bank)';
  const Icon = account === 'cash' ? Wallet : Landmark;

  return (
    <button
      type="button"
      onClick={() => {
        haptic('tap');
        onOpen(account);
      }}
      aria-label={t('home.openAccount', { account: accountName(account) })}
      className={`card press group relative flex min-h-[156px] flex-col overflow-hidden rounded-[30px] p-4 text-start ${
        account === 'cash' ? 'pe-7' : 'ps-7'
      }`}
    >
      {last && (
        <motion.span
          key={last.id}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[30px]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ boxShadow: `inset 0 0 0 1.5px ${last.delta > 0 ? 'var(--in)' : 'var(--out)'}` }}
        />
      )}
      <span className="flex items-center gap-2">
        <span
          className="grid size-10 place-items-center rounded-full"
          style={{
            background: `color-mix(in oklab, ${hue} 16%, var(--glass-top))`,
            color: `color-mix(in oklab, ${hue} 85%, var(--ink))`,
            boxShadow: 'inset 0 1px 0 var(--rim-strong), 0 4px 10px -6px rgb(var(--shadow) / 0.4)',
          }}
          aria-hidden
        >
          <Icon className="size-[18px]" />
        </span>
        <span className="text-[15px] font-semibold">{accountName(account)}</span>
        <ChevronLeft
          className="ms-auto size-4 text-ink-3 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>

      <span className="relative mt-auto pt-5">
        <Odometer
          value={balance}
          className="font-display block text-[25px] leading-none font-normal min-[380px]:text-[27px]"
          decimalsClassName="text-[0.55em] text-ink-3"
          currencyClassName="text-[0.6em] text-ink-3 mx-0.5"
        />
        <PulseChips
          pulses={mine}
          className={account === 'cash' ? '-top-5 start-0' : '-top-5 end-0'}
          align={account === 'cash' ? 'start' : 'end'}
        />
      </span>

      <span className="mt-3 flex items-center gap-2">
        <span className="inset h-1.5 flex-1 overflow-hidden rounded-full" aria-hidden>
          <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${share}%`, background: hue }} />
        </span>
        <span className="text-[12px] text-ink-3 tabular">{t('home.ofTotal', { pct: share })}</span>
      </span>
    </button>
  );
}
