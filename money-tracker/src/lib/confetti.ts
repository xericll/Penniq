import confetti from 'canvas-confetti';

const MILESTONES = [100, 500, 1000, 5000, 10000];

/** A small foil-coloured celebration when the total balance crosses a milestone upward. */
export function celebrateMilestone(previousTotal: number, nextTotal: number): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  if (!MILESTONES.some((m) => previousTotal < m && nextTotal >= m)) return;

  const css = getComputedStyle(document.documentElement);
  const colors = ['--foil-hi', '--foil', '--foil-lo', '--in'].map((v) => css.getPropertyValue(v).trim()).filter(Boolean);

  try {
    confetti({
      particleCount: 60,
      spread: 70,
      startVelocity: 32,
      origin: { y: 0.3 },
      colors,
      ticks: 200,
      gravity: 1.05,
      scalar: 0.8,
      shapes: ['circle'],
      disableForReducedMotion: true,
    });
  } catch {
    // canvas unavailable
  }
}

/** The same foil burst for a reached goal or a new level, a little fuller. */
export function celebrate(): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const css = getComputedStyle(document.documentElement);
  const colors = ['--coin-hi', '--coin', '--foil', '--in'].map((v) => css.getPropertyValue(v).trim()).filter(Boolean);
  try {
    confetti({
      particleCount: 90,
      spread: 85,
      startVelocity: 36,
      origin: { y: 0.35 },
      colors,
      ticks: 220,
      gravity: 1,
      scalar: 0.85,
      shapes: ['circle'],
      disableForReducedMotion: true,
    });
  } catch {
    // canvas unavailable
  }
}
