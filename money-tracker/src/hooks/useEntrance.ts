import { useEffect, useState } from 'react';

let played = false;

/**
 * True only for the first time Home appears in a session: its staggered entrance plays once,
 * and coming back to the tab later shows everything at once instead of fading it in again.
 */
export function useEntrance(): boolean {
  const [first] = useState(() => !played);
  useEffect(() => {
    played = true;
  }, []);
  return first;
}
