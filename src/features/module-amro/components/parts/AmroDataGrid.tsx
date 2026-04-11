import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Standardized Data Grid Component
 * Implements consistent text sizing for headers, body, and pagination
 * WCAG 2.1 AA Compliant
 * 
 * Text Size Specifications:
 * - Headers: 12px (0.75rem) / 600 weight / uppercase / tracking-wide
 * - Body: 14px (0.875rem) / 400 weight / normal
 * - Pagination: 14px (0.875rem) / 500 weight
 * - Empty State: 14px (0.875rem) / 400 weight / muted
 */

export interface AmroDataGridColumn {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (row: Record<string, unknown>) => ReactNode;
}

export interface AmroDataGridProps {
  columns: AmroDataGridColumn[];
  rows: Record<string, unknown>[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (row: Record<string, unknown>) => void;
}

export function AmroDataGrid({
  columns,
  rows,
  loading = false,
  emptyMessage = 'No records found.',
  className,
  onRowClick,
}: AmroDataGridProps): JSX.Element {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        {/* Standardized empty state text size: 14px */}
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full">
        {/* Table Header - Standardized: 12px / 600 / uppercase */}
        <thead className="border-b bg-muted/50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'px-4 py-3 text-left',
                  // Standardized header text: 12px / 600 / uppercase / tracking
                  'text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                  column.align === 'center' && 'text-center',
                  column.align === 'right' && 'text-right',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        
        {/* Table Body - Standardized: 14px / 400 */}
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={cn(
                'border-b last:border-0',
                onRowClick && 'cursor-pointer hover:bg-muted/50',
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-4 py-3',
                    // Standardized body text: 14px / 400
                    'text-sm text-foreground',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right tabular-nums',
                  )}
                >
                  {column.render
                    ? column.render(row)
                    : String(row[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Standardized Pagination Component
 * Text size: 14px / 500 weight
 */

export interface AmroPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function AmroPagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  className,
}: AmroPaginationProps): JSX.Element {
  return (
    <div className={cn('flex items-center justify-between px-4 py-3', className)}>
      {/* Pagination info text: 14px / 500 */}
      <p className="text-sm font-medium text-muted-foreground">
        Showing page {currentPage} of {totalPages} ({totalItems} items)
      </p>
      
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            // Pagination buttons: 14px / 500
            'rounded border px-3 py-1.5 text-sm font-medium transition',
            currentPage === 1
              ? 'cursor-not-allowed opacity-50'
              : 'hover:bg-muted',
          )}
        >
          Previous
        </button>
        
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(
            'rounded border px-3 py-1.5 text-sm font-medium transition',
            currentPage === totalPages
              ? 'cursor-not-allowed opacity-50'
              : 'hover:bg-muted',
          )}
        >
          Next
        </button>
      </div>
    </div>
  );
}
