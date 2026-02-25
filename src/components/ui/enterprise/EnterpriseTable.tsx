import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface EnterpriseTableProps<T extends Record<string, any>> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  empty?: boolean;
  emptyContent?: React.ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  striped?: boolean;
  keyExtractor?: (row: T, index: number) => string | number;
}

type SortDirection = 'asc' | 'desc' | null;

export function EnterpriseTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  empty = false,
  emptyContent,
  onRowClick,
  rowClassName,
  headerClassName,
  bodyClassName,
  striped = true,
  keyExtractor,
}: EnterpriseTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{
    column: keyof T;
    direction: SortDirection;
  } | null>(null);

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortConfig.column];
      const bVal = b[sortConfig.column];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });

    return sorted;
  }, [data, sortConfig]);

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return;

    setSortConfig((prev) => {
      if (prev?.column !== column.key) {
        return { column: column.key, direction: 'asc' };
      }

      if (prev.direction === 'asc') {
        return { column: column.key, direction: 'desc' };
      }

      return null;
    });
  };

  const getSortIcon = (column: Column<T>) => {
    if (!column.sortable) return null;

    if (sortConfig?.column !== column.key) {
      return <ChevronsUpDown className="h-4 w-4 text-gray-400" />;
    }

    if (sortConfig.direction === 'asc') {
      return <ChevronUp className="h-4 w-4 text-[#714B67]" />;
    }

    if (sortConfig.direction === 'desc') {
      return <ChevronDown className="h-4 w-4 text-[#714B67]" />;
    }

    return <ChevronsUpDown className="h-4 w-4 text-gray-400" />;
  };

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    'px-6 py-3 text-left text-sm font-medium text-gray-900',
                    col.headerClassName
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="border-b border-gray-200 bg-white">
                {columns.map((col) => (
                  <td
                    key={`${i}-${String(col.key)}`}
                    className="px-6 py-3 text-sm"
                  >
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (empty || data.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-8">
        <div className="text-center text-muted-foreground">
          {emptyContent || (
            <>
              <p className="text-sm text-gray-500">No data available</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.05)] overflow-hidden">
      <table className="w-full">
        <thead className={cn('bg-gray-50 border-b border-gray-200', headerClassName)}>
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                onClick={() => handleSort(col)}
                className={cn(
                  'px-6 py-3 text-left text-sm font-medium text-gray-900',
                  col.sortable && 'cursor-pointer hover:bg-gray-100 transition-colors',
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
        <tbody className={bodyClassName}>
          {sortedData.map((row, index) => (
            <tr
              key={keyExtractor ? keyExtractor(row, index) : index}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'border-b border-gray-200 transition-colors',
                striped && index % 2 === 1 && 'bg-gray-50',
                onRowClick && 'cursor-pointer hover:bg-gray-100',
                !onRowClick && 'bg-white',
                rowClassName
              )}
            >
              {columns.map((col) => (
                <td
                  key={String(col.key)}
                  className={cn(
                    'px-6 py-3 text-sm text-gray-900',
                    col.className
                  )}
                >
                  {col.render
                    ? col.render(row[col.key], row)
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
