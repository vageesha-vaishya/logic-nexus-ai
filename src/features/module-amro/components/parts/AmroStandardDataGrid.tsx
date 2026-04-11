import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

/**
 * AMRO DataGrid Component - Standardized Grid with Fixed Specifications
 * 
 * Specifications:
 * - Header: font-size 16px (1rem), font-weight 600
 * - Body: font-size 14px (0.875rem), line-height 20px (1.4285)
 * - Cell padding: 12px horizontal, 8px vertical
 * - Border color: #E5E7EB
 * - Sort icons: 16x16px with hover states
 * - Pagination: 8px between page numbers, 16px margin from grid edge
 * 
 * Usage:
 * <AmroDataGrid
 *   columns={columns}
 *   data={data}
 *   onSort={handleSort}
 *   sortColumn="name"
 *   sortDirection="asc"
 *   pagination={{ currentPage: 1, totalPages: 5, onPageChange: setPage }}
 *   onRowClick={handleRowClick}
 * />
 */

// ============================================================================
// Types
// ============================================================================

export interface AmroColumn<T = any> {
  key: string;
  header: string;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  className?: string;
}

export interface AmroPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  totalItems?: number;
}

export interface AmroDataGridProps<T = any> {
  columns: AmroColumn<T>[];
  data: T[];
  className?: string;
  onSort?: (columnKey: string, direction: 'asc' | 'desc' | null) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc' | null;
  pagination?: AmroPaginationProps;
  onRowClick?: (row: T, index: number) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  zebraStriping?: boolean;
  hoverable?: boolean;
  compact?: boolean;
}

// ============================================================================
// Sort Icon Component
// ============================================================================

interface SortIconProps {
  isActive: boolean;
  direction: 'asc' | 'desc' | null;
  className?: string;
}

