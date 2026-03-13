import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CRMButton, type CRMVariant, type CRMViewport } from './atoms';
import { CRMNavigation, type CRMNavigationItem } from './organisms';

const viewportClassMap: Record<CRMViewport, string> = {
  mobile: 'p-3',
  tablet: 'p-4',
  desktop: 'p-6'
};

export interface CRMPageShellProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  navigationItems?: CRMNavigationItem[];
  activeNavId?: string;
  actions?: ReactNode;
  variant?: CRMVariant;
  viewport?: CRMViewport;
}

export const CRMPageShell = forwardRef<HTMLDivElement, CRMPageShellProps>(
  (
    {
      title,
      subtitle,
      navigationItems = [],
      activeNavId,
      actions,
      variant = 'primary',
      viewport = 'desktop',
      className,
      children,
      ...props
    },
    ref
  ) => (
    <section ref={ref} className={cn('space-y-4 bg-background', viewportClassMap[viewport], className)} {...props}>
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </header>
      {navigationItems.length > 0 ? (
        <CRMNavigation items={navigationItems} activeId={activeNavId} variant={variant} viewport={viewport} />
      ) : null}
      <main>{children}</main>
    </section>
  )
);

CRMPageShell.displayName = 'CRMPageShell';

export interface CRMCRUDLayoutProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  onCreate?: () => void;
  onRefresh?: () => void;
  filters?: ReactNode;
  table: ReactNode;
  detailPanel?: ReactNode;
  variant?: CRMVariant;
  viewport?: CRMViewport;
}

export const CRMCRUDLayout = forwardRef<HTMLDivElement, CRMCRUDLayoutProps>(
  (
    {
      title,
      onCreate,
      onRefresh,
      filters,
      table,
      detailPanel,
      variant = 'primary',
      viewport = 'desktop',
      className,
      ...props
    },
    ref
  ) => (
    <div ref={ref} className={cn('space-y-4', viewportClassMap[viewport], className)} {...props}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          <CRMButton variant="secondary" viewport={viewport} onClick={onRefresh}>Refresh</CRMButton>
          <CRMButton variant={variant} viewport={viewport} onClick={onCreate}>New</CRMButton>
        </div>
      </div>
      {filters}
      <div className={cn('grid gap-4', detailPanel ? 'grid-cols-1 xl:grid-cols-[2fr_1fr]' : 'grid-cols-1')}>
        <div>{table}</div>
        {detailPanel ? <aside>{detailPanel}</aside> : null}
      </div>
    </div>
  )
);

CRMCRUDLayout.displayName = 'CRMCRUDLayout';
