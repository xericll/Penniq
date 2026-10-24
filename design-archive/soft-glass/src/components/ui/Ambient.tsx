import { useEffect, useMemo } from 'react';

/** A sprig of leaves, drawn once: the soft shadow a plant casts through a window. */
function leafPaths(): string[] {
  const paths: string[] = [];
  // Stem: a gentle curve from the corner inwards.
  paths.push('M-10 -10 C 60 60, 120 150, 250 300');
  const leaves = [
    [30, 34, -30],
    [62, 70, 40],
    [84, 102, -20],
    [118, 138, 55],
    [140, 170, -5],
    [176, 208, 60],
    [196, 238, 10],
    [230, 276, 70],
  ];
  for (const [x, y, rot] of leaves) {
    const r = (rot * Math.PI) / 180;
    const len = 58;
    const w = 20;
    const tipX = x + Math.cos(r) * len;
    const tipY = y + Math.sin(r) * len;
    const nx = -Math.sin(r) * w;
    const ny = Math.cos(r) * w;
    const mx = (x + tipX) / 2;
    const my = (y + tipY) / 2;
    paths.push(`M${x} ${y} Q ${mx + nx} ${my + ny} ${tipX} ${tipY} Q ${mx - nx} ${my - ny} ${x} ${y} Z`);
  }
  return paths;
}

/**
 * The canvas behind every screen: drifting light, window stripes and a leaf shadow,
 * plus the SVG lens filter used for liquid-glass refraction and the press-light tracker.
 */
export function Ambient() {
  const leaves = useMemo(leafPaths, []);

  useEffect(() => {
    // Refraction through backdrop-filter: url() only renders in Chromium.
    const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands ?? [];
    const chromium = brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand));
    if (chromium && CSS.supports?.('backdrop-filter', 'url(#lg-lens)')) {
      document.documentElement.classList.add('lg-refract');
    }

    // Let every .press element light up exactly where it was touched.
    const onDown = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('.press') as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--px', `${e.clientX - r.left}px`);
      el.style.setProperty('--py', `${e.clientY - r.top}px`);
    };
    document.addEventListener('pointerdown', onDown, { passive: true });
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Drifting pools of light */}
        <div
          className="absolute -top-[18%] -start-[12%] size-[70vmax] rounded-full opacity-80 blur-[70px] will-change-transform"
          style={{
            background: 'radial-gradient(circle, var(--blob-1) 0%, transparent 62%)',
            animation: 'drift-a 32s ease-in-out infinite',
          }}
        />
        <div
          className="absolute top-[22%] -end-[20%] size-[60vmax] rounded-full opacity-75 blur-[70px] will-change-transform"
          style={{
            background: 'radial-gradient(circle, var(--blob-2) 0%, transparent 62%)',
            animation: 'drift-b 38s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -bottom-[25%] start-[10%] size-[65vmax] rounded-full opacity-70 blur-[80px] will-change-transform"
          style={{
            background: 'radial-gradient(circle, var(--blob-3) 0%, transparent 60%)',
            animation: 'drift-b 44s ease-in-out infinite reverse',
          }}
        />
        <div
          className="absolute top-[45%] start-[35%] size-[40vmax] rounded-full opacity-60 blur-[70px] will-change-transform"
          style={{
            background: 'radial-gradient(circle, var(--blob-4) 0%, transparent 62%)',
            animation: 'drift-a 36s ease-in-out infinite reverse',
          }}
        />

        {/* Daylight through window blinds */}
        <div
          className="absolute -top-[10%] end-[-10%] h-[90vh] w-[80vw] rotate-[8deg] blur-[26px]"
          style={{
            background: 'repeating-linear-gradient(100deg, var(--window) 0 70px, transparent 70px 170px)',
            maskImage: 'radial-gradient(ellipse at 70% 30%, #000 0%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 70% 30%, #000 0%, transparent 70%)',
          }}
        />

        {/* A leaf shadow swaying in the corner */}
        <svg
          viewBox="-20 -20 320 340"
          className="absolute -top-6 -start-6 w-[min(62vw,380px)] blur-[5px]"
          style={{ animation: 'sway 11s ease-in-out infinite', transformOrigin: '0 0' }}
        >
          <g fill="var(--leaf)" stroke="var(--leaf)" strokeWidth="3" strokeLinecap="round">
            {leaves.map((d, i) => (
              <path key={i} d={d} fill={i === 0 ? 'none' : undefined} />
            ))}
          </g>
        </svg>

        {/* Fine grain, so blur reads as real frosted glass */}
        <div
          className="absolute inset-0 opacity-[0.045] mix-blend-multiply"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      {/* Liquid-glass lens: gently warps whatever sits behind .lens surfaces */}
      <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
        <filter id="lg-lens" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.017" numOctaves="2" seed="4" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2.5" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="34" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
    </>
  );
}
