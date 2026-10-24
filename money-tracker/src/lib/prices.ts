/* PriceService — the only place the app asks "what is one unit of this asset worth?".

   Today every price is the one the user typed in (priceSource 'manual'). Market prices are planned
   (crypto, XAU / XAG per gram, exchange rates): a MarketProvider will be registered here and fill the
   cache; assets set to 'market' then read from it, with the manual price as the fallback when offline.
   Nothing outside this file needs to change for that. No provider is registered, so the app makes no
   outside request (see the GDPR rule in CLAUDE.md). */

import type { Asset } from './assets';

export interface PriceQuote {
  /** Price of one unit in `currency`, or undefined when nothing is known. */
  pricePerUnit?: number;
  currency: string;
  source: 'manual' | 'market';
  updatedAt?: string;
  /** Market prices only: change over the last 24 hours, as a fraction (0.031 = +3.1 %). */
  change24h?: number;
}

/** A future source of live prices (CoinGecko, a metals API, ECB rates…). */
export interface MarketProvider {
  id: string;
  /** Which symbols it can price, e.g. crypto coins or XAU / XAG. */
  supports: (symbol: string) => boolean;
  fetch: (symbols: string[], currency: string) => Promise<Record<string, Omit<PriceQuote, 'currency' | 'source'>>>;
}

const providers: MarketProvider[] = [];
/** symbol|currency → last market quote. */
const cache = new Map<string, PriceQuote>();
/** Market prices are fetched at most this often. */
export const MARKET_REFRESH_MS = 5 * 60_000;
let lastRefresh = 0;

export function registerProvider(provider: MarketProvider): void {
  providers.push(provider);
}

/** Price for a symbol in a currency: the cached market price if there is one. */
export function getPrice(symbol: string, currency: string): PriceQuote | undefined {
  return cache.get(`${symbol.toUpperCase()}|${currency}`);
}

/** The price an asset is valued at: its market price when it follows the market and one is known, else its manual price. */
export function quote(asset: Asset): PriceQuote {
  if (asset.priceSource === 'market') {
    const market = getPrice(asset.symbol, asset.priceCurrency);
    if (market?.pricePerUnit !== undefined) return market;
  }
  return { pricePerUnit: asset.pricePerUnit, currency: asset.priceCurrency, source: 'manual', updatedAt: asset.priceUpdatedAt };
}

/** Fetches market prices for the assets that follow the market. Does nothing while no provider is registered. */
export async function refreshMarketPrices(assets: Asset[], force = false): Promise<boolean> {
  if (!providers.length || (!force && Date.now() - lastRefresh < MARKET_REFRESH_MS)) return false;
  lastRefresh = Date.now();
  const wanted = assets.filter((a) => a.priceSource === 'market' && a.symbol);
  let changed = false;
  for (const provider of providers) {
    const byCurrency = new Map<string, string[]>();
    for (const a of wanted) {
      if (!provider.supports(a.symbol)) continue;
      byCurrency.set(a.priceCurrency, [...(byCurrency.get(a.priceCurrency) ?? []), a.symbol.toUpperCase()]);
    }
    for (const [currency, symbols] of byCurrency) {
      try {
        const got = await provider.fetch([...new Set(symbols)], currency);
        for (const [symbol, q] of Object.entries(got)) {
          cache.set(`${symbol}|${currency}`, { ...q, currency, source: 'market' });
          changed = true;
        }
      } catch {
        // Offline or refused: the last known price stays in use.
      }
    }
  }
  return changed;
}
