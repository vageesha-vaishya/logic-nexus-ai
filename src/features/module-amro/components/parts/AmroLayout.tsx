import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Master Layout Component
 * Implements consistent alignment system with CSS Grid
 * 
 * Margins:
 * - Mobile (<768px): 16px
 * - Tablet (768px-1023px): 24px
 * - Desktop (≥1024px): 24px
 * 
 * Grid: 12-column system
 * Spacing: 8px grid system
 */

export interface AmroPageLayoutProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function AmroPageLayout({
  children,
  header,
  footer,
  className,
  maxWidth = 'xl',
}: AmroPageLayoutProps): JSX.Element {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full',
  };

  return (
    <div className={cn(
      'min-h-screen bg-background',
      // Consistent margins: 16px mobile, 24px desktop
      'p-4 md:p-6',
      className,
    )}>
      <div className={cn('mx-auto', maxWidthClasses[maxWidth])}>
        {/* Page Header */}
        {header && (
          <header className="mb-6">
            {header}
          </header>
        )}
        
        {/* Main Content */}
        <main className="space-y-6">
          {children}
        </main>
        
        {/* Page Footer */}
        {footer && (
          <footer className="mt-6">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/**
 * Section Layout Component
 * Creates consistent section spacing with 20-30% increased white space
 */

export interface AmroSectionProps {
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
  className?: string;
  variant?: 'default' | 'compact' | 'spacious';
}

export function AmroSection({
  children,
  title,
  actions,
  className,
  variant = 'default',
}: AmroSectionProps): JSX.Element {
  const paddingClasses = {
    compact: 'p-4',
    default: 'p-6',  // 24px - Increased from standard 16px
    spacious: 'p-8', // 32px - 30% more white space
  };

  return (
    <section className={cn(
      'rounded border bg-card',
      // Increased padding for better white space (20-30% more)
      paddingClasses[variant],
      className,
    )}>
      {/* Section Header */}
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between">
          {title && (
            <h2 className="text-xl font-semibold leading-tight">{title}</h2>
          )}
          {actions && (
            <div className="flex items-center gap-4">
              {/* Minimum 16px gap between actions */}
              {actions}
            </div>
          )}
        </div>
      )}
      
      {/* Section Content */}
      <div className={cn(title || actions ? '' : '')}>
        {children}
      </div>
    </section>
  );
}

/**
 * Card Component with Consistent Spacing
 */

export interface AmroCardProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  variant?: 'default' | 'compact' | 'interactive';
}

export function AmroCard({
  children,
  header,
  footer,
  className,
  variant = 'default',
}: AmroCardProps): JSX.Element {
  const variantClasses = {
    default: 'border bg-card shadow-sm',
    compact: 'border bg-card',
    interactive: 'cursor-pointer border bg-card shadow-sm transition hover:shadow-md hover:border-primary/50',
  };

  return (
    <div className={cn(
      'rounded-lg',
      variantClasses[variant],
      className,
    )}>
      {/* Card Header */}
      {header && (
        <div className="border-b px-6 py-4">
          {header}
        </div>
      )}
      
      {/* Card Body */}
      <div className={cn(
        'px-6 py-4',
        !header && 'pt-6',
        !footer && 'pb-6',
      )}>
        {children}
      </div>
      
      {/* Card Footer */}
      {footer && (
        <div className="border-t px-6 py-4">
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * Toolbar Component with Consistent Spacing
 */

export interface AmroToolbarProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'compact';
}

export function AmroToolbar({
  children,
  className,
  variant = 'default',
}: AmroToolbarProps): JSX.Element {
  const paddingClasses = {
    compact: 'px-3 py-2',
    default: 'px-4 py-3',
  };

  return (
    <div className={cn(
      'flex flex-wrap items-center justify-between gap-4 rounded border bg-muted/20',
      // Consistent spacing with 8px grid
      paddingClasses[variant],
      className,
    )}>
      {children}
    </div>
  );
}

/**
 * Responsive Grid Component
 * 12-column grid system with defined breakpoints
 */

export interface AmroGridProps {
  children: ReactNode;
  columns?: {
    mobile?: 1 | 2 | 3 | 4;
    tablet?: 1 | 2 | 3 | 4 | 6;
    desktop?: 1 | 2 | 3 | 4 | 6 | 12;
  };
  gap?: 2 | 3 | 4 | 6 | 8;
  className?: string;
}

export function AmroGrid({
  children,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 4,
  className,
}: AmroGridProps): JSX.Element {
  const mobileCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };

  const tabletCols = {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-4',
    6: 'sm:grid-cols-6',
  };

  const desktopCols = {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
    6: 'md:grid-cols-6',
    12: 'md:grid-cols-12',
  };

  const gaps = {
    2: 'gap-2',  // 8px
    3: 'gap-3',  // 12px
    4: 'gap-4',  // 16px
    6: 'gap-6',  // 24px
    8: 'gap-8',  // 32px
  };

  return (
    <div className={cn(
      'grid',
      mobileCols[columns.mobile || 1],
      tabletCols[columns.tablet || 2],
      desktopCols[columns.desktop || 3],
      gaps[gap],
      className,
    )}>
      {children}
    </div>
  );
}