function SortIcon({ isActive, direction, className }: SortIconProps) {
  const size = '1rem'; // 16x16px per specification
  
  if (!isActive) {
    return (
      <ChevronsUpDown
        className={cn('ml-1 opacity-0 group-hover:opacity-50 transition-opacity', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return direction === 'asc' ? (
    <ChevronUp
      className={cn('ml-1 text-foreground', className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <ChevronDown
      className={cn('ml-1 text-foreground', className)}
      style={{ width: size, height: size }}
    />
  );
}

// ============================================================================
// Pagination Component
// ============================================================================

export function AmroPagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize = 10,
  totalItems,
}: AmroPaginationProps) {
  const gap = '0.5rem'; // 8px between page numbers per specification
  const margin = '1rem'; // 16px from grid edge per specification

  const pages = useMemo(() => {
    const pagesArray: (number | '...')[] = [];
    
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pagesArray.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pagesArray.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pagesArray.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pagesArray.push(
          1,
          '...',
          currentPage - 1,
          currentPage,
          currentPage + 1,
          '...',
          totalPages
        );
      }
    }
    
    return pagesArray;
  }, [currentPage, totalPages]);

  return (
    <div
      className="amro-pagination flex items-center justify-center"
      style={{ marginTop: margin, gap }}
      role="navigation"
      aria-label="Pagination navigation"
    >
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-2 text-sm font-medium text-muted-foreground bg-white border border-border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Previous page"
        style={{ minWidth: '2.75rem', minHeight: '2.75rem' }} // 44px touch target
      >
        Previous
      </button>

      <div className="flex items-center gap-2" style={{ gap }}>
        {pages.map((page, index) =>
          page === '...' ? (
            <span
              key={`ellipsis-${index}`}
              className="px-2 text-sm text-muted-foreground"
              aria-hidden="true"
            >
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-md transition-colors',
                'min-h-[2.75rem] min-w-[2.75rem]', // 44px touch target
                page === currentPage
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground bg-white border border-border hover:bg-muted'
              )}
              aria-current={page === currentPage ? 'page' : undefined}
              aria-label={`Page ${page}`}
            >
              {page}
            </button>
          )
        )}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 text-sm font-medium text-muted-foreground bg-white border border-border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Next page"
        style={{ minWidth: '2.75rem', minHeight: '2.75rem' }} // 44px touch target
      >
        Next
      </button>

      {totalItems && (
        <span className="ml-4 text-sm text-muted-foreground" style={{ marginLeft: '1rem' }}>
          {((currentPage - 1) * pageSize) + 1}-
          {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Main DataGrid Component
// ============================================================================

export function AmroDataGrid<T = any>({
  columns,
  data,
  className,
  onSort,
  sortColumn,
  sortDirection,
  pagination,
  onRowClick,
  isLoading = false,
  emptyMessage = 'No data available',
  zebraStriping = true,
  hoverable = true,
  compact = false,
}: AmroDataGridProps<T>) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  // Cell padding per specification: 12px horizontal, 8px vertical
  const cellPaddingX = compact ? '0.5rem' : '0.75rem';  // 12px
  const cellPaddingY = compact ? '0.25rem' : '0.5rem';  // 8px

  if (isLoading) {
    return (
      <div className="amro-grid-loading border border-border rounded-lg bg-white" role="status" aria-live="polite">
        <div className="p-8 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="amro-grid-empty border border-border rounded-lg bg-white p-8 text-center" role="status">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('amro-grid-container border border-border rounded-lg bg-white', className)}>
      <div className="overflow-x-auto">
        <table className="w-full amro-grid-table" role="grid">
          <thead>
            <tr className="border-b" style={{ borderColor: '#E5E7EB' }}>
              {columns.map((column) => {
                const isSortable = column.sortable && onSort;
                const isActive = sortColumn === column.key;
                const nextDirection = isActive
                  ? sortDirection === 'asc'
                    ? 'desc'
                    : sortDirection === 'desc'
                    ? null
                    : 'asc'
                  : 'asc';

                return (
                  <th
                    key={column.key}
                    className={cn(
                      'amro-grid-header-cell group',
                      'text-left font-semibold',
                      'text-foreground',
                      isSortable && 'cursor-pointer select-none hover:bg-muted/50 transition-colors',
                      column.className
                    )}
                    style={{
                      fontSize: '1rem',         // 16px header per specification
                      fontWeight: 600,           // 600 weight per specification
                      padding: `${cellPaddingY} ${cellPaddingX}`,
                      borderBottom: '1px solid #E5E7EB',
                      width: column.width,
                    }}
                    onClick={() => {
                      if (isSortable) {
                        onSort?.(column.key, nextDirection);
                      }
                    }}
                    role={isSortable ? 'columnheader button' : 'columnheader'}
                    aria-sort={
                      isActive
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : sortDirection === 'desc'
                          ? 'descending'
                          : 'none'
                        : undefined
                    }
                    tabIndex={isSortable ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (isSortable && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onSort?.(column.key, nextDirection);
                      }
                    }}
                  >
                    <div className="flex items-center">
                      {column.header}
                      {isSortable && (
                        <SortIcon
                          isActive={isActive}
                          direction={isActive ? sortDirection : null}
                        />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => {
              const isEven = rowIndex % 2 === 0;
              const isHovered = hoveredRow === rowIndex;
              const isClickable = !!onRowClick;

              return (
                <tr
                  key={rowIndex}
                  className={cn(
                    'amro-grid-row transition-colors',
                    zebraStriping && isEven && 'bg-muted/20',
                    hoverable && isClickable && 'cursor-pointer',
                    hoverable && isHovered && 'bg-muted/40',
                    isClickable && 'hover:bg-muted/50 active:bg-muted/60'
                  )}
                  onClick={() => onRowClick?.(row, rowIndex)}
                  onMouseEnter={() => setHoveredRow(rowIndex)}
                  onMouseLeave={() => setHoveredRow(null)}
                  role="row"
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onRowClick(row, rowIndex);
                    }
                  }}
                >
                  {columns.map((column) => {
                    const value = (row as any)[column.key];
                    return (
                      <td
                        key={`${rowIndex}-${column.key}`}
                        className={cn(
                          'amro-grid-cell',
                          column.className
                        )}
                        style={{
                          fontSize: '0.875rem',      // 14px body per specification
                          lineHeight: '1.4285',       // 20px line height per specification
                          padding: `${cellPaddingY} ${cellPaddingX}`,
                          borderBottom: '1px solid #E5E7EB',
                        }}
                        role="gridcell"
                      >
                        {column.render
                          ? column.render(value, row, rowIndex)
                          : value}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination && (
        <AmroPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={pagination.onPageChange}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
        />
      )}
    </div>
  );
}
