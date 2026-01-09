import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  SortableHead,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationFirst,
  PaginationLast,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

export interface ColumnDef<T> {
  key: keyof T | string;
  header: string | React.ReactNode;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  
  // Pagination
  pagination?: {
    pageIndex: number;
    pageSize: number;
    totalCount: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
  };
  
  // Sorting
  sorting?: {
    field: string;
    direction: 'asc' | 'desc';
    onSort: (field: string) => void;
  };
  
  // Selection
  selection?: {
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    rowId: (row: T) => string;
  };

  // Search
  search?: {
    query: string;
    onQueryChange: (query: string) => void;
    placeholder?: string;
  };

  // Extra Actions
  actions?: React.ReactNode;
}

export function DataTable<T extends { id?: string | number }>({
  data,
  columns,
  isLoading,
  onRowClick,
  pagination,
  sorting,
  selection,
  search,
  actions,
}: DataTableProps<T>) {
  const [localSearch, setLocalSearch] = useState(search?.query || '');

  // Handle local search debounce if needed, but for now simple controlled input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalSearch(val);
    search?.onQueryChange(val);
  };

  const totalPages = pagination ? Math.ceil(pagination.totalCount / pagination.pageSize) : 0;
  
  const handleSelectAll = (checked: boolean) => {
    if (!selection) return;
    if (checked) {
      const allIds = data.map(selection.rowId);
      selection.onSelectionChange(allIds);
    } else {
      selection.onSelectionChange([]);
    }
  };

  const handleSelectRow = (row: T, checked: boolean) => {
    if (!selection) return;
    const id = selection.rowId(row);
    if (checked) {
      selection.onSelectionChange([...selection.selectedIds, id]);
    } else {
      selection.onSelectionChange(selection.selectedIds.filter(existingId => existingId !== id));
    }
  };

  const allSelected = selection && data.length > 0 && data.every(row => selection.selectedIds.includes(selection.rowId(row)));
  const someSelected = selection && data.length > 0 && data.some(row => selection.selectedIds.includes(selection.rowId(row))) && !allSelected;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      {(search || actions) && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            {search && (
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={search.placeholder || "Search..."}
                  value={localSearch}
                  onChange={handleSearchChange}
                  className="pl-8"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {actions}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {selection && (
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={allSelected} 
                    onCheckedChange={(checked) => handleSelectAll(checked === true)}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              {columns.map((col, index) => {
                const key = String(col.key);
                if (col.sortable && sorting) {
                  return (
                    <SortableHead
                      key={key + index}
                      field={key}
                      activeField={sorting.field}
                      direction={sorting.direction}
                      onSort={sorting.onSort}
                      className={col.className}
                      style={{ width: col.width }}
                    >
                      {col.header}
                    </SortableHead>
                  );
                }
                return (
                  <TableHead 
                    key={key + index} 
                    className={col.className}
                    style={{ width: col.width }}
                  >
                    {col.header}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (selection ? 1 : 0)} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (selection ? 1 : 0)} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, rowIndex) => {
                const rowId = selection ? selection.rowId(row) : String(rowIndex);
                const isSelected = selection ? selection.selectedIds.includes(rowId) : false;

                return (
                  <TableRow 
                    key={rowId} 
                    className={cn(onRowClick ? "cursor-pointer" : "")}
                    onClick={() => onRowClick && onRowClick(row)}
                    data-state={isSelected ? "selected" : undefined}
                  >
                    {selection && (
                      <TableCell className="w-[50px]" onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                          checked={isSelected} 
                          onCheckedChange={(checked) => handleSelectRow(row, checked === true)}
                          aria-label="Select row"
                        />
                      </TableCell>
                    )}
                    {columns.map((col, colIndex) => (
                      <TableCell key={String(col.key) + colIndex} className={col.className}>
                        {col.render ? col.render(row) : (row as any)[col.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selection && selection.selectedIds.length > 0 ? (
              <span>{selection.selectedIds.length} row(s) selected.</span>
            ) : (
              <span>
                Showing {Math.min((pagination.pageIndex - 1) * pagination.pageSize + 1, pagination.totalCount)} to {Math.min(pagination.pageIndex * pagination.pageSize, pagination.totalCount)} of {pagination.totalCount} entries
              </span>
            )}
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationFirst 
                  onClick={() => pagination.onPageChange(1)} 
                  className={pagination.pageIndex === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => pagination.onPageChange(Math.max(1, pagination.pageIndex - 1))}
                  className={pagination.pageIndex === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {/* Simplified pagination logic for now */}
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                // Calculate range to show around current page
                let p = pagination.pageIndex - 2 + i;
                if (pagination.pageIndex < 3) p = i + 1;
                if (pagination.pageIndex > totalPages - 2) p = totalPages - 4 + i;
                
                // Clamp
                if (p < 1 || p > totalPages) return null;

                return (
                  <PaginationItem key={p}>
                    <PaginationLink 
                      isActive={p === pagination.pageIndex}
                      onClick={() => pagination.onPageChange(p)}
                      className="cursor-pointer"
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              <PaginationItem>
                <PaginationNext 
                  onClick={() => pagination.onPageChange(Math.min(totalPages, pagination.pageIndex + 1))}
                  className={pagination.pageIndex === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationLast 
                  onClick={() => pagination.onPageChange(totalPages)}
                  className={pagination.pageIndex === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
