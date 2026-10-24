import { FileDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/LanguageContext';
import { resolveCategory } from '../../lib/categories';
import { haptic } from '../../lib/haptics';
import { byNewest, categoryBreakdown, computeBalances, flowBetween, isFlow, signedAmount, walletEffect } from '../../lib/ledger';
import { useWallet } from '../../state/WalletContext';
import type { Transaction } from '../../types';
import { Logo } from '../ui/Logo';
import { TextField } from '../ui/Pickers';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { useDescribe } from '../tx/describe';

type Period = 'this' | 'last' | 'custom';

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Export as PDF. The report is laid out as a page of the app and handed to the browser's print
 * dialog ("Save as PDF"): the browser shapes Arabic itself with the bundled fonts, so letters are
 * joined and right-to-left exactly as on screen, and nothing is sent anywhere.
 */
export function ReportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, dateLabel } = useI18n();
  const [period, setPeriod] = useState<Period>('this');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    setPeriod('this');
    setFrom(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
    setTo(iso(now));
  }, [open]);

  const range = useMemo(() => {
    const now = new Date();
    if (period === 'this')
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    if (period === 'last')
      return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 1) };
    const a = new Date(`${from}T00:00`);
    const b = new Date(`${to}T00:00`);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return null;
    return { start: a, end: new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1) };
  }, [period, from, to]);

  // Print once the report is in the page and the fonts are ready; tidy up when the dialog closes.
  useEffect(() => {
    if (!printing) return;
    const title = document.title;
    const done = () => {
      document.title = title;
      setPrinting(false);
    };
    window.addEventListener('afterprint', done, { once: true });
    let cancelled = false;
    void document.fonts.ready.then(() =>
      requestAnimationFrame(() => {
        if (cancelled || !range) return;
        document.title = `Penniq ${iso(range.start)} – ${iso(new Date(range.end.getTime() - 86_400_000))}`;
        window.print();
        // Browsers without afterprint (some in-app views) return from print() when it is over.
        window.setTimeout(done, 1500);
      }),
    );
    return () => {
      cancelled = true;
      window.removeEventListener('afterprint', done);
    };
  }, [printing, range]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('report.title')}
      footer={
        <button
          type="button"
          onClick={() => {
            if (!range) return haptic('warning');
            haptic('select');
            setPrinting(true);
          }}
          aria-disabled={!range}
          className={`press flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold ${range ? 'foil' : 'bg-surface-2 text-ink-3'}`}
        >
          <FileDown className="size-5" aria-hidden />
          {t('report.create')}
        </button>
      }
    >
      <p className="mb-4 text-[14px] leading-relaxed text-ink-2">{t('report.intro')}</p>
      <Segmented
        label={t('report.period')}
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'this', label: t('report.thisMonth') },
          { value: 'last', label: t('report.lastMonth') },
          { value: 'custom', label: t('report.custom') },
        ]}
      />
      {period === 'custom' && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <TextField label={t('report.from')} value={from} onChange={setFrom} type="date" dir="ltr" />
          <TextField label={t('report.to')} value={to} onChange={setTo} type="date" dir="ltr" />
        </div>
      )}
      {range ? (
        <p className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-[14px] text-ink-2">
          {dateLabel(range.start)} – {dateLabel(new Date(range.end.getTime() - 86_400_000))}
        </p>
      ) : (
        <p role="alert" className="mt-4 text-[13px] font-medium text-out">
          {t('report.badRange')}
        </p>
      )}
      <p className="mt-3 text-[12px] leading-relaxed text-ink-3">{t('report.hint')}</p>
      {printing && range && createPortal(<PrintReport start={range.start} end={range.end} />, document.body)}
    </Sheet>
  );
}

