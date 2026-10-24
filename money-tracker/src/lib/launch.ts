/* Launch actions: the app can be opened straight into a form with "?do=expense", "?do=income" or
   "?do=transfer". The PWA's home-screen shortcuts (manifest.webmanifest → shortcuts) use this today.
   A real home-screen widget in a future Android build (a TWA or Capacitor shell) only needs to open the
   same addresses — or call openLaunchAction() through its bridge — so nothing in the app has to change. */

export type LaunchAction = 'expense' | 'income' | 'transfer';
const ACTIONS: LaunchAction[] = ['expense', 'income', 'transfer'];

/** Reads the action the app was opened with and removes it from the address, so a reload does not repeat it. */
export function takeLaunchAction(): LaunchAction | null {
  try {
    const url = new URL(window.location.href);
    const action = url.searchParams.get('do') as LaunchAction | null;
    if (!action || !ACTIONS.includes(action)) return null;
    url.searchParams.delete('do');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    return action;
  } catch {
    return null;
  }
}

type Listener = (action: LaunchAction) => void;
let listener: Listener | null = null;

/** The app registers how to open a form; a native shell can then trigger it without reloading. */
export function onLaunchAction(fn: Listener | null): void {
  listener = fn;
}

export function openLaunchAction(action: LaunchAction): void {
  listener?.(action);
}

if (typeof window !== 'undefined') {
  (window as Window & { penniqLaunch?: typeof openLaunchAction }).penniqLaunch = openLaunchAction;
}
