import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './i18n/LanguageContext';
import './index.css';
import { PrivacyProvider } from './state/PrivacyContext';
import { ToastProvider } from './state/ToastContext';
import { WalletProvider } from './state/WalletContext';
import { ThemeProvider } from './theme/ThemeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <PrivacyProvider>
          <WalletProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </WalletProvider>
        </PrivacyProvider>
      </ThemeProvider>
    </LanguageProvider>
  </StrictMode>,
);
