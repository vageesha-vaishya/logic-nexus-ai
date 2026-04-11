import React from 'react';
import { cn } from '@/lib/utils';
import { EnterpriseTable, Column, EnterpriseTableProps } from './enterprise/EnterpriseTable';

export interface DataGridProps<T extends Record<string, any>> extends Omit<EnterpriseTableProps<T>, 'className'> {
  variant?: 'default' | 'compact' | 'spacious';
  showHeader?: boolean;
  headerTitle?: string;
  headerActions?: React.ReactNode;
  className?: string;
}

/**
 * DataGrid Component
 * 
 * Standardized data grid with consistent text sizing and spacing.
 * Wraps EnterpriseTable with additional layout and header support.
 * 
 * Text Sizing Standards:
 * - Headers: 14px (text-sm) font-medium
 * - Body: 14px (text-sm) normal
 * - Pagination: 14px (text-sm) font-medium
 * - Empty/Loading: 14px (text-sm)
 * 
 * Usage:
 * <DataGrid
 *   columns={columns}
 *   data={data}
 *   headerTitle="All Records"
 *   headerActions={<Button>New</Button>}
 *   onRowClick={(row) => navigate(`/detail/${row.id}`)}
 * />
 */
export function DataGrid<T extends Record<string, any>>({
  columns,
  data,
  variant = 'default',
  showHeader = false,
  headerTitle,
  headerActions,
  className,
  ...tableProps
}: DataGridProps<T>) {
  const variantStyles = {
    default: 'p-6',
    compact: 'p-4',
    spacious: 'p-8',
  };

  return (
    <div className={cn(
      'border rounded-lg bg-card data-grid',
      'border-border',
      variantStyles[variant],
      className
    )}>
      {showHeader && (headerTitle || headerActions) && (
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
          {headerTitle && (
            <h3 className="heading-3">{headerTitle}</h3>
          )}
          {headerActions && (
            <div className="flex items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
      )}
      
      <EnterpriseTable
        columns={columns}
        data={data}
        className={cn('data-grid-root', className)}
        {...tableProps}
      />
    </div>
  );
}

// Re-export types for convenience
export type { Column } from './enterprise/EnterpriseTable';