function PrintReport({ start, end }: { start: Date; end: Date }) {
  const { t, money, dateLabel, accountName, dir, lang } = useI18n();
  const { transactions } = useWallet();
  const describe = useDescribe();
  const data = useMemo(() => {
    const inRange = (tx: Transaction) => {
      const d = new Date(tx.timestamp);
      return d >= start && d < end;
    };
    const list = transactions.filter(inRange).sort(byNewest).reverse();
    const balances = computeBalances(transactions.filter((tx) => new Date(tx.timestamp) < end));
    const flow = flowBetween(transactions, start, end);
    const cats = categoryBreakdown(
      transactions.filter((tx) => new Date(tx.timestamp) < end),
      start,
    );
    return { list, balances, flow, cats };
  }, [transactions, start, end]);
  const last = new Date(end.getTime() - 86_400_000);
  const shortDate = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SY-u-nu-latn' : lang === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div id="print-root" data-edition="parchment" dir={dir} lang={lang}>
      <header className="print-head">
        <Logo size={30} />
        <div>
          <h1>{t('report.docTitle')}</h1>
          <p>
            {dateLabel(start)} – {dateLabel(last)}
          </p>
        </div>
      </header>

      <section className="print-grid">
        <div>
          <span>{t('report.balance')}</span>
          <strong dir="ltr">{money(data.balances.total, { decimals: 'always' })}</strong>
          <small>
            {accountName('cash')} <b dir="ltr">{money(data.balances.cash, { decimals: 'always' })}</b> · {accountName('bank')}{' '}
            <b dir="ltr">{money(data.balances.bank, { decimals: 'always' })}</b>
          </small>
        </div>
        <div>
          <span>{t('report.income')}</span>
          <strong dir="ltr" className="pos">
            {money(data.flow.income, { decimals: 'always', sign: true })}
          </strong>
        </div>
        <div>
          <span>{t('report.expenses')}</span>
          <strong dir="ltr" className="neg">
            {money(-data.flow.expense, { decimals: 'always' })}
          </strong>
        </div>
        <div>
          <span>{t('common.net')}</span>
          <strong dir="ltr">{money(data.flow.net, { decimals: 'always', sign: true })}</strong>
        </div>
      </section>

      {data.cats.slices.length > 0 && (
        <section>
          <h2>{t('report.byCategory')}</h2>
          <table>
            <tbody>
              {data.cats.slices.map((s) => (
                <tr key={s.category.id}>
                  <td>{t(s.category.labelKey)}</td>
                  <td className="bar-cell">
                    <span className="bar" style={{ width: `${Math.max(2, s.share * 100)}%`, background: s.category.hue }} />
                  </td>
                  <td className="num" dir="ltr">
                    {Math.round(s.share * 100)}%
                  </td>
                  <td className="num" dir="ltr">
                    {money(s.amount, { decimals: 'always' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h2>
          {t('report.transactions')} ({data.list.length})
        </h2>
        {data.list.length === 0 ? (
          <p className="muted">{t('report.none')}</p>
        ) : (
          <table className="tx">
            <thead>
              <tr>
                <th>{t('report.col.date')}</th>
                <th>{t('report.col.description')}</th>
                <th>{t('report.col.category')}</th>
                <th>{t('report.col.account')}</th>
                <th className="num">{t('report.col.amount')}</th>
              </tr>
            </thead>
            <tbody>
              {data.list.map((tx) => {
                const view = describe(tx);
                const value = tx.type === 'transfer' ? walletEffect(tx) || tx.amount : signedAmount(tx);
                return (
                  <tr key={tx.id}>
                    <td dir="ltr" className="nowrap">
                      {shortDate.format(new Date(tx.timestamp))}
                    </td>
                    <td>{view.title}</td>
                    <td>
                      {tx.type === 'expense' && isFlow(tx)
                        ? t(resolveCategory(tx.category).labelKey)
                        : tx.type === 'transfer'
                          ? t('common.transfer')
                          : (view.label ?? (tx.type === 'income' ? t('common.income') : ''))}
                    </td>
                    <td>{tx.type === 'transfer' ? view.meta : accountName(tx.account)}</td>
                    <td className={`num nowrap ${value > 0 && tx.type !== 'transfer' ? 'pos' : value < 0 ? 'neg' : ''}`} dir="ltr">
                      {money(value, { decimals: 'always', sign: tx.type === 'income' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <footer className="print-foot">Penniq · penniq.pages.dev · {t('report.generated', { date: dateLabel(new Date()) })}</footer>
    </div>
  );
}
