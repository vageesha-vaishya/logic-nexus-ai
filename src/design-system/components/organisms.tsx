import { forwardRef, useMemo } from 'react';
import type { HTMLAttributes } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { CRMButton, CRMBadge, CRMLink, type CRMVariant, type CRMViewport } from './atoms';
import { CRMSearchBar } from './molecules';

const viewportClassMap: Record<CRMViewport, string> = {
  mobile: 'text-xs',
  tablet: 'text-sm',
  desktop: 'text-base'
};

export interface CRMDataTableColumn {
  key: string;
  label: string;
}

export interface CRMDataTableProps extends HTMLAttributes<HTMLDivElement> {
  columns: CRMDataTableColumn[];
  rows: Record<string, string | number>[];
  variant?: CRMVariant;
  viewport?: CRMViewport;
}

export const CRMDataTable = forwardRef<HTMLDivElement, CRMDataTableProps>(
  ({ columns, rows, variant = 'primary', viewport = 'desktop', className, ...props }, ref) => (
    <div ref={ref} className={cn('overflow-x-auto rounded-md border', className)} {...props}>
      <table className={cn('w-full border-collapse', viewportClassMap[viewport])} aria-label="CRM data table">
        <thead>
          <tr className={cn(variant === 'primary' && 'bg-primary/10', variant === 'secondary' && 'bg-muted', variant === 'danger' && 'bg-destructive/10')}>
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-2 text-left font-semibold">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${String(row[columns[0]?.key] ?? rowIndex)}`} className="border-t">
              {columns.map((column) => (
                <td key={`${rowIndex}-${column.key}`} className="px-3 py-2">
                  {String(row[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
);

CRMDataTable.displayName = 'CRMDataTable';

export interface CRMModalProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  title: string;
  description?: string;
  variant?: CRMVariant;
  viewport?: CRMViewport;
  onOpenChange: (open: boolean) => void;
  onConfirm?: () => void;
}

export const CRMModal = forwardRef<HTMLDivElement, CRMModalProps>(
  ({ open, title, description, variant = 'primary', viewport = 'desktop', onOpenChange, onConfirm, children, ...props }, ref) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={ref as never}
        className={cn(viewportClassMap[viewport], variant === 'danger' && 'border-destructive/40')}
        onEscapeKeyDown={() => onOpenChange(false)}
        {...props}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <p className="text-muted-foreground">{description}</p> : null}
        </DialogHeader>
        <div>{children}</div>
        <DialogFooter>
          <CRMButton variant="secondary" onClick={() => onOpenChange(false)}>Cancel</CRMButton>
          <CRMButton variant={variant} onClick={onConfirm}>Confirm</CRMButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
);

CRMModal.displayName = 'CRMModal';

export interface CRMNavigationItem {
  id: string;
  label: string;
  href: string;
  badge?: string;
}

export interface CRMNavigationProps extends HTMLAttributes<HTMLElement> {
  items: CRMNavigationItem[];
  activeId?: string;
  variant?: CRMVariant;
  viewport?: CRMViewport;
}

export const CRMNavigation = forwardRef<HTMLElement, CRMNavigationProps>(
  ({ items, activeId, variant = 'primary', viewport = 'desktop', className, ...props }, ref) => (
    <nav
      ref={ref}
      aria-label="CRM navigation"
      className={cn('flex flex-wrap items-center gap-3 rounded-md border px-4 py-3', viewportClassMap[viewport], className)}
      {...props}
    >
      {items.map((item) => (
        <CRMLink
          key={item.id}
          href={item.href}
          variant={item.id === activeId ? variant : 'secondary'}
          viewport={viewport}
          aria-current={item.id === activeId ? 'page' : undefined}
        >
          {item.label}
          {item.badge ? <CRMBadge variant={variant}>{item.badge}</CRMBadge> : null}
        </CRMLink>
      ))}
    </nav>
  )
);

CRMNavigation.displayName = 'CRMNavigation';

export interface CRMFilterBarProps extends HTMLAttributes<HTMLDivElement> {
  query?: string;
  filters?: Array<{ label: string; value: string }>;
  variant?: CRMVariant;
  viewport?: CRMViewport;
  onQueryChange?: (value: string) => void;
  onApply?: () => void;
}

export const CRMFilterBar = forwardRef<HTMLDivElement, CRMFilterBarProps>(
  ({ query = '', filters = [], variant = 'primary', viewport = 'desktop', onQueryChange, onApply, className, ...props }, ref) => {
    const filterPills = useMemo(() => filters.slice(0, 4), [filters]);
    return (
      <div
        ref={ref}
        className={cn('flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center', viewportClassMap[viewport], className)}
        {...props}
      >
        <CRMSearchBar
          className="min-w-[220px] flex-1"
          value={query}
          variant={variant}
          viewport={viewport}
          onValueChange={onQueryChange}
          onSearch={onQueryChange}
        />
        <div className="flex flex-wrap items-center gap-2" aria-label="Applied filters">
          {filterPills.map((filter) => (
            <CRMBadge key={`${filter.label}-${filter.value}`} variant="secondary">
              {filter.label}: {filter.value}
            </CRMBadge>
          ))}
        </div>
        <CRMButton variant={variant} viewport={viewport} onClick={onApply}>
          Apply Filters
        </CRMButton>
      </div>
    );
  }
);

CRMFilterBar.displayName = 'CRMFilterBar';
