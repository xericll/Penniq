import React from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { Logo } from './ui/Logo';

interface State {
  failed: boolean;
}

/** Catches render errors so a bug shows a calm recovery screen instead of a blank page. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Penniq crashed:', error);
  }

  render() {
    return this.state.failed ? <CrashScreen /> : this.props.children;
  }
}

function CrashScreen() {
  const { t } = useI18n();
  return (
    <div role="alert" className="grid min-h-dvh place-items-center bg-bg p-6 text-center text-ink">
      <div className="max-w-sm">
        <Logo variant="mark" size={38} className="mx-auto" />
        <h1 className="mt-5 text-[20px] font-semibold">{t('crash.title')}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t('crash.body')}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="foil press mt-6 min-h-12 rounded-2xl px-6 text-[15px] font-semibold"
        >
          {t('crash.reload')}
        </button>
      </div>
    </div>
  );
}
