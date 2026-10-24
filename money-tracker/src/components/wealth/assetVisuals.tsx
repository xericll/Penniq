import { Banknote, Bitcoin, Coins, Gem, Medal, Package, type LucideIcon } from 'lucide-react';
import {
  siBinance,
  siBitcoin,
  siCardano,
  siDogecoin,
  siEthereum,
  siLitecoin,
  siPolkadot,
  siSolana,
  siTether,
  siTon,
  siXrp,
} from 'simple-icons';
import type { ReactNode } from 'react';
import type { TranslationKey } from '../../i18n/translations';
import type { Asset, AssetType } from '../../lib/assets';

export const TYPE_META: Record<AssetType, { icon: LucideIcon; hue: string; label: TranslationKey; plural: TranslationKey }> = {
  crypto: { icon: Bitcoin, hue: '#8f9bb8', label: 'asset.type.crypto', plural: 'asset.group.crypto' },
  gold: { icon: Coins, hue: '#c9a24b', label: 'asset.type.gold', plural: 'asset.group.gold' },
  silver: { icon: Medal, hue: '#a3aab3', label: 'asset.type.silver', plural: 'asset.group.silver' },
  diamond: { icon: Gem, hue: '#78aab3', label: 'asset.type.diamond', plural: 'asset.group.diamond' },
  currency: { icon: Banknote, hue: '#879563', label: 'asset.type.currency', plural: 'asset.group.currency' },
  other: { icon: Package, hue: '#9c9686', label: 'asset.type.other', plural: 'asset.group.other' },
};

const COIN_LOGOS: Record<string, { path: string; hex: string }> = {
  BTC: siBitcoin,
  ETH: siEthereum,
  USDT: siTether,
  BNB: siBinance,
  SOL: siSolana,
  XRP: siXrp,
  ADA: siCardano,
  DOGE: siDogecoin,
  TON: siTon,
  LTC: siLitecoin,
  DOT: siPolkadot,
};

/** A coin's logo where one is known, otherwise its symbol on a plain disc. */
export function CoinLogo({ symbol, size = 20 }: { symbol: string; size?: number }) {
  const logo = COIN_LOGOS[symbol.toUpperCase()];
  if (logo) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="currentColor">
        <path d={logo.path} />
      </svg>
    );
  }
  return (
    <span className="font-display leading-none font-semibold" style={{ fontSize: size * 0.5 }} aria-hidden>
      {symbol.slice(0, 4).toUpperCase() || '?'}
    </span>
  );
}

/** The tile in front of each asset row. */
export function AssetGlyph({ asset, size = 44 }: { asset: Pick<Asset, 'type' | 'symbol'>; size?: number }) {
  const meta = TYPE_META[asset.type];
  const Icon = meta.icon;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[14px]"
      style={{
        width: size,
        height: size,
        background: `color-mix(in oklab, ${meta.hue} 18%, transparent)`,
        color: `color-mix(in oklab, ${meta.hue} 80%, var(--ink))`,
      }}
      aria-hidden
    >
      {asset.type === 'crypto' && asset.symbol ? (
        <CoinLogo symbol={asset.symbol} size={size * 0.45} />
      ) : (
        <Icon className="size-5" strokeWidth={1.8} />
      )}
    </span>
  );
}

/** Ring split by type: what the assets are made of. */
export function Donut({
  parts,
  size = 132,
  stroke = 14,
  children,
}: {
  parts: { key: string; share: number; hue: string }[];
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = parts.length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        {parts.map((p) => {
          const len = Math.max(0, p.share * c - gap);
          const el = (
            <circle
              key={p.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={p.hue}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              style={{ transition: 'stroke-dasharray 700ms var(--ease-out-soft), stroke-dashoffset 700ms var(--ease-out-soft)' }}
            />
          );
          offset += p.share * c;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
