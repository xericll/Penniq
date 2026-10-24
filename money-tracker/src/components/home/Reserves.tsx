import { CalendarCheck, ChevronLeft, HandCoins, Vault } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { haptic } from '../../lib/haptics';
import { debtsOf, essentialAdded, roundMoney } from '../../lib/ledger';
import { useWallet } from '../../state/WalletContext';
import { Money } from '../ui/Money';

interface ReservesProps {
  onVault: () => void;
  onDebts: () => void;
}

/** Money outside the everyday wallet: what is kept in the vault, and debts in both directions. */
export function Reserves({ onVault, onDebts }: ReservesProps) {
  const { t } = useI18n();
  const { balances, transactions } = useWallet();
  const { toYou, fromYou } = useMemo(() => {
    let toYou = 0;
    let fromYou = 0;
    for (const d of debtsOf(transactions)) {
      if (d.side === 'lent') toYou += d.remaining;
      else fromYou += d.remaining;
    }
    return { toYou: roundMoney(toYou), fromYou: roundMoney(fromYou) };
  }, [transactions]);

  return (
    <section className="card overflow-hidden" aria-labelledby="reserves-title">
      <div className="flex items-end justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="min-w-0">
          <h2 id="reserves-title" className="eyebrow">
            {t('reserves.wealth')}
          </h2>
          <p className="mt-0.5 text-[12px] text-ink-3">{t('reserves.wealthHint')}</p>
        </div>
        <Money value={roundMoney(balances.total + balances.vault)} className="font-display shrink-0 text-[22px] leading-none" />
      </div>
      <div className="grid grid-cols-2 divide-x divide-line border-t border-line rtl:divide-x-reverse">
        <Tile icon={<Vault className="size-[17px]" />} label={t('common.vault')} onClick={onVault}>
          <Money value={balances.vault} className="font-display mt-auto self-start text-[20px] leading-none" />
          <span className="line-clamp-2 text-[12px] leading-snug text-ink-3">{t('reserves.vaultHint')}</span>
        </Tile>
        <Tile icon={<HandCoins className="size-[17px]" />} label={t('reserves.debts')} onClick={onDebts}>
          <span className="mt-auto flex items-baseline justify-between gap-2 text-[13px]">
            <span className="truncate text-ink-3">{t('reserves.toYou')}</span>
            <Money value={toYou} className={`shrink-0 font-semibold ${toYou > 0 ? 'text-in' : 'text-ink-2'}`} />
          </span>
          <span className="flex items-baseline justify-between gap-2 text-[13px]">
            <span className="truncate text-ink-3">{t('reserves.fromYou')}</span>
            <Money value={fromYou} className={`shrink-0 font-semibold ${fromYou > 0 ? 'text-out' : 'text-ink-2'}`} />
          </span>
        </Tile>
      </div>
    </section>
  );
}

function Tile({ icon, label, onClick, children }: { icon: ReactNode; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic('tap');
        onClick();
      }}
      className="press flex min-h-[104px] min-w-0 flex-col gap-2 p-4 text-start hover:bg-surface-2/60"
    >
      <span className="flex items-center gap-2">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-xl text-foil"
          style={{ background: 'color-mix(in oklab, var(--foil) 16%, transparent)' }}
          aria-hidden
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{label}</span>
      </span>
      {children}
    </button>
  );
}

/** The user's fixed monthly incomes and costs, with how many are already in this month's entries. */
export function EssentialsCard({ onOpen }: { onOpen: () => void }) {
  const { t } = useI18n();
  const { essentials, transactions } = useWallet();
  const { income, expense, done } = useMemo(() => {
    let income = 0;
    let expense = 0;
    let done = 0;
    for (const item of essentials) {
      if (item.type === 'income') income += item.amount;
      else expense += item.amount;
      if (essentialAdded(item, transactions)) done++;
    }
    return { income: roundMoney(income), expense: roundMoney(expense), done };
  }, [essentials, transactions]);

  return (
    <button
      type="button"
      onClick={() => {
        haptic('tap');
        onOpen();
      }}
      className="card press group flex min-h-[72px] w-full items-center gap-3 p-4 text-start hover:border-line-strong"
    >
      <span
        className="grid size-10 shrink-0 place-items-center rounded-xl text-foil"
        style={{ background: 'color-mix(in oklab, var(--foil) 16%, transparent)' }}
        aria-hidden
      >
        <CalendarCheck className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{t('essentials.title')}</span>
        <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-3">
          {essentials.length ? t('essentials.progress', { done, total: essentials.length }) : t('essentials.hint')}
        </span>
      </span>
      {essentials.length > 0 && (
        <span className="flex shrink-0 flex-col items-end leading-tight">
          <Money value={income} sign className="text-[13px] font-medium text-in" />
          <Money value={-expense} className="text-[13px] font-medium text-out" />
        </span>
      )}
      <ChevronLeft
        className="size-4 shrink-0 text-ink-3 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  );
}
