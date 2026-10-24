import React from 'react';
import { Logo } from '../components/ui/Logo';

interface ScreenHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  /** Show the coin mark before the title (phones only — the rail shows it on desktop). */
  brand?: boolean;
  actions?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, brand = false, actions }: ScreenHeaderProps) {
  return (
    <header className="flex items-center gap-3 pt-2 pb-1">
      {brand && <Logo variant="mark" size={42} className="lg:hidden" />}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] leading-tight font-semibold tracking-tight lg:text-[28px]">{title}</h1>
        {subtitle && <p className="truncate text-[14px] text-ink-3">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}
