import { useId } from 'react';

interface LogoProps {
  /** 'full' = coin + wordmark, 'mark' = coin only, 'stacked' = coin above wordmark. */
  variant?: 'full' | 'mark' | 'stacked';
  /** Height of the coin in px; the wordmark scales with it. */
  size: number;
  className?: string;
  /** Solid outline colour instead of foil (e.g. a watermark). */
  color?: string;
}

/** Penniq coin: foil disc, beaded rim and a "p" whose bowl is a coin. */
function Coin({ size, color }: { size: number; color?: string }) {
  // useId() contains characters that are unsafe inside url(#…).
  const id = `coin${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const ink = color ?? 'var(--on-foil)';
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden focusable="false" className="shrink-0">
      {!color && (
        <defs>
          <linearGradient id={`${id}-foil`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--foil-hi)' }} />
            <stop offset="0.45" style={{ stopColor: 'var(--foil)' }} />
            <stop offset="1" style={{ stopColor: 'var(--foil-lo)' }} />
          </linearGradient>
        </defs>
      )}
      <circle cx="32" cy="32" r="30.5" fill={color ? 'none' : `url(#${id}-foil)`} stroke={color} strokeWidth={color ? 2 : 0} />
      <circle
        cx="32"
        cy="32"
        r="26.5"
        fill="none"
        stroke={ink}
        strokeOpacity={color ? 1 : 0.35}
        strokeWidth="1.3"
        strokeDasharray="0.1 3.1"
        strokeLinecap="round"
      />
      <g fill="none" stroke={ink} strokeLinecap="round" strokeWidth="5.6" strokeOpacity={color ? 1 : 0.92}>
        <path d="M23.5 25.5V48" />
        <circle cx="31.5" cy="29.5" r="8" />
      </g>
    </svg>
  );
}

function Wordmark({ size, color }: { size: number; color?: string }) {
  return (
    <span
      className={`font-display leading-none font-medium tracking-[-0.03em] ${color ? '' : 'foil-text'}`}
      style={{ fontSize: size * 0.78, color, paddingBottom: size * 0.12 }}
    >
      penniq
    </span>
  );
}

export function Logo({ variant = 'full', size, className = '', color }: LogoProps) {
  if (variant === 'mark') {
    return (
      <span role="img" aria-label="Penniq" className={`inline-flex ${className}`}>
        <Coin size={size} color={color} />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label="Penniq"
      dir="ltr"
      className={`inline-flex items-center ${variant === 'stacked' ? 'flex-col gap-3' : 'gap-2.5'} ${className}`}
    >
      <Coin size={size} color={color} />
      <Wordmark size={variant === 'stacked' ? size * 0.62 : size} color={color} />
    </span>
  );
}
