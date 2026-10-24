import { DESCRIPTOR, STACKED, SYMBOL, WORDMARK } from './brandArt';

interface LogoProps {
  /** 'mark' = the symbol alone, 'full' = symbol beside the wordmark, 'stacked' = the primary lockup with «محفظتك.». */
  variant?: 'full' | 'mark' | 'stacked';
  /** Height in px: of the symbol for 'mark' and 'full', of the whole lockup for 'stacked'. */
  size: number;
  className?: string;
  /** One solid colour for every part (watermarks, single-colour versions). */
  color?: string;
  /** Colour of the cradle and the wordmark; the coin stays gold. Defaults to the ink colour. */
  ink?: string;
}

/** The Penniq symbol: a coin held by an open hand. Master artwork, never redrawn. */
export function Mark({ size, color, ink, className = '' }: { size: number; color?: string; ink?: string; className?: string }) {
  const width = (size * SYMBOL.width) / SYMBOL.height;
  return (
    <svg
      viewBox={`0 0 ${SYMBOL.width} ${SYMBOL.height}`}
      width={width}
      height={size}
      aria-hidden
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <path d={SYMBOL.coin} fill={color ?? 'var(--coin)'} />
      <path d={SYMBOL.cradle} fill={color ?? ink ?? 'var(--ink)'} />
    </svg>
  );
}

/** The wordmark alone, as outlined artwork (the name is never retyped). */
export function Wordmark({ height, color }: { height: number; color?: string }) {
  return (
    <svg
      viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`}
      width={(height * WORDMARK.width) / WORDMARK.height}
      height={height}
      aria-hidden
      focusable="false"
      className="shrink-0"
    >
      <path d={WORDMARK.d} fill={color ?? 'currentColor'} />
    </svg>
  );
}

/** «محفظتك.», the descriptor set under the wordmark. */
export function Descriptor({ height, color }: { height: number; color?: string }) {
  return (
    <svg
      viewBox={`0 0 ${DESCRIPTOR.width} ${DESCRIPTOR.height}`}
      width={(height * DESCRIPTOR.width) / DESCRIPTOR.height}
      height={height}
      aria-hidden
      focusable="false"
      className="shrink-0"
    >
      <path d={DESCRIPTOR.d} fill={color ?? 'currentColor'} />
    </svg>
  );
}

export function Logo({ variant = 'full', size, className = '', color, ink }: LogoProps) {
  if (variant === 'mark') {
    return (
      <span role="img" aria-label="Penniq" className={`inline-flex ${className}`}>
        <Mark size={size} color={color} ink={ink} />
      </span>
    );
  }
  if (variant === 'stacked') {
    return (
      <span role="img" aria-label="Penniq — محفظتك" className={`inline-flex ${className}`}>
        <svg
          viewBox={`0 0 ${STACKED.width} ${STACKED.height}`}
          width={(size * STACKED.width) / STACKED.height}
          height={size}
          aria-hidden
          focusable="false"
        >
          <path d={STACKED.coin} fill={color ?? 'var(--coin)'} />
          <g fill={color ?? ink ?? 'var(--ink)'}>
            <path d={STACKED.cradle} />
            <path d={STACKED.word} />
            <path d={STACKED.desc} />
          </g>
        </svg>
      </span>
    );
  }
  // Horizontal lockup (guideline p.15): the wordmark's cap height sits level with the symbol.
  return (
    <span role="img" aria-label="Penniq" dir="ltr" className={`inline-flex items-center ${className}`} style={{ gap: size * 0.28 }}>
      <Mark size={size} color={color} ink={ink} />
      <span style={{ color: color ?? ink ?? 'var(--ink)', marginTop: size * 0.22 }}>
        <Wordmark height={size * 1.02} />
      </span>
    </span>
  );
}
