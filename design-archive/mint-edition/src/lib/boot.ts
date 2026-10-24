/** Whether the launch splash plays on this page load (once per browser session). */
export const SPLASH_ON_LOAD: boolean = (() => {
  try {
    return !sessionStorage.getItem('qirsh_splash_seen');
  } catch {
    return true;
  }
})();

export const SPLASH_MS = 1250;

/** Shown in Settings and sent along with support messages. */
export const APP_VERSION = '2.1';
