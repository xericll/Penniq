import { useMemo, type CSSProperties } from 'react';

/* ------------------------------------------------------------------------
   The Spark and the Flow — the two brand elements borrowed from the WebOra
   guideline (pages 34–35), nothing else from it. The Spark is its four-point
   star, path unchanged. The Flow is its ribbon of 20–40 hairline threads that
   fan out and pinch together; here it fans in from the note's left edge and
   pinches into the large spark, then trails off upwards.
   ------------------------------------------------------------------------ */

const SPARK = 'M0 -53C0 -11.66 7.67 0 51.13 0C7.67 0 0 11.66 0 53C0 11.66 -7.67 0 -51.13 0C-7.67 0 0 -11.66 0 -53Z';

export function Spark({ size = 16, className = '', style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="-52 -53 104 106" width={size} height={size} className={className} style={style} aria-hidden focusable="false">
      <path d={SPARK} fill="currentColor" />
    </svg>
  );
}

/** Where the ribbon pinches, in the 1000 × 500 box of the note: the large spark sits on it. */
export const FLOW_PINCH = { x: 465, y: 162 };

function threads(count: number): { body: string[]; tail: string[] } {
  const { x: px, y: py } = FLOW_PINCH;
  const body: string[] = [];
  const tail: string[] = [];
  for (let i = 0; i < count; i++) {
    const s = i / (count - 1) - 0.5;
    // Fanned wide at the left edge, a soft wave through the middle, all threads meeting at the spark.
    const y0 = 330 + s * 270;
    body.push(
      `M-10 ${y0.toFixed(1)}C${(170 + s * 30).toFixed(1)} ${(y0 - 150 + s * 70).toFixed(1)} ` +
        `${(310 - s * 20).toFixed(1)} ${(235 + s * 95).toFixed(1)} ${px} ${py}`,
    );
    // A short, faint tail that fans open again on its way up and out (every other thread).
    if (i % 2 === 0) {
      tail.push(
        `M${px} ${py}C${540} ${(140 + s * 30).toFixed(1)} ${600} ${(105 + s * 60).toFixed(1)} ${(680 + s * 20).toFixed(1)} ${(70 + s * 90).toFixed(1)}`,
      );
    }
  }
  return { body, tail };
}

/** The ribbon of hairlines; colour comes from `currentColor`. */
export function Flow({ className = '', count = 34 }: { className?: string; count?: number }) {
  const { body, tail } = useMemo(() => threads(count), [count]);
  return (
    <svg viewBox="0 0 1000 500" preserveAspectRatio="none" className={className} aria-hidden focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth={0.7} vectorEffect="non-scaling-stroke">
        {body.map((d, i) => (
          <path key={i} d={d} vectorEffect="non-scaling-stroke" opacity={0.42} />
        ))}
        {tail.map((d, i) => (
          <path key={`t${i}`} d={d} vectorEffect="non-scaling-stroke" opacity={0.16} />
        ))}
      </g>
    </svg>
  );
}
