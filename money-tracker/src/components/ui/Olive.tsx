import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

/* ------------------------------------------------------------------------
   Olive branches: two-tone lanceolate leaves (dark face, silvery underside)
   along a curved stem, with the odd olive. Generated from a seed, so every
   branch looks the same on every render. Colours come from --leaf-* tokens.
   ------------------------------------------------------------------------ */

type Pt = [number, number];

interface BranchSpec {
  box: [number, number];
  stem: [Pt, Pt, Pt, Pt];
  leaves: number;
  length: number;
  olives: number[];
  seed: number;
}

const BRANCHES = {
  /** Enters from the start edge above the greeting and lays its tip over the balance card. */
  hero: {
    box: [210, 150],
    stem: [
      [-14, 18],
      [40, 10],
      [96, 60],
      [196, 116],
    ],
    leaves: 11,
    length: 40,
    olives: [0.52],
    seed: 7,
  },
  /** A sprig tucked behind cards in a lower corner. */
  corner: {
    box: [150, 120],
    stem: [
      [156, 104],
      [120, 98],
      [70, 70],
      [8, 20],
    ],
    leaves: 8,
    length: 34,
    olives: [],
    seed: 19,
  },
  /** A small sprig beside a screen title. */
  title: {
    box: [170, 110],
    stem: [
      [-14, 30],
      [40, 20],
      [90, 54],
      [162, 88],
    ],
    leaves: 9,
    length: 32,
    olives: [0.6],
    seed: 31,
  },
} satisfies Record<string, BranchSpec>;

export type BranchKind = keyof typeof BRANCHES;

function bezier(p: BranchSpec['stem'], t: number): Pt {
  const u = 1 - t;
  return [
    u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
  ];
}

