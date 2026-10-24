import { motion, useReducedMotion } from 'motion/react';
import { CalendarClock, ChevronLeft, FlaskConical, PieChart, Plus, Sparkles, Split, Target, type LucideIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { AssetGlyph, Donut, TYPE_META } from '../components/wealth/assetVisuals';
import { Money } from '../components/ui/Money';
import { GoalMedallion, usePercent } from '../components/ui/Pickers';
import { useNetWorth } from '../hooks/useNetWorth';
import { useI18n } from '../i18n/LanguageContext';
import { assetGain, assetValue, summarizeAssets, type Asset } from '../lib/assets';
import { goalProgress, type Goal } from '../lib/goals';
import { haptic } from '../lib/haptics';
import { quote } from '../lib/prices';
import { usePlanner } from '../state/PlannerContext';
import { useTools } from '../state/ToolsContext';
import { useWallet } from '../state/WalletContext';
import { ScreenHeader } from './ScreenHeader';
import { isolate } from '../lib/bidi';

/** Everything the user owns beyond the everyday wallet: assets, savings goals and the planning tools. */
export function Wealth() {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <ScreenHeader title={t('wealth.title')} subtitle={t('wealth.subtitle')} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2 lg:items-start">
        <div className="space-y-5">
          <AssetsOverview />
          <AssetList />
        </div>
        <div className="space-y-5">
          <Goals />
          <Tools />
        </div>
      </div>
    </div>
  );
}

