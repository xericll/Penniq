/** Whether the launch splash plays on this page load (once per browser session). */
export const SPLASH_ON_LOAD: boolean = (() => {
  try {
    return !sessionStorage.getItem('qirsh_splash_seen');
  } catch {
    return true;
  }
})();

// Long enough for the coin to land and the name to be unveiled; a tap skips it.
export const SPLASH_MS = 2200;

/** Shown in Settings and sent along with support messages. */
export const APP_VERSION = '3.0';
