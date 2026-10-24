type HapticKind = 'tap' | 'select' | 'money' | 'success' | 'warning';

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  select: 10,
  money: 15,
  success: [12, 40, 18],
  warning: [30, 50, 30],
};

export function haptic(kind: HapticKind = 'tap'): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(PATTERNS[kind]);
  } catch {
    // unsupported — silently ignore
  }
}
