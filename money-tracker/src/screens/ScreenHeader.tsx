import React from 'react';
import { Logo } from '../components/ui/Logo';
import { OliveBranch } from '../components/ui/Olive';

interface ScreenHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  /** Show the coin mark before the title (phones only — the rail shows it on desktop). */
  brand?: boolean;
  actions?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, brand = false, actions }: ScreenHeaderProps) {
  return (
    <header className="relative flex items-center gap-3 pt-2 pb-1">
      {/* A small olive sprig at the far edge, opposite the title. */}
      <OliveBranch kind="title" className="absolute -end-4 -top-2 -z-10 w-[132px] sm:-end-6 lg:hidden ltr:scale-x-[-1]" />
      {brand && <Logo variant="mark" size={26} className="lg:hidden" />}
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-[30px] leading-tight font-bold lg:text-[36px]">{title}</h1>
        {subtitle && <p className="truncate text-[14px] text-ink-3">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}
