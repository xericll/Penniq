import { Search, SearchX, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { TxRow } from '../components/tx/TxRow';
import { Guilloche } from '../components/ui/Engraving';
import { Money } from '../components/ui/Money';
import { Segmented } from '../components/ui/Segmented';
import { useI18n } from '../i18n/LanguageContext';
import { CATEGORIES, resolveCategory, type CategoryId } from '../lib/categories';
import { groupByDay, inPeriod, isAdjustment, touchesAccount } from '../lib/ledger';
import { useWallet } from '../state/WalletContext';
import type { AccountType, PeriodFilter, Transaction, TransactionType } from '../types';
import { ScreenHeader } from './ScreenHeader';

interface ActivityProps {
  onOpenTx: (tx: Transaction) => void;
  onCompose: () => void;
  /** Pre-select an account filter (e.g. coming from an account sheet). */
  focusAccount?: { account: AccountType; nonce: number } | null;
}

const PAGE = 60;

export function Activity({ onOpenTx, onCompose, focusAccount }: ActivityProps) {
  const { t, localize, dayLabel } = useI18n();
  const { transactions } = useWallet();

  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [account, setAccount] = useState<AccountType | 'all'>('all');
  const [type, setType] = useState<TransactionType | 'all'>('all');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    if (focusAccount) setAccount(focusAccount.account);
  }, [focusAccount]);

  useEffect(() => setLimit(PAGE), [query, period, account, type, category]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (!inPeriod(tx.timestamp, period)) return false;
      if (account !== 'all' && !touchesAccount(tx, account)) return false;
      if (type !== 'all' && tx.type !== type) return false;
      if (type === 'expense' && category !== 'all' && resolveCategory(tx.category).id !== category) return false;
      if (q) {
        const hay = [
          tx.reason,
          localize(tx.reason),
          tx.category ?? '',
          tx.category ? t(resolveCategory(tx.category).labelKey) : '',
          String(tx.amount),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, query, period, account, type, category, localize, t]);

  const totals = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const tx of filtered) {
      if (isAdjustment(tx)) continue;
      if (tx.type === 'income') inflow += tx.amount;
      else if (tx.type === 'expense') outflow += tx.amount;
    }
    return { inflow, outflow };
  }, [filtered]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  // Paginate by item count, never splitting the header from its first rows.
  const visible = useMemo(() => {
    let count = 0;
    const out = [];
    for (const g of groups) {
      if (count >= limit) break;
      const items = g.items.slice(0, Math.max(0, limit - count));
      count += items.length;
      out.push({ ...g, items });
    }
    return out;
  }, [groups, limit]);

  const filtersActive = query || period !== 'all' || account !== 'all' || type !== 'all';
  const clearAll = () => {
    setQuery('');
    setPeriod('all');
    setAccount('all');
    setType('all');
    setCategory('all');
  };

  return (
    <div className="space-y-4">
      <ScreenHeader title={t('activity.title')} subtitle={t('common.entries', { count: transactions.length })} />

      {/* Search */}
      <label className="relative block">
        <span className="sr-only">{t('activity.search')}</span>
        <Search className="pointer-events-none absolute start-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('activity.search')}
          className="field ps-11 pe-11 [&::-webkit-search-cancel-button]:hidden"
          enterKeyHint="search"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="press absolute end-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:text-ink"
            aria-label={t('activity.clearSearch')}
          >
            <X className="size-4" />
          </button>
        )}
      </label>

      <Segmented
        label={t('activity.title')}
        value={period}
        onChange={setPeriod}
        options={(['all', 'today', '7days', 'month'] as const).map((p) => ({ value: p, label: t(`period.${p}`) }))}
      />

      {/* Account + type chips */}
      <div className="no-scrollbar rail-fade -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0 lg:[mask-image:none]">
        {(['all', 'cash', 'bank'] as const).map((a) => (
          <button key={a} type="button" className="chip press" aria-pressed={account === a} onClick={() => setAccount(a)}>
            {a === 'all' ? t('activity.accountAll') : t(a === 'cash' ? 'common.cash' : 'common.bank')}
          </button>
        ))}
        <span className="mx-1 w-px shrink-0 self-stretch bg-line-strong" aria-hidden />
        {(['all', 'expense', 'income', 'transfer'] as const).map((ty) => (
          <button
            key={ty}
            type="button"
            className="chip press"
            aria-pressed={type === ty}
            onClick={() => {
              setType(ty);
              setCategory('all');
            }}
          >
            {ty === 'all' ? t('activity.typeAll') : t(`common.${ty}`)}
          </button>
        ))}
      </div>

      {type === 'expense' && (
        <div className="no-scrollbar rail-fade -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0 lg:[mask-image:none]">
          <button type="button" className="chip press" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
            {t('composer.all')}
          </button>
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <button key={c.id} type="button" className="chip press" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
                <Icon className="size-4" style={{ color: category === c.id ? undefined : c.hue }} aria-hidden />
                {t(c.labelKey)}
              </button>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex items-center justify-between px-1 text-[13px] text-ink-3">
          <span>{t('common.entries', { count: filtered.length })}</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              {t('common.in')} <Money value={totals.inflow} className="font-medium text-in" />
            </span>
            <span className="flex items-center gap-1">
              {t('common.out')} <Money value={-totals.outflow} className="font-medium text-out" />
            </span>
          </span>
        </div>
      )}

      {transactions.length === 0 ? (
        <Empty
          title={t('activity.empty.title')}
          body={t('activity.empty.body')}
          action={{ label: t('home.empty.first'), onClick: onCompose }}
        />
      ) : filtered.length === 0 ? (
        <Empty
          icon={<SearchX className="size-8 text-ink-3" aria-hidden />}
          title={t('activity.noMatch.title')}
          body={t('activity.noMatch.body')}
          action={filtersActive ? { label: t('activity.clearFilters'), onClick: clearAll } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((g) => {
            const net = g.income - g.expense;
            return (
              <section key={g.key} className="card overflow-clip p-2" aria-label={dayLabel(g.date)}>
                <h2 className="glass-pill sticky top-2 z-[1] flex items-center justify-between rounded-full px-4 py-2">
                  <span className="text-[14px] font-semibold">{dayLabel(g.date)}</span>
                  {(g.income > 0 || g.expense > 0) && <Money value={net} sign tone className="text-[13px] font-medium" />}
                </h2>
                {g.items.map((tx) => (
                  <TxRow key={tx.id} tx={tx} onOpen={onOpenTx} account={account === 'all' ? undefined : account} />
                ))}
              </section>
            );
          })}
          {filtered.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="press glass-pill min-h-12 w-full rounded-full text-[15px] font-medium"
            >
              {t('activity.showMore')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Empty({
  title,
  body,
  icon,
  action,
}: {
  title: string;
  body: string;
  icon?: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      {icon ?? <Guilloche className="mb-2 size-20 text-accent opacity-50" density="light" />}
      <h2 className="mt-2 text-[17px] font-semibold">{title}</h2>
      <p className="mt-1 max-w-xs text-[15px] text-ink-2">{body}</p>
      {action && (
        <button type="button" onClick={action.onClick} className="press glass-pill mt-5 min-h-11 rounded-full px-5 text-[15px] font-medium">
          {action.label}
        </button>
      )}
    </div>
  );
}
