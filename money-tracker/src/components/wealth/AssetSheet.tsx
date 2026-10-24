import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import {
  ASSET_TYPES,
  CRYPTO_COINS,
  GOLD_KARATS,
  SILVER_PURITIES,
  assetGain,
  assetValue,
  quantityPlaces,
  valuedDirectly,
  type Asset,
  type AssetType,
} from '../../lib/assets';
import { COMMON_CURRENCIES, currencyFormat, currencyName } from '../../lib/currency';
import { haptic } from '../../lib/haptics';
import { newId } from '../../lib/ledger';
import { usePlanner } from '../../state/PlannerContext';
import { useToast } from '../../state/ToastContext';
import { Money } from '../ui/Money';
import { TextField, parseNumber, usePercent } from '../ui/Pickers';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { AssetGlyph, CoinLogo, TYPE_META } from './assetVisuals';

const GOLD_PIECES = ['ring', 'necklace', 'bracelet', 'coin', 'bar'] as const;

interface Draft {
  type: AssetType | null;
  name: string;
  symbol: string;
  customCoin: boolean;
  quantity: string;
  purity: number;
  price: string;
  value: string;
  note: string;
  currencyCode: string;
  purchasePrice: string;
  purchaseMode: 'total' | 'unit';
  purchaseDate: string;
}

const EMPTY: Draft = {
  type: null,
  name: '',
  symbol: 'BTC',
  customCoin: false,
  quantity: '',
  purity: 24,
  price: '',
  value: '',
  note: '',
  currencyCode: 'USD',
  purchasePrice: '',
  purchaseMode: 'total',
  purchaseDate: '',
};

function fromAsset(a: Asset): Draft {
  const known = CRYPTO_COINS.some((c) => c.symbol === a.symbol);
  return {
    type: a.type,
    name: a.name,
    symbol: a.symbol,
    customCoin: a.type === 'crypto' && !known,
    quantity: valuedDirectly(a.type) && a.type === 'other' ? '' : String(a.quantity),
    purity: a.purity ?? (a.type === 'silver' ? 999 : 24),
    price: a.pricePerUnit !== undefined ? String(a.pricePerUnit) : '',
    value: a.value !== undefined ? String(a.value) : '',
    note: a.note ?? '',
    currencyCode: a.type === 'currency' ? a.symbol : 'USD',
    purchasePrice: a.purchasePrice !== undefined ? String(a.purchasePrice) : '',
    purchaseMode: a.purchaseMode ?? 'total',
    purchaseDate: a.purchaseDate ?? '',
  };
}

