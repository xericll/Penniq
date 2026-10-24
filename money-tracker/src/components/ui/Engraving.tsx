import { useMemo } from 'react';

/* ------------------------------------------------------------------------
   Guilloché rosette — the engraved line-work printed on banknotes.
   Two families of phase-shifted sinusoidal rings weave a moiré, with an
   epitrochoid star at the centre. Generated once per size and cached.
   ------------------------------------------------------------------------ */

const cache = new Map<string, string[]>();

function ring(cx: number, cy: number, base: number, amp: number, petals: number, phase: number, steps: number): string {
  let d = '';
  for (let j = 0; j <= steps; j++) {
    const a = (j / steps) * Math.PI * 2;
    const r = base + amp * Math.sin(petals * a + phase);
    d += `${j ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return `${d}Z`;
}

function epitrochoid(cx: number, cy: number, R: number, r: number, dist: number, rot: number, steps: number): string {
  let d = '';
  const k = (R + r) / r;
  for (let j = 0; j <= steps; j++) {
    const t = (j / steps) * Math.PI * 2;
    const x = (R + r) * Math.cos(t) - dist * Math.cos(k * t);
    const y = (R + r) * Math.sin(t) - dist * Math.sin(k * t);
    const xr = x * Math.cos(rot) - y * Math.sin(rot);
    const yr = x * Math.sin(rot) + y * Math.cos(rot);
    d += `${j ? 'L' : 'M'}${(cx + xr).toFixed(1)} ${(cy + yr).toFixed(1)}`;
  }
  return `${d}Z`;
}

export function rosette(density: 'full' | 'light' = 'full'): string[] {
  const key = density;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = 200;
  const paths: string[] = [];
  const full = density === 'full';
  // Outer woven band: rings nudged a quarter-petal each, which braids them.
  const bands = full ? 16 : 9;
  for (let i = 0; i < bands; i++) {
    paths.push(ring(c, c, 120 + i * (full ? 4.2 : 7.4), 10, 30, (i * Math.PI) / 120, 520));
  }
  // Star medallion.
  for (let i = 0; i < (full ? 10 : 5); i++) {
    paths.push(ring(c, c, 72, 20, 12, (i * Math.PI) / 60, 360));
  }
  // Epitrochoid core.
  for (let i = 0; i < (full ? 6 : 3); i++) {
    paths.push(epitrochoid(c, c, 24, 4, 9, (i * Math.PI) / 18, 300));
  }
  cache.set(key, paths);
  return paths;
}

interface GuillocheProps {
  className?: string;
  strokeWidth?: number;
  density?: 'full' | 'light';
  spin?: boolean;
}

export function Guilloche({ className = '', strokeWidth = 0.6, density = 'full', spin = false }: GuillocheProps) {
  const paths = useMemo(() => rosette(density), [density]);
  return (
    <svg viewBox="0 0 400 400" className={`${className} ${spin ? 'spin-slow' : ''}`} aria-hidden focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke">
        {paths.map((d, i) => (
          <path key={i} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  );
}
