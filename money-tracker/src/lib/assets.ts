/* Assets: what the user owns outside the wallet — crypto, gold, silver, diamonds, foreign cash, other things
   of value. They are kept on this device and never mixed into the cash / bank balance.

   Every value is worked out by assetValue() from the price that PriceService (./prices.ts) reports, so
   switching from manual prices to market prices later changes nothing here or in the screens. */

import { roundMoney } from './ledger';
import { quote, type PriceQuote } from './prices';

export type AssetType = 'crypto' | 'gold' | 'silver' | 'diamond' | 'currency' | 'other';
export const ASSET_TYPES: AssetType[] = ['crypto', 'gold', 'silver', 'diamond', 'currency', 'other'];

export interface Asset {
  id: string;
  type: AssetType;
  /** What the user calls it: "Bitcoin", "Wedding ring", "US dollars"… */
  name: string;
  /** BTC, ETH… for crypto; XAU / XAG for gold and silver; USD, TRY… for currencies. */
  symbol: string;
  /** What the quantity counts: the coin symbol, "g", "ct", the currency code. */
  unit: string;
  /** Coins, grams, carats or banknotes. Up to 8 decimals for crypto. */
  quantity: number;
  /** Gold: karat (24, 22, 21, 18, 14). Silver: fineness (999, 925). */
  purity?: number;
  /** Manual price of one unit in priceCurrency: per coin, per gram of pure metal, or the exchange rate. */
  pricePerUnit?: number;
  /** Diamonds and "other": the whole value, entered directly. */
  value?: number;
  /** The wallet currency the prices were entered in (amounts are never converted). */
  priceCurrency: string;
  priceSource: 'manual' | 'market';
  priceUpdatedAt: string;
  /** What it cost, either in total or per unit (see purchaseMode). */
  purchasePrice?: number;
  purchaseMode?: 'total' | 'unit';
  purchaseDate?: string;
  /** Wallet or exchange for crypto, the piece for gold ("ring", "bar"…), a note for the rest. */
  note?: string;
  createdAt: string;
}

export const GOLD_KARATS = [24, 22, 21, 18, 14];
export const SILVER_PURITIES = [999, 925];

/** The coins offered in the picker; anything else is added as a custom coin. */
export const CRYPTO_COINS: { symbol: string; name: string }[] = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'USDT', name: 'Tether' },
  { symbol: 'USDC', name: 'USD Coin' },
  { symbol: 'BNB', name: 'BNB' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'TON', name: 'Toncoin' },
  { symbol: 'LTC', name: 'Litecoin' },
  { symbol: 'DOT', name: 'Polkadot' },
];

/** Decimal places a quantity may have. */
export function quantityPlaces(type: AssetType): number {
  return type === 'crypto' ? 8 : type === 'currency' ? 2 : 3;
}

/** Share of pure metal: 18 karat is 18/24, sterling silver is 925/1000. */
export function fineness(asset: Pick<Asset, 'type' | 'purity'>): number {
  if (asset.type === 'gold') return (asset.purity ?? 24) / 24;
  if (asset.type === 'silver') return (asset.purity ?? 999) / 1000;
  return 1;
}

/** True for the types whose value is typed in directly rather than worked out from a price. */
export function valuedDirectly(type: AssetType): boolean {
  return type === 'diamond' || type === 'other';
}

/** The one place an asset's worth is calculated. */
export function assetValue(asset: Asset, price: PriceQuote = quote(asset)): number {
  const safe = (n: number | undefined) => (n !== undefined && Number.isFinite(n) ? n : 0);
  if (valuedDirectly(asset.type)) return roundMoney(safe(asset.value));
  return roundMoney(safe(asset.quantity) * safe(price.pricePerUnit) * fineness(asset));
}

/** What the asset cost in total, or null when no purchase price was entered. */
export function assetCost(asset: Asset): number | null {
  if (asset.purchasePrice === undefined || !(asset.purchasePrice > 0)) return null;
  return roundMoney(asset.purchaseMode === 'unit' ? asset.purchasePrice * asset.quantity : asset.purchasePrice);
}

export interface AssetGain {
  amount: number;
  /** Fraction of the cost: 0.12 is +12 %. */
  share: number;
}

export function assetGain(asset: Asset, value = assetValue(asset)): AssetGain | null {
  const cost = assetCost(asset);
  if (cost === null) return null;
  return { amount: roundMoney(value - cost), share: cost > 0 ? (value - cost) / cost : 0 };
}

export interface AssetSummary {
  total: number;
  byType: { type: AssetType; value: number; share: number; count: number }[];
}

export function summarizeAssets(assets: Asset[]): AssetSummary {
  const map = new Map<AssetType, { value: number; count: number }>();
  let total = 0;
  for (const a of assets) {
    const v = assetValue(a);
    total += v;
    const slot = map.get(a.type) ?? { value: 0, count: 0 };
    slot.value += v;
    slot.count += 1;
    map.set(a.type, slot);
  }
  const byType = ASSET_TYPES.filter((t) => map.has(t)).map((type) => {
    const s = map.get(type)!;
    return { type, value: roundMoney(s.value), count: s.count, share: total > 0 ? s.value / total : 0 };
  });
  return { total: roundMoney(total), byType };
}

/* ---------- Stored list ---------- */

const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return v !== undefined && v !== null && v !== '' && Number.isFinite(n) ? n : undefined;
};

/** Reads whatever was stored, dropping anything that does not look like an asset. */
export function parseAssets(v: unknown, fallbackCurrency: string): Asset[] {
  if (!Array.isArray(v)) return [];
  const out: Asset[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const a = raw as Record<string, unknown>;
    const type = ASSET_TYPES.includes(a.type as AssetType) ? (a.type as AssetType) : null;
    if (!type || typeof a.id !== 'string' || typeof a.name !== 'string') continue;
    const quantity = num(a.quantity) ?? (valuedDirectly(type) ? 1 : undefined);
    if (quantity === undefined || quantity < 0) continue;
    out.push({
      id: a.id,
      type,
      name: a.name.slice(0, 60),
      symbol: typeof a.symbol === 'string' ? a.symbol.slice(0, 12) : '',
      unit: typeof a.unit === 'string' ? a.unit.slice(0, 12) : '',
      quantity,
      purity: num(a.purity),
      pricePerUnit: num(a.pricePerUnit),
      value: num(a.value),
      priceCurrency: typeof a.priceCurrency === 'string' ? a.priceCurrency : fallbackCurrency,
      priceSource: a.priceSource === 'market' ? 'market' : 'manual',
      priceUpdatedAt: typeof a.priceUpdatedAt === 'string' ? a.priceUpdatedAt : new Date().toISOString(),
      purchasePrice: num(a.purchasePrice),
      purchaseMode: a.purchaseMode === 'unit' ? 'unit' : 'total',
      purchaseDate: typeof a.purchaseDate === 'string' ? a.purchaseDate : undefined,
      note: typeof a.note === 'string' ? a.note.slice(0, 80) : undefined,
      createdAt: typeof a.createdAt === 'string' ? a.createdAt : new Date().toISOString(),
    });
  }
  return out;
}
