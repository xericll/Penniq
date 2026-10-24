import { motion } from 'motion/react';
import { ArrowLeftRight, ChevronLeft, Landmark, Wallet } from 'lucide-react';
import { useI18n } from '../../i18n/LanguageContext';
import { haptic } from '../../lib/haptics';
import { useWallet } from '../../state/WalletContext';
import type { AccountType } from '../../types';
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
        whileTap={{ scale: 0.9, rotate: 180 }}
        className="coin coin-flip absolute top-1/2 left-1/2 z-10 -mt-6 -ml-6 grid size-12 place-items-center rounded-full"
        style={{ boxShadow: '0 0 0 5px var(--bg), 0 10px 24px -10px rgba(0,0,0,.6)' }}
        aria-label={t('home.transferBetween')}
        title={t('home.transferBetween')}
      >
        <ArrowLeftRight className="size-5" strokeWidth={2.2} />
      </motion.button>
    </div>
  );
}

/** Balance size for 5, 6, 7, 8 and 9 characters (digits plus minus sign); anything longer uses 13px. */
const LONG_SIZES = ['text-[23px]', 'text-[21px]', 'text-[19px]', 'text-[17px]', 'text-[15px]'];

function Pocket({ account, onOpen }: { account: AccountType; onOpen: (a: AccountType) => void }) {
  const { t, accountName, currencySymbol } = useI18n();
  const { balances, pulses } = useWallet();
  const mine = pulses.filter((p) => p.target === account);
  const last = mine[mine.length - 1];
  const balance = balances[account];
  const total = Math.max(0, balances.cash) + Math.max(0, balances.bank);
  const share = total > 0 ? Math.round((Math.max(0, balance) / total) * 100) : 0;
  const hue = account === 'cash' ? 'var(--cash)' : 'var(--bank)';
  const Icon = account === 'cash' ? Wallet : Landmark;
  // Long figures (five digits and up, a minus sign, a wide currency symbol) step down in size so they never run under the card's edge.
  const width = String(Math.trunc(Math.abs(balance))).length + (balance < 0 ? 1 : 0) + Math.max(0, currencySymbol.length - 1);
  const size = width <= 4 ? 'text-[26px] min-[380px]:text-[28px]' : (LONG_SIZES[width - 5] ?? 'text-[13px]');

  return (
    <button
      type="button"
      onClick={() => {
        haptic('tap');
        onOpen(account);
      }}
      aria-label={t('home.openAccount', { account: accountName(account) })}
      className={`card press group relative flex min-h-[150px] flex-col overflow-hidden p-4 text-start hover:border-line-strong ${
        account === 'cash' ? 'pe-7' : 'ps-7'
      }`}
    >
      {last && (
        <motion.span
          key={last.id}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[24px]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ boxShadow: `inset 0 0 0 1.5px ${last.delta > 0 ? 'var(--in)' : 'var(--out)'}` }}
        />
      )}
      <span className="flex items-center gap-2">
        <span
          className="grid size-9 place-items-center rounded-xl"
          style={{ background: `color-mix(in oklab, ${hue} 16%, transparent)`, color: hue }}
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
          className={`font-display block leading-none font-normal ${size}`}
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
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${share}%`, background: hue }} />
        </span>
        <span className="text-[12px] text-ink-3 tabular">{t('home.ofTotal', { pct: share })}</span>
      </span>
    </button>
  );
}