/** Adds an asset or edits one: pick a type, then the fields that type needs. The value updates as you type. */
export function AssetSheet({ open, asset, onClose }: { open: boolean; asset: Asset | null; onClose: () => void }) {
  const { t, lang, currency, currencySymbol } = useI18n();
  const { assets, setAssets } = usePlanner();
  const toast = useToast();
  const percent = usePercent();
  const [d, setD] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setD(asset ? fromAsset(asset) : EMPTY);
    setErrors({});
    setPurchaseOpen(!!asset?.purchasePrice);
  }, [open, asset]);

  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const type = d.type;

  /** The asset the form describes right now (also used for the live value). */
  const built = useMemo((): Asset | null => {
    if (!type) return null;
    const q = parseNumber(d.quantity);
    const places = quantityPlaces(type);
    const quantity = Number.isFinite(q) ? Math.round(q * 10 ** places) / 10 ** places : NaN;
    const coin = CRYPTO_COINS.find((c) => c.symbol === d.symbol);
    const symbol =
      type === 'crypto'
        ? d.symbol.trim().toUpperCase()
        : type === 'gold'
          ? 'XAU'
          : type === 'silver'
            ? 'XAG'
            : type === 'currency'
              ? d.currencyCode
              : '';
    const name =
      d.name.trim() ||
      (type === 'crypto'
        ? (coin?.name ?? symbol)
        : type === 'gold'
          ? `${t('asset.type.gold')} ${d.purity}K`
          : type === 'silver'
            ? `${t('asset.type.silver')} ${d.purity}`
            : type === 'currency'
              ? currencyName(d.currencyCode, lang)
              : '');
    const price = parseNumber(d.price);
    const value = parseNumber(d.value);
    const purchase = parseNumber(d.purchasePrice);
    const now = new Date().toISOString();
    const priceChanged =
      !asset ||
      asset.pricePerUnit !== (Number.isFinite(price) ? price : undefined) ||
      asset.value !== (Number.isFinite(value) ? value : undefined);
    return {
      id: asset?.id ?? newId(),
      type,
      name,
      symbol,
      unit:
        type === 'crypto'
          ? symbol
          : type === 'gold' || type === 'silver'
            ? 'g'
            : type === 'diamond'
              ? 'ct'
              : type === 'currency'
                ? d.currencyCode
                : '',
      quantity: type === 'other' ? 1 : quantity,
      purity: type === 'gold' || type === 'silver' ? d.purity : undefined,
      pricePerUnit: valuedDirectly(type) ? undefined : Number.isFinite(price) ? price : undefined,
      value: valuedDirectly(type) && Number.isFinite(value) ? value : undefined,
      priceCurrency: currency,
      priceSource: asset?.priceSource ?? 'manual',
      priceUpdatedAt: priceChanged ? now : (asset?.priceUpdatedAt ?? now),
      purchasePrice: Number.isFinite(purchase) && purchase > 0 ? purchase : undefined,
      purchaseMode: d.purchaseMode,
      purchaseDate: d.purchaseDate || undefined,
      note: d.note.trim() || undefined,
      createdAt: asset?.createdAt ?? now,
    };
  }, [type, d, asset, currency, lang, t]);

  const value = built ? assetValue(built) : 0;
  const gain = built ? assetGain(built, value) : null;

  const save = () => {
    if (!built || !type) return;
    const e: Record<string, string> = {};
    if (type === 'crypto' && d.customCoin && (!d.name.trim() || !/^[A-Z0-9]{2,10}$/.test(built.symbol))) e.coin = t('asset.err.coin');
    if (type === 'other' && !d.name.trim()) e.name = t('asset.err.name');
    if (type !== 'other' && !(built.quantity > 0)) e.quantity = t('asset.err.quantity');
    if (valuedDirectly(type) ? !(built.value! > 0) : !(built.pricePerUnit! > 0)) e.price = t('asset.err.price');
    setErrors(e);
    if (Object.keys(e).length) return haptic('warning');
    setAssets(asset ? assets.map((a) => (a.id === asset.id ? built : a)) : [...assets, built]);
    haptic('success');
    toast.show({ message: t(asset ? 'toast.updated' : 'asset.added', { name: built.name }) });
    onClose();
  };

  const remove = () => {
    if (!asset) return;
    const before = assets;
    setAssets(assets.filter((a) => a.id !== asset.id));
    haptic('select');
    toast.show({
      message: t('asset.removed', { name: asset.name }),
      action: { label: t('common.undo'), onAction: () => setAssets(before) },
    });
    onClose();
  };

  const priceLabel =
    type === 'crypto'
      ? t('asset.price.coin', { symbol: built?.symbol || '' })
      : type === 'gold'
        ? t('asset.price.gold')
        : type === 'silver'
          ? t('asset.price.silver')
          : t('asset.price.rate', { code: d.currencyCode, currency: currencySymbol });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={type ? t(TYPE_META[type].label) : undefined}
      title={asset ? t('asset.edit') : t('asset.add')}
      footer={
        type ? (
          <div className="flex gap-2">
            {asset && (
              <button
                type="button"
                onClick={remove}
                aria-label={t('common.delete')}
                className="press grid min-h-13 w-14 shrink-0 place-items-center rounded-2xl border border-line-strong text-out hover:bg-surface-2"
              >
                <Trash2 className="size-5" />
              </button>
            )}
            <button type="button" onClick={save} className="foil press min-h-13 flex-1 rounded-2xl text-[16px] font-semibold">
              {t('common.save')}
            </button>
          </div>
        ) : undefined
      }
    >
      {!type ? (
        <div className="grid grid-cols-2 gap-2.5">
          {ASSET_TYPES.map((x) => {
            const meta = TYPE_META[x];
            const Icon = meta.icon;
            return (
              <button
                key={x}
                type="button"
                onClick={() => {
                  haptic('select');
                  set({ type: x, purity: x === 'silver' ? 999 : 24 });
                }}
                className="card press flex min-h-[96px] flex-col items-start justify-between gap-2 p-4 text-start hover:border-line-strong"
              >
                <span
                  className="grid size-10 place-items-center rounded-xl"
                  style={{ background: `color-mix(in oklab, ${meta.hue} 18%, transparent)`, color: meta.hue }}
                  aria-hidden
                >
                  <Icon className="size-5" />
                </span>
                <span className="text-[15px] font-semibold">{t(meta.label)}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Live value */}
          <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4">
            <AssetGlyph asset={{ type, symbol: built?.symbol ?? '' }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] text-ink-2">{built?.name || t(TYPE_META[type].label)}</div>
              <Money value={value} className="font-display block text-[26px] leading-tight" />
            </div>
            {gain && (
              <span className={`shrink-0 text-end text-[13px] font-semibold ${gain.amount >= 0 ? 'text-in' : 'text-out'}`}>
                <Money value={gain.amount} sign />
                <span className="block tabular" dir="ltr">
                  {percent(gain.share, true)}
                </span>
              </span>
            )}
          </div>

          {type === 'crypto' && (
            <fieldset>
              <legend className="eyebrow mb-2">{t('asset.coin')}</legend>
              <div className="flex flex-wrap gap-2">
                {CRYPTO_COINS.map((c) => (
                  <button
                    key={c.symbol}
                    type="button"
                    aria-pressed={!d.customCoin && d.symbol === c.symbol}
                    onClick={() => {
                      haptic('select');
                      set({ symbol: c.symbol, customCoin: false, name: '' });
                    }}
                    className="chip press"
                  >
                    <CoinLogo symbol={c.symbol} size={16} />
                    <span dir="ltr">{c.symbol}</span>
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={d.customCoin}
                  onClick={() => set({ customCoin: true, symbol: '', name: '' })}
                  className="chip press border-dashed"
                >
                  {t('asset.customCoin')}
                </button>
              </div>
              {d.customCoin && (
                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                  <TextField label={t('asset.coinName')} value={d.name} onChange={(v) => set({ name: v })} maxLength={30} />
                  <TextField
                    label={t('asset.symbol')}
                    value={d.symbol}
                    onChange={(v) => set({ symbol: v.toUpperCase() })}
                    maxLength={10}
                    dir="ltr"
                  />
                </div>
              )}
              {errors.coin && (
                <p role="alert" className="mt-1.5 text-[13px] font-medium text-out">
                  {errors.coin}
                </p>
              )}
            </fieldset>
          )}

          {type === 'gold' && (
            <>
              <div>
                <span className="eyebrow mb-2 block">{t('asset.karat')}</span>
                <Segmented
                  label={t('asset.karat')}
                  value={String(d.purity)}
                  onChange={(v) => set({ purity: Number(v) })}
                  options={GOLD_KARATS.map((k) => ({ value: String(k), label: <span dir="ltr">{k}K</span> }))}
                />
              </div>
              <div>
                <TextField
                  label={t('asset.description')}
                  value={d.name}
                  onChange={(v) => set({ name: v })}
                  placeholder={t('asset.goldPlaceholder')}
                />
                <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
                  {GOLD_PIECES.map((p) => (
                    <button key={p} type="button" className="chip press shrink-0" onClick={() => set({ name: t(`asset.piece.${p}`) })}>
                      {t(`asset.piece.${p}`)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {type === 'silver' && (
            <>
              <div>
                <span className="eyebrow mb-2 block">{t('asset.purity')}</span>
                <Segmented
                  label={t('asset.purity')}
                  value={String(d.purity)}
                  onChange={(v) => set({ purity: Number(v) })}
                  options={SILVER_PURITIES.map((k) => ({ value: String(k), label: <span dir="ltr">{k}</span> }))}
                />
              </div>
              <TextField
                label={t('asset.description')}
                value={d.name}
                onChange={(v) => set({ name: v })}
                placeholder={t('asset.silverPlaceholder')}
              />
            </>
          )}

          {type === 'diamond' && (
            <TextField
              label={t('asset.description')}
              value={d.name}
              onChange={(v) => set({ name: v })}
              placeholder={t('asset.diamondPlaceholder')}
            />
          )}

          {type === 'currency' && (
            <fieldset>
              <legend className="eyebrow mb-2">{t('asset.currency')}</legend>
              <div className="no-scrollbar rail-fade -mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5">
                {COMMON_CURRENCIES.filter((c) => c !== currency).map((code) => (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={d.currencyCode === code}
                    onClick={() => {
                      haptic('select');
                      set({ currencyCode: code, name: '' });
                    }}
                    className="chip press shrink-0"
                  >
                    <span dir="ltr">{code}</span>
                    <span className="opacity-70">{currencyFormat(code, lang).symbol}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {type === 'other' && (
            <TextField
              label={t('asset.name')}
              value={d.name}
              onChange={(v) => set({ name: v })}
              error={errors.name}
              placeholder={t('asset.otherPlaceholder')}
            />
          )}

          {type !== 'other' && (
            <TextField
              label={
                type === 'crypto'
                  ? t('asset.quantity.coins')
                  : type === 'diamond'
                    ? t('asset.quantity.carat')
                    : type === 'currency'
                      ? t('asset.quantity.amount')
                      : t('asset.quantity.grams')
              }
              value={d.quantity}
              onChange={(v) => set({ quantity: v })}
              inputMode="decimal"
              dir="ltr"
              error={errors.quantity}
              placeholder={type === 'crypto' ? '0.00000000' : '0'}
              trailing={built?.unit}
            />
          )}

          {valuedDirectly(type) ? (
            <TextField
              label={type === 'diamond' ? t('asset.estimated') : t('asset.value')}
              value={d.value}
              onChange={(v) => set({ value: v })}
              inputMode="decimal"
              dir="ltr"
              error={errors.price}
              trailing={currencySymbol}
            />
          ) : (
            <TextField
              label={priceLabel}
              value={d.price}
              onChange={(v) => set({ price: v })}
              inputMode="decimal"
              dir="ltr"
              error={errors.price}
              trailing={currencySymbol}
            />
          )}

          {(type === 'crypto' || type === 'diamond' || type === 'other' || type === 'gold') && (
            <TextField
              label={`${type === 'crypto' ? t('asset.wallet') : t('asset.note')} · ${t('common.optional')}`}
              value={d.note}
              onChange={(v) => set({ note: v })}
              maxLength={60}
            />
          )}

          {/* Purchase */}
          <div className="rounded-2xl border border-line">
            <button
              type="button"
              aria-expanded={purchaseOpen}
              onClick={() => setPurchaseOpen((x) => !x)}
              className="press flex min-h-12 w-full items-center gap-2 px-4 text-start text-[15px] font-medium"
            >
              <span className="flex-1">
                {t('asset.purchase')} · <span className="text-ink-3">{t('common.optional')}</span>
              </span>
              <ChevronDown className={`size-4 text-ink-3 transition-transform ${purchaseOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            <AnimatePresence initial={false}>
              {purchaseOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-4 px-4 pb-4">
                    {!valuedDirectly(type) && (
                      <Segmented
                        label={t('asset.purchase')}
                        value={d.purchaseMode}
                        onChange={(v) => set({ purchaseMode: v })}
                        options={[
                          { value: 'total', label: t('asset.purchase.total') },
                          { value: 'unit', label: t('asset.purchase.unit') },
                        ]}
                      />
                    )}
                    <TextField
                      label={t('asset.purchase.price')}
                      value={d.purchasePrice}
                      onChange={(v) => set({ purchasePrice: v })}
                      inputMode="decimal"
                      dir="ltr"
                      trailing={currencySymbol}
                    />
                    <TextField
                      label={t('asset.purchase.date')}
                      value={d.purchaseDate}
                      onChange={(v) => set({ purchaseDate: v })}
                      type="date"
                      dir="ltr"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </Sheet>
  );
}