function tangent(p: BranchSpec['stem'], t: number): number {
  const u = 1 - t;
  const dx = 3 * u * u * (p[1][0] - p[0][0]) + 6 * u * t * (p[2][0] - p[1][0]) + 3 * t * t * (p[3][0] - p[2][0]);
  const dy = 3 * u * u * (p[1][1] - p[0][1]) + 6 * u * t * (p[2][1] - p[1][1]) + 3 * t * t * (p[3][1] - p[2][1]);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface Leaf {
  x: number;
  y: number;
  angle: number;
  length: number;
  width: number;
  flip: boolean;
  motion: CSSProperties;
}

function layout(spec: BranchSpec) {
  const rnd = random(spec.seed);
  const leaves: Leaf[] = [];
  for (let i = 0; i < spec.leaves; i++) {
    const t = 0.1 + i * (0.86 / (spec.leaves - 1));
    const [x, y] = bezier(spec.stem, t);
    const side = i % 2 ? 1 : -1;
    const length = spec.length * (0.82 + rnd() * 0.3) * (t > 0.85 ? 0.8 : 1);
    leaves.push({
      x,
      y,
      angle: tangent(spec.stem, t) + side * (34 + rnd() * 18),
      length,
      width: length * (0.17 + rnd() * 0.04),
      flip: side > 0,
      motion: {
        '--fd': `${(3.4 + rnd() * 2.6).toFixed(2)}s`,
        '--fdl': `${(-rnd() * 4).toFixed(2)}s`,
        '--f0': `${(-2 - rnd() * 3).toFixed(1)}deg`,
        '--f1': `${(2 + rnd() * 4).toFixed(1)}deg`,
        '--g': i,
      } as CSSProperties,
    });
  }
  const [x, y] = spec.stem[3];
  leaves.push({
    x,
    y,
    angle: tangent(spec.stem, 1),
    length: spec.length * 0.75,
    width: spec.length * 0.13,
    flip: false,
    motion: { '--fd': '4.2s', '--g': spec.leaves } as CSSProperties,
  });
  return leaves;
}

function LeafShape({ length: L, width: W, face, under }: { length: number; width: number; face: string; under: string }) {
  const upper = `M0 0C${L * 0.18} ${-W * 1.15} ${L * 0.62} ${-W * 1.05} ${L} 0Q${L * 0.5} ${W * 0.08} 0 0Z`;
  const lower = `M0 0C${L * 0.18} ${W * 1.1} ${L * 0.62} ${W * 0.95} ${L} 0Q${L * 0.5} ${W * 0.08} 0 0Z`;
  let veins = '';
  for (let v = 1; v <= 4; v++) {
    const x = (L * v) / 5.4;
    veins += `M${x.toFixed(1)} ${(W * 0.04).toFixed(1)}q${(L * 0.07).toFixed(1)} ${(-W * 0.35).toFixed(1)} ${(L * 0.14).toFixed(1)} ${(-W * 0.62).toFixed(1)}`;
  }
  return (
    <>
      <path d={upper} fill={`url(#${face})`} />
      <path d={lower} fill={`url(#${under})`} />
      <path d={`M1 0Q${L * 0.5} ${W * 0.08} ${L - 1} 0`} fill="none" stroke="rgb(255 255 235 / .4)" strokeWidth={0.7} />
      <path d={veins} fill="none" stroke="rgb(255 255 235 / .14)" strokeWidth={0.5} />
    </>
  );
}

interface OliveBranchProps {
  kind: BranchKind;
  className?: string;
  style?: CSSProperties;
  /** Mirror for left-to-right layouts, so the branch still enters from the start edge. */
  mirror?: boolean;
}

export function OliveBranch({ kind, className = '', style, mirror = false }: OliveBranchProps) {
  const spec: BranchSpec = BRANCHES[kind];
  const uid = `ol${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const leaves = useMemo(() => layout(spec), [spec]);
  const [w, h] = spec.box;
  const p = spec.stem;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`olive-branch ${className}`}
      style={{ ...style, transform: mirror ? 'scaleX(-1)' : undefined }}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--leaf-a)' }} />
          <stop offset="1" style={{ stopColor: 'var(--leaf-b)' }} />
        </linearGradient>
        <linearGradient id={`${uid}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--leaf-c)' }} />
          <stop offset="1" style={{ stopColor: 'var(--leaf-d)' }} />
        </linearGradient>
        <radialGradient id={`${uid}o`} cx=".35" cy=".3" r=".75">
          <stop offset="0" stopColor="#8d8a5c" />
          <stop offset=".5" stopColor="#4a4a2c" />
          <stop offset="1" stopColor="#26261a" />
        </radialGradient>
      </defs>
      <g className="sway">
        <path
          d={`M${p[0]}C${p[1]} ${p[2]} ${p[3]}`}
          fill="none"
          style={{ stroke: 'var(--stem)' }}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        {leaves.map((l, i) => (
          <g key={i} transform={`translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) rotate(${l.angle.toFixed(1)})`}>
            <g className="grow" style={l.motion}>
              <g className="lf" style={l.motion}>
                <LeafShape length={l.length} width={l.width} face={l.flip ? `${uid}b` : `${uid}a`} under={l.flip ? `${uid}a` : `${uid}b`} />
              </g>
            </g>
          </g>
        ))}
        {spec.olives.map((t, k) => {
          const [x, y] = bezier(p, t);
          return (
            <g key={`o${k}`} className="grow" style={{ '--g': spec.leaves + 1 + k } as CSSProperties}>
              <path d={`M${x.toFixed(1)} ${y.toFixed(1)}q2 8 -1 14`} style={{ stroke: 'var(--stem)' }} strokeWidth={1} fill="none" />
              <ellipse
                cx={x - 1.5}
                cy={y + 20}
                rx={5}
                ry={6.6}
                fill={`url(#${uid}o)`}
                transform={`rotate(-14 ${(x - 1.5).toFixed(1)} ${(y + 20).toFixed(1)})`}
              />
              <ellipse cx={x - 3} cy={y + 17.5} rx={1.4} ry={2} fill="rgb(255 255 230 / .35)" />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------------
   Olive garland: a fine stem runs round a card 10px inside its edge, with
   pairs of tiny leaves along it and a coin covering the seam. Re-laid out
   whenever the card changes size, so it always follows the edge.
   ------------------------------------------------------------------------ */

const TINY_LEAF = 'M0 0C1.5-1.8 4.7-2 6.6 0C4.7 2 1.5 1.8 0 0Z';

type Segment =
  | { kind: 'line'; x: number; y: number; dir: number; len: number }
  | { kind: 'arc'; cx: number; cy: number; from: number; r: number; len: number };

function roundedFrame(w: number, h: number, inset: number, r: number) {
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  const q = (Math.PI * r) / 2;
  // Clockwise from the middle of the bottom edge, so the seam sits under the coin.
  const segments: Segment[] = [
    { kind: 'line', x: w / 2, y: y1, dir: 180, len: w / 2 - x0 - r },
    { kind: 'arc', cx: x0 + r, cy: y1 - r, from: 90, r, len: q },
    { kind: 'line', x: x0, y: y1 - r, dir: 270, len: y1 - y0 - 2 * r },
    { kind: 'arc', cx: x0 + r, cy: y0 + r, from: 180, r, len: q },
    { kind: 'line', x: x0 + r, y: y0, dir: 0, len: x1 - x0 - 2 * r },
    { kind: 'arc', cx: x1 - r, cy: y0 + r, from: 270, r, len: q },
    { kind: 'line', x: x1, y: y0 + r, dir: 90, len: y1 - y0 - 2 * r },
    { kind: 'arc', cx: x1 - r, cy: y1 - r, from: 0, r, len: q },
    { kind: 'line', x: x1 - r, y: y1, dir: 180, len: w / 2 - x0 - r },
  ];
  const total = segments.reduce((s, g) => s + g.len, 0);
  const at = (s: number): { x: number; y: number; angle: number } => {
    let rest = s;
    for (const g of segments) {
      if (rest <= g.len) {
        if (g.kind === 'line') {
          const a = (g.dir * Math.PI) / 180;
          return { x: g.x + Math.cos(a) * rest, y: g.y + Math.sin(a) * rest, angle: g.dir };
        }
        const deg = g.from + (rest / g.len) * 90;
        const a = (deg * Math.PI) / 180;
        return { x: g.cx + g.r * Math.cos(a), y: g.cy + g.r * Math.sin(a), angle: deg + 90 };
      }
      rest -= g.len;
    }
    return { x: w / 2, y: y1, angle: 180 };
  };
  const d = `M${w / 2} ${y1}H${x0 + r}A${r} ${r} 0 0 1 ${x0} ${y1 - r}V${y0 + r}A${r} ${r} 0 0 1 ${x0 + r} ${y0}H${x1 - r}A${r} ${r} 0 0 1 ${x1} ${y0 + r}V${y1 - r}A${r} ${r} 0 0 1 ${x1 - r} ${y1}Z`;
  return { d, total, at, y0, y1 };
}

export function Garland({ className = '', inset = 10, radius = 16 }: { className?: string; inset?: number; radius?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const update = () =>
      setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const art = useMemo(() => {
    const { w, h } = size;
    if (w < 60 || h < 60) return null;
    const frame = roundedFrame(w, h, inset, radius);
    const n = Math.round(frame.total / 7.4);
    const step = frame.total / n;
    const leaves: string[] = [];
    for (let i = 1; i < n; i++) {
      const s = i * step;
      if (s < 9 || s > frame.total - 9) continue;
      const p = frame.at(s);
      const pos = `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`;
      leaves.push(`${pos} rotate(${(p.angle - 36).toFixed(1)})`, `${pos} rotate(${(p.angle + 36).toFixed(1)})`);
    }
    return { frame, leaves };
  }, [size, inset, radius]);

  return (
    <svg
      ref={ref}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      viewBox={size.w ? `0 0 ${size.w} ${size.h}` : undefined}
      aria-hidden
      focusable="false"
    >
      {art && (
        <>
          <path d={art.frame.d} fill="none" stroke="currentColor" strokeWidth={0.6} opacity={0.8} />
          <g fill="currentColor">
            {art.leaves.map((tf, i) => (
              <path key={i} d={TINY_LEAF} transform={tf} opacity={i % 2 ? 0.75 : 1} />
            ))}
          </g>
          <circle cx={size.w / 2} cy={art.frame.y1} r={3.2} fill="currentColor" />
          <circle cx={size.w / 2} cy={art.frame.y0} r={2.2} fill="currentColor" />
        </>
      )}
    </svg>
  );
}
