/**
 * AmroUnifiedTable
 * 
 * Standardized table component for all AMRO modules.
 * Provides consistent table patterns with:
 * - Search input
 * - Filter dropdowns
 * - Sortable columns
 * - Row selection
 * - Actions dropdown
 * - Pagination
 * - Empty state
 * - Loading state
 * 
 * Usage:
 * <AmroUnifiedTable
 *   columns={columns}
 *   data={data}
 *   loading={loading}
 *   search={{ value, onChange, placeholder }}
 *   filters={filters}
 *   pagination={{ page, pageSize, total, onPageChange, onPageSizeChange }}
 *   actions={(row) => [...actions]}
 *   onRowClick={(row) => handleRowClick(row)}
 * />
 */

import { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/system/EmptyState';
import { AmroUnifiedActions, ActionItem } from './AmroUnifiedActions';

// ── Types ──────────────────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc' | null;

export interface Column<T> {
  /** Unique column key */
  key: string;
  /** Column header label */
  label: string;
  /** Whether column is sortable */
  sortable?: boolean;
  /** Column width class */
  width?: string;
  /** Cell renderer */
  render?: (row: T) => React.ReactNode;
  /** Whether to hide on mobile */
  hideOnMobile?: boolean;
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface TableFilter {
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

export interface SearchConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export interface AmroUnifiedTableProps<T> {
  /** Table columns definition */
  columns: Column<T>[];
  /** Table data */
  data: T[];
  /** Loading state */
  loading?: boolean;
  /** Search configuration */
  search?: SearchConfig;
  /** Filter configurations */
  filters?: TableFilter[];
  /** Pagination configuration */
  pagination?: PaginationConfig;
  /** Actions factory for each row */
  actions?: (row: T) => ActionItem[];
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Row selection handler */
  onRowSelect?: (selectedRows: Set<string>) => void;
  /** Get row ID */
  getRowId?: (row: T) => string;
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state description */
  emptyDescription?: string;
  /** Show row selection checkboxes */
  selectable?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AmroUnifiedTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  search,
  filters,
  pagination,
  actions,
  onRowClick,
  onRowSelect,
  getRowId = (row: any) => row.id || String(Object.values(row)[0]),
  emptyMessage = 'No records found',
  emptyDescription,
  selectable = false,
}: AmroUnifiedTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Handle sort
  const handleSort = (columnKey: string) => {
    if (!columns.find(c => c.key === columnKey)?.sortable) return;

    if (sortColumn === columnKey) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  // Get sort icon
  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc'
      ? <ChevronUp className="h-4 w-4" />
      : <ChevronDown className="h-4 w-4" />;
  };

  // Handle row selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(data.map(getRowId));
      setSelectedRows(allIds);
      onRowSelect?.(allIds);
    } else {
      setSelectedRows(new Set());
      onRowSelect?.(new Set());
    }
  };

  const handleSelectRow = (rowId: string, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(rowId);
    } else {
      newSelected.delete(rowId);
    }
    setSelectedRows(newSelected);
    onRowSelect?.(newSelected);
  };

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }, [data, sortColumn, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = (pagination.page - 1) * pagination.pageSize;
    return sortedData.slice(start, start + pagination.pageSize);
  }, [sortedData, pagination]);

  const hasFilters = search || (filters && filters.length > 0);
  const isAllSelected = data.length > 0 && selectedRows.size === data.length;
  const isSomeSelected = selectedRows.size > 0 && selectedRows.size < data.length;

  return (
    <div className="space-y-4">
      {/* Search and Filters Row */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          {search && (
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={search.placeholder || 'Search...'}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          {/* Filter Dropdowns */}
          {filters?.map((filter) => (
            <Select key={filter.key} value={filter.value} onValueChange={filter.onChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{filter.label}</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

          {/* Clear Filters */}
          {(search?.value || filters?.some(f => f.value !== 'all')) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                search?.onChange('');
                filters?.forEach(f => f.onChange('all'));
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2" />
          Loading...
        </div>
      ) : paginatedData.length === 0 ? (
        <EmptyState
          title={emptyMessage}
          description={emptyDescription || 'Try adjusting your search or filters'}
        />
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {/* Selection Checkbox */}
                {selectable && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all rows"
                    />
                  </TableHead>
                )}

                {/* Column Headers */}
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={column.width}
                    onClick={() => column.sortable && handleSort(column.key)}
                    style={column.sortable ? { cursor: 'pointer' } : undefined}
                  >
                    <div className="flex items-center gap-1">
                      {column.label}
                      {column.sortable && (
                        <span className="text-muted-foreground">
                          {getSortIcon(column.key)}
                        </span>
                      )}
                    </div>
                  </TableHead>
                ))}

                {/* Actions Column */}
                {actions && (
                  <TableHead className="w-10 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((row) => {
                const rowId = getRowId(row);
                const isSelected = selectedRows.has(rowId);

                return (
                  <TableRow
                    key={rowId}
                    onClick={() => onRowClick?.(row)}
                    className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
                  >
                    {/* Selection Checkbox */}
                    {selectable && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectRow(rowId, !!checked)}
                          aria-label={`Select row ${rowId}`}
                        />
                      </TableCell>
                    )}

                    {/* Data Cells */}
                    {columns.map((column) => (
                      <TableCell key={column.key} className={column.width}>
                        {column.render 
                          ? column.render(row) 
                          : row[column.key] ?? '-'}
                      </TableCell>
                    ))}

                    {/* Actions */}
                    {actions && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <AmroUnifiedActions actions={actions(row)} />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {pagination && !loading && paginatedData.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
            {pagination.total} records
          </div>
          <div className="flex items-center gap-4">
            {/* Page Size Selector */}
            {pagination.onPageSizeChange && pagination.pageSizeOptions && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page:</span>
                <Select
                  value={String(pagination.pageSize)}
                  onValueChange={(v) => pagination.onPageSizeChange?.(parseInt(v))}
                >
                  <SelectTrigger className="w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pagination.pageSizeOptions.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Page Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page * pagination.pageSize >= pagination.total}
                onClick={() => pagination.onPageChange(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
