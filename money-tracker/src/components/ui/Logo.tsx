import { useId, useMemo } from 'react';
import LOGO_SVG from '../../assets/brand/penniq-logo.svg?raw';
import MONOGRAM_SVG from '../../assets/brand/penniq-monogram.svg?raw';

/*
 * The Penniq logo from the brand folder (Penniq_Logo_Tight_Transparent.pdf and
 * Penniq_Monogram_Tight_Transparent.pdf), converted path for path to SVG: never redraw it
 * or retype the name. The navy wordmark and tagline follow the text colour, so the logo
 * reads on every appearance; the coin, leaves and vine keep their own colours.
 */

/** Width ÷ height of each artwork's viewBox. */
const ratio = (svg: string) => {
  const [, , w, h] = svg
    .match(/viewBox="([^"]+)"/)![1]
    .split(' ')
    .map(Number);
  return w / h;
};
export const LOGO_RATIO = ratio(LOGO_SVG);
export const MONOGRAM_RATIO = ratio(MONOGRAM_SVG);
export { LOGO_SVG, MONOGRAM_SVG };

/** The artwork with its ids made unique to this copy, so several copies on one page never share gradients. */
function Art({ svg, height, color, className = '' }: { svg: string; height: number; color?: string; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const html = useMemo(
    () =>
      svg
        .replace(/id="(p[lm][gc]\d+)"/g, `id="$1${uid}"`)
        .replace(/url\(#(p[lm][gc]\d+)\)/g, `url(#$1${uid})`)
        .replace('<svg ', `<svg width="100%" height="100%" `),
    [svg, uid],
  );
  return (
    <span
      className={`inline-block shrink-0 ${className}`}
      style={{ height, width: height * ratio(svg), color: color ?? 'var(--ink)' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface LogoProps {
  /** 'mark' = the monogram alone, 'full' and 'stacked' = the logo with its tagline. */
  variant?: 'full' | 'mark' | 'stacked';
  /** Height in px of the monogram for 'mark' and of the logo row for 'full'; 'stacked' is drawn larger. */
  size: number;
  className?: string;
  /** Colour of the wordmark and tagline. Defaults to the ink colour. */
  color?: string;
  ink?: string;
}

/** The monogram: the P with the olive coin and leaves. */
export function Mark({ size, color, ink, className = '' }: { size: number; color?: string; ink?: string; className?: string }) {
  return <Art svg={MONOGRAM_SVG} height={size} color={color ?? ink} className={className} />;
}

export function Logo({ variant = 'full', size, className = '', color, ink }: LogoProps) {
  if (variant === 'mark') {
    return (
      <span role="img" aria-label="Penniq" className={`inline-flex ${className}`}>
        <Mark size={size} color={color} ink={ink} />
      </span>
    );
  }
  // The logo is wide and low: 'full' sits in a row of the given height, 'stacked' is the large lockup.
  const height = variant === 'stacked' ? size * 0.85 : size * 1.6;
  return (
    <span role="img" aria-label="Penniq" dir="ltr" className={`inline-flex ${className}`}>
      <Art svg={LOGO_SVG} height={height} color={color ?? ink} />
    </span>
  );
}
