import { useLayoutEffect, useMemo, useRef, useState } from 'react';

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
    <svg viewBox="0 0 400 400" className={className} aria-hidden focusable="false">
      <g
        className={spin ? 'spin-slow' : undefined}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
      >
        {paths.map((d, i) => (
          <path key={i} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------------
   Micro-text border — a line of tiny repeating type running around the
   note, like the security printing inside a banknote's frame.
   ------------------------------------------------------------------------ */

interface MicroBorderProps {
  radius: number;
  inset?: number;
  text?: string;
  className?: string;
}

export function MicroBorder({ radius, inset = 9, text = 'PENNIQ ✦ كل قرش بحسابه ✦ ', className = '' }: MicroBorderProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pathId = useMemo(() => `mb-${Math.random().toString(36).slice(2, 8)}`, []);

  useLayoutEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  const r = Math.max(4, radius - inset);
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  // Starts at the bottom centre and runs clockwise, so the seam is out of the way.
  const d =
    w && h
      ? `M${w / 2} ${y1} H${x0 + r} A${r} ${r} 0 0 1 ${x0} ${y1 - r} V${y0 + r} A${r} ${r} 0 0 1 ${x0 + r} ${y0} H${x1 - r} A${r} ${r} 0 0 1 ${x1} ${y0 + r} V${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1} Z`
      : '';

  return (
    <svg ref={ref} className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden focusable="false">
      {d && (
        <>
          <defs>
            <path id={pathId} d={d} />
          </defs>
          <text
            direction="ltr"
            fill="currentColor"
            fontSize="6.2"
            letterSpacing="1.4"
            fontFamily="JetBrains Mono, monospace"
            dominantBaseline="middle"
          >
            <textPath href={`#${pathId}`}>{text.repeat(60)}</textPath>
          </text>
        </>
      )}
    </svg>
  );
}
