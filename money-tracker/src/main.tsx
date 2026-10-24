import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LanguageProvider } from './i18n/LanguageContext';
// The five typefaces of the brand guideline, bundled (no font CDN).
import '@fontsource-variable/manrope';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/playfair-display/wght-italic.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-300.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css';
import '@fontsource/amiri/arabic-400.css';
import '@fontsource/amiri/arabic-700.css';
import '@fontsource/dm-mono/latin-400.css';
import '@fontsource/dm-mono/latin-500.css';
import './index.css';
import { AuthProvider } from './state/AuthContext';
import { PlannerProvider } from './state/PlannerContext';
import { PrivacyProvider } from './state/PrivacyContext';
import { RemindersProvider } from './state/RemindersContext';
import { ToastProvider } from './state/ToastContext';
import { WalletProvider } from './state/WalletContext';
import { ThemeProvider } from './theme/ThemeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <PrivacyProvider>
            <AuthProvider>
              <PlannerProvider>
                <WalletProvider>
                  <ToastProvider>
                    <RemindersProvider>
                      <App />
                    </RemindersProvider>
                  </ToastProvider>
                </WalletProvider>
              </PlannerProvider>
            </AuthProvider>
          </PrivacyProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </LanguageProvider>
  </StrictMode>,
);

// Offline support: only in production builds and never inside an embedded frame.
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.self === window.top) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        const loaded = performance.getEntriesByType('resource').map((r) => r.name);
        reg.active?.postMessage({ type: 'precache', urls: [window.location.href.split('#')[0], ...loaded] });
      })
      .catch(() => {
        // Unsupported or blocked — the app simply stays online-only.
      });
  });
}