function AssetsOverview() {
  const { t } = useI18n();
  const { assets, prefs } = usePlanner();
  const { balances } = useWallet();
  const net = useNetWorth();
  const summary = useMemo(() => summarizeAssets(assets), [assets]);
  const tools = useTools();

  return (
    <section className="card relative overflow-hidden p-5" aria-labelledby="assets-total">
      <div className="flex items-center gap-5">
        <Donut parts={summary.byType.map((x) => ({ key: x.type, share: x.share, hue: TYPE_META[x.type].hue }))}>
          <PieChart className="size-5 text-ink-3" aria-hidden />
        </Donut>
        <div className="min-w-0 flex-1">
          <h2 id="assets-total" className="eyebrow">
            {t('wealth.assetsTotal')}
          </h2>
          <Money value={summary.total} className="font-display mt-1 block text-[30px] leading-tight" />
          <p className="mt-1 text-[12px] leading-snug text-ink-3">{t('wealth.separate')}</p>
        </div>
      </div>

      {summary.byType.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
          {summary.byType.map((x) => (
            <li key={x.type} className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: TYPE_META[x.type].hue }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-ink-2">{t(TYPE_META[x.type].label)}</span>
              <span className="shrink-0 font-medium tabular" dir="ltr">
                {Math.round(x.share * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}

      {prefs.netWorth && (
        <dl className="mt-4 space-y-1.5 rounded-2xl bg-surface-2 p-3.5 text-[14px]">
          <Line label={t('wealth.wallet')} value={balances.total} />
          <Line label={t('common.vault')} value={balances.vault} />
          <Line label={t('wealth.assets')} value={net.assets} />
          {net.lent > 0 && <Line label={t('common.loans')} value={net.lent} />}
          {net.borrowed > 0 && <Line label={t('common.owed')} value={-net.borrowed} />}
          <div className="dashed-rule !my-2.5" />
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-semibold">{t('wealth.netWorth')}</dt>
            <dd>
              <Money value={net.total} className="font-display text-[20px]" />
            </dd>
          </div>
        </dl>
      )}

      <button
        type="button"
        onClick={() => {
          haptic('tap');
          tools.open({ name: 'asset', asset: null });
        }}
        className="foil press mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold"
      >
        <Plus className="size-5" aria-hidden />
        {t('asset.add')}
      </button>
    </section>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 truncate text-ink-2">{label}</dt>
      <dd className="shrink-0">
        <Money value={value} className="font-medium" />
      </dd>
    </div>
  );
}

function AssetList() {
  const { t } = useI18n();
  const { assets } = usePlanner();
  const summary = useMemo(() => summarizeAssets(assets), [assets]);
  if (!assets.length) {
    return (
      <section className="card p-5 text-center">
        <p className="text-[15px] font-semibold">{t('wealth.emptyTitle')}</p>
        <p className="mx-auto mt-1 max-w-xs text-[14px] leading-relaxed text-ink-2">{t('wealth.emptyBody')}</p>
      </section>
    );
  }
  return (
    <div className="space-y-4">
      {summary.byType.map((group) => (
        <section key={group.type} className="card p-2" aria-label={t(TYPE_META[group.type].plural)}>
          <div className="flex items-center justify-between gap-3 px-3 pt-2 pb-1">
            <h3 className="eyebrow">{t(TYPE_META[group.type].plural)}</h3>
            <Money value={group.value} className="text-[14px] font-semibold" />
          </div>
          {assets
            .filter((a) => a.type === group.type)
            .map((a) => (
              <AssetRow key={a.id} asset={a} />
            ))}
        </section>
      ))}
    </div>
  );
}

function AssetRow({ asset }: { asset: Asset }) {
  const { t, lang, money, info } = useI18n();
  const tools = useTools();
  const percent = usePercent();
  const value = assetValue(asset);
  const gain = assetGain(asset, value);
  const price = quote(asset);
  const locale = lang === 'de' ? 'de-DE' : 'en-US';
  const qty =
    asset.type === 'other'
      ? null
      : new Intl.NumberFormat(locale, {
          minimumFractionDigits: asset.type === 'crypto' && asset.quantity < 1 ? 8 : 0,
          maximumFractionDigits: asset.type === 'crypto' ? 8 : 3,
        }).format(asset.quantity);
  const purity = asset.type === 'gold' ? `${asset.purity}K` : asset.type === 'silver' ? String(asset.purity) : '';
  // Metal prices are per gram of the pure metal, whatever the piece's own fineness.
  const basis = asset.type === 'gold' ? ' (24K)' : asset.type === 'silver' ? ' (999)' : '';
  const perUnit =
    price.pricePerUnit !== undefined && asset.type !== 'diamond' && asset.type !== 'other'
      ? `${money(price.pricePerUnit)} / ${asset.unit}${basis}`
      : null;

  return (
    <button
      type="button"
      onClick={() => tools.open({ name: 'asset', asset })}
      className="press flex w-full items-start gap-3 rounded-2xl px-2 py-2.5 text-start hover:bg-surface-2/70"
    >
      <AssetGlyph asset={asset} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] leading-snug font-medium">{asset.name}</span>
        <span className="mt-0.5 block truncate text-[13px] text-ink-3" dir="auto">
          {qty !== null && (
            <span dir="ltr" className="tabular">
              {qty} {asset.unit}
            </span>
          )}
          {purity && <> · {purity}</>}
          {asset.note && <> · {asset.note}</>}
        </span>
        {perUnit && (
          <span className="mt-0.5 block truncate text-[12px] text-ink-3" dir="ltr">
            {perUnit}
          </span>
        )}
        <span className="mt-0.5 block truncate text-[11px] text-ink-3">
          {t('asset.priceUpdated', { date: shortDate(new Date(price.updatedAt ?? asset.priceUpdatedAt), info.dateLocale, t('day.today')) })}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <Money value={value} className="text-[15px] font-semibold" />
        {gain && (
          <span className={`flex flex-col items-end text-[12px] leading-tight font-medium ${gain.amount >= 0 ? 'text-in' : 'text-out'}`}>
            <Money value={gain.amount} sign />
            <span dir="ltr" className="tabular">
              {percent(gain.share, true)}
            </span>
          </span>
        )}
      </span>
    </button>
  );
}

function Goals() {
  const { t } = useI18n();
  const { goals } = usePlanner();
  const tools = useTools();
  return (
    <section aria-labelledby="goals-title">
      <div className="mb-2 flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 id="goals-title" className="eyebrow">
            {t('goal.title')}
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-3">{t('goal.hint')}</p>
        </div>
        <button
          type="button"
          onClick={() => tools.open({ name: 'goal', goal: null })}
          className="press flex min-h-10 shrink-0 items-center gap-1 rounded-full border border-line-strong px-3 text-[14px] font-medium hover:bg-surface-2"
        >
          <Plus className="size-4" aria-hidden />
          {t('goal.new')}
        </button>
      </div>
      {goals.length === 0 ? (
        <button
          type="button"
          onClick={() => tools.open({ name: 'goal', goal: null })}
          className="card press flex w-full items-center gap-3 p-4 text-start hover:border-line-strong"
        >
          <span
            className="grid size-12 shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-foil"
            aria-hidden
          >
            <Target className="size-5" />
          </span>
          <span className="min-w-0 flex-1 text-[14px] leading-relaxed text-ink-2">{t('goal.empty')}</span>
        </button>
      ) : (
        <div className="space-y-3">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </div>
      )}
    </section>
  );
}

export function GoalCard({ goal }: { goal: Goal }) {
  const { t, money, dateLabel } = useI18n();
  const { transactions } = useWallet();
  const tools = useTools();
  const reduced = useReducedMotion();
  const p = useMemo(() => goalProgress(goal, transactions), [goal, transactions]);

  return (
    <article className="card overflow-hidden p-4">
      <button type="button" onClick={() => tools.open({ name: 'goal', goal })} className="press flex w-full items-center gap-3 text-start">
        <GoalMedallion icon={goal.icon} photo={goal.photo} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold">{goal.name}</span>
          <span className="mt-0.5 block truncate text-[13px] text-ink-3">
            {goal.targetDate ? t('goal.by', { date: dateLabel(new Date(`${goal.targetDate}T12:00`)) }) : t('goal.noDate')}
          </span>
        </span>
        <span className="shrink-0 text-end">
          <span className="font-display block text-[20px] leading-none tabular" dir="ltr">
            {Math.round(p.share * 100)}%
          </span>
        </span>
      </button>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <motion.div
          className="h-full rounded-full"
          style={{ background: p.reached ? 'var(--in)' : 'linear-gradient(90deg, var(--coin-lo), var(--coin), var(--coin-hi))' }}
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${p.share * 100}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[13px]">
        <span className="text-ink-2">
          <Money value={p.saved} className="font-semibold text-ink" /> / <Money value={goal.target} />
        </span>
        <span className={p.reached ? 'font-semibold text-in' : p.overdue ? 'font-medium text-out' : 'text-ink-3'}>
          {p.reached ? t('goal.reached') : t('goal.remaining', { amount: isolate(money(p.remaining)) })}
        </span>
      </div>
      {p.perMonth !== null && (
        <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
          {p.overdue ? t('goal.overdue') : t('goal.perMonth', { amount: isolate(money(p.perMonth)), months: p.monthsLeft ?? 1 })}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        {!p.reached && (
          <button
            type="button"
            onClick={() => {
              haptic('tap');
              tools.open({ name: 'goalDeposit', goal });
            }}
            className="foil press flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl text-[14px] font-semibold"
          >
            <Plus className="size-4" aria-hidden />
            {t('goal.addMoney')}
          </button>
        )}
        {p.reached && (
          <button
            type="button"
            onClick={() => tools.open({ name: 'achievement', kind: 'goal', goalId: goal.id })}
            className="press flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-line-strong text-[14px] font-medium hover:bg-surface-2"
          >
            <Sparkles className="size-4 text-foil" aria-hidden />
            {t('achievement.share')}
          </button>
        )}
      </div>
    </article>
  );
}

function Tools() {
  const { t } = useI18n();
  const tools = useTools();
  return (
    <section>
      <h2 className="eyebrow mb-2 px-1">{t('wealth.tools')}</h2>
      <div className="card divide-y divide-line overflow-hidden">
        <ToolRow
          icon={CalendarClock}
          label={t('recurring.title')}
          hint={t('recurring.hint')}
          onClick={() => tools.open({ name: 'recurring' })}
        />
        <ToolRow icon={FlaskConical} label={t('whatif.title')} hint={t('whatif.hint')} onClick={() => tools.open({ name: 'whatIf' })} />
        <ToolRow icon={Split} label={t('split.title')} hint={t('split.hint')} onClick={() => tools.open({ name: 'splitRules' })} />
      </div>
    </section>
  );
}

export function ToolRow({
  icon: Icon,
  label,
  hint,
  onClick,
  trailing,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onClick: () => void;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-start hover:bg-surface-2/60"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-foil" aria-hidden>
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-ink-3">{hint}</span>}
      </span>
      {trailing}
      <ChevronLeft className="size-4 shrink-0 text-ink-3 ltr:rotate-180" aria-hidden />
    </button>
  );
}

/** "Today", or a short date ("21 Oct", with the year when it is not this year). */
function shortDate(d: Date, locale: string, today: string): string {
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return today;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  }).format(d);
}
