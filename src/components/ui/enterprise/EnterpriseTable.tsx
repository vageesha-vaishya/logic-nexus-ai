import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
}

export interface EnterpriseTableProps<T extends Record<string, any>> {
  columns: Column<T>[];
  data: T[];
  rowKey?: (row: T, index: number) => string | number;
  onRowClick?: (row: T, index: number) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string, order: 'asc' | 'desc') => void;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  rowClassName?: string;
  className?: string;
  headerClassName?: string;
  striped?: boolean;
  hover?: boolean;
}

type SortDirection = 'asc' | 'desc' | null;

export function EnterpriseTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  onRowClick,
  sortBy,
  sortOrder = 'asc',
  onSort,
  isLoading = false,
  emptyState,
  rowClassName,
  className,
  headerClassName,
  striped = true,
  hover = true,
}: EnterpriseTableProps<T>) {
  const [internalSortConfig, setInternalSortConfig] = useState<{
    column: keyof T;
    direction: SortDirection;
  } | null>(null);

  const isControlledSort = !!(sortBy && onSort);

  // Use controlled sort if provided, otherwise use internal state
  const currentSortConfig = isControlledSort
    ? sortBy
      ? {
          column: sortBy as keyof T,
          direction: sortOrder as SortDirection,
        }
      : null
    : internalSortConfig;

  const sortedData = useMemo(() => {
    if (!currentSortConfig) return data;

    const sorted = [...data].sort((a, b) => {
      const aVal = a[currentSortConfig.column];
      const bVal = b[currentSortConfig.column];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return currentSortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return currentSortConfig.direction === 'asc'
          ? aVal - bVal
          : bVal - aVal;
      }

      return 0;
    });

    return sorted;
  }, [data, currentSortConfig]);

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return;

    if (isControlledSort && onSort) {
      // Controlled sort: call the parent handler
      const currentDirection = sortBy === String(column.key) ? sortOrder : 'asc';
      const newDirection: 'asc' | 'desc' =
        currentDirection === 'asc' ? 'desc' : 'asc';
      onSort(String(column.key), newDirection);
    } else {
      // Uncontrolled sort: update internal state
      setInternalSortConfig((prev) => {
        if (prev?.column !== column.key) {
          return { column: column.key, direction: 'asc' };
        }

        if (prev.direction === 'asc') {
          return { column: column.key, direction: 'desc' };
        }

        return null;
      });
    }
  };

  const getSortIcon = (column: Column<T>) => {
    if (!column.sortable) return null;

    if (currentSortConfig?.column !== column.key) {
      return <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />;
    }

    if (currentSortConfig.direction === 'asc') {
      return <ChevronUp className="h-4 w-4 text-primary" />;
    }

    if (currentSortConfig.direction === 'desc') {
      return <ChevronDown className="h-4 w-4 text-primary" />;
    }

    return <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <div className={cn(
        'border rounded-lg overflow-hidden data-grid-loading',
        'border-border bg-card',
        className
      )}>
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border data-grid-header">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  style={{ width: col.width }}
                  className={cn(
                    'px-6 py-3 data-grid-header-cell',
                    col.headerClassName
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="data-grid-body">
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="border-b border-border bg-card">
                {columns.map((col) => (
                  <td
                    key={`${i}-${String(col.key)}`}
                    className={cn(
                      'px-6 py-3 data-grid-cell',
                      col.cellClassName
                    )}
                  >
                    <div className="h-4 bg-muted rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={cn(
        'border rounded-lg p-8 data-grid-empty',
        'border-border bg-card',
        className
      )}>
        <div className="text-center">
          {emptyState || (
            <p className="text-sm text-muted-foreground">No data available</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'border rounded-lg overflow-hidden data-grid',
      'border-border bg-card',
      className
    )}>
      <table className="w-full">
        <thead className={cn(
          'bg-muted/50 border-b border-border data-grid-header',
          headerClassName
        )}>
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                style={{ width: col.width }}
                onClick={() => handleSort(col)}
                className={cn(
                  'px-6 py-3 data-grid-header-cell',
                  col.sortable && 'cursor-pointer hover:bg-muted/30 transition-colors',
                  col.headerClassName
                )}
              >
                <div className="flex items-center gap-2">
                  <span>{col.label}</span>
                  {getSortIcon(col)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="data-grid-body">
          {sortedData.map((row, index) => (
            <tr
              key={rowKey ? rowKey(row, index) : index}
              onClick={() => onRowClick?.(row, index)}
              className={cn(
                'border-b border-border transition-colors',
                striped && index % 2 === 1 && 'bg-muted/20',
                hover && 'hover:bg-muted/30',
                onRowClick && 'cursor-pointer',
                !striped && !hover && 'bg-card',
                rowClassName
              )}
            >
              {columns.map((col) => (
                <td
                  key={String(col.key)}
                  className={cn(
                    'px-6 py-3 data-grid-cell',
                    col.className,
                    col.cellClassName
                  )}
                >
                  {col.render
                    ? col.render(row[col.key], row, index)
                    : String(row[col.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
