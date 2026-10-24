import confetti from 'canvas-confetti';

const MILESTONES = [100, 500, 1000, 5000, 10000];

/** A small accent-coloured celebration when the total balance crosses a milestone upward. */
export function celebrateMilestone(previousTotal: number, nextTotal: number): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  if (!MILESTONES.some((m) => previousTotal < m && nextTotal >= m)) return;

  const css = getComputedStyle(document.documentElement);
  const colors = ['--accent-hi', '--accent', '--accent-lo', '--in', '--cash'].map((v) => css.getPropertyValue(v).trim()).filter(Boolean);

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
