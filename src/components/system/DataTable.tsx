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
import { Search, Filter, X, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';
import { TableSkeleton } from './TableSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounce } from '@/hooks/useDebounce';

export interface ColumnDef<T> {
  key: keyof T | string;
  header: string | React.ReactNode;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  className?: string;
  hideOnMobile?: boolean;
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

  // Faceted Filters (Quick filters)
  facets?: {
    key: string;
    label: string;
    options: { label: string; value: string; count?: number }[];
    value?: string;
    onChange: (value: string) => void;
  }[];

  // Extra Actions
  actions?: React.ReactNode;

  // Mobile View
  mobileTitleKey?: keyof T | string;
  mobileSubtitleKey?: keyof T | string;
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
  facets,
  actions,
  mobileTitleKey,
  mobileSubtitleKey,
}: DataTableProps<T>) {
  const [localSearch, setLocalSearch] = useState(search?.query || '');
  const isMobile = useIsMobile();
  const debouncedSearch = useDebounce(localSearch, 300);

  // Sync local search with external query changes (e.g. clear button)
  React.useEffect(() => {
    if (search?.query !== undefined && search.query !== localSearch) {
      setLocalSearch(search.query);
    }
  }, [search?.query]);

  // Handle local search debounce
  React.useEffect(() => {
    if (debouncedSearch !== search?.query) {
      search?.onQueryChange(debouncedSearch);
    }
  }, [debouncedSearch, search?.onQueryChange, search?.query]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearch(e.target.value);
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
      {(search || actions || facets) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 flex-1 w-full">
            {search && (
              <div className="relative w-full sm:max-w-sm flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={search.placeholder || "Search..."}
                  value={localSearch}
                  onChange={handleSearchChange}
                  className="pl-8"
                />
              </div>
            )}
            
            {facets?.map((facet) => (
              <Select key={facet.key} value={facet.value} onValueChange={facet.onChange}>
                <SelectTrigger className="w-auto h-9 min-w-[120px]">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder={facet.label} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {facet.label}</SelectItem>
                  {facet.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label} {opt.count !== undefined && `(${opt.count})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </div>
          <div className="flex items-center gap-2 justify-end">
            {actions}
          </div>
        </div>
      )}

      {/* Table / Card View */}
      {isMobile ? (
        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-1"><Skeleton className="h-2 w-12" /><Skeleton className="h-3 w-16" /></div>
                    <div className="space-y-1"><Skeleton className="h-2 w-12" /><Skeleton className="h-3 w-16" /></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No results found.</div>
          ) : (
            data.map((row, rowIndex) => {
              const rowId = selection ? selection.rowId(row) : String(rowIndex);
              const isSelected = selection ? selection.selectedIds.includes(rowId) : false;
              
              const title = mobileTitleKey ? (row as any)[mobileTitleKey] : (row as any)[columns[0].key];
              const subtitle = mobileSubtitleKey ? (row as any)[mobileSubtitleKey] : (row as any)[columns[1]?.key];

              return (
                <Card 
                  key={rowId} 
                  className={cn(
                    "transition-colors",
                    onRowClick ? "cursor-pointer active:bg-muted" : "",
                    isSelected ? "border-primary bg-primary/5" : ""
                  )}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      {selection && (
                        <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={isSelected} 
                            onCheckedChange={(checked) => handleSelectRow(row, checked === true)}
                            aria-label="Select row"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{title}</div>
                        {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
                      </div>
                      {onRowClick && <ChevronRight className="w-4 h-4 text-muted-foreground mt-1" />}
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t">
                      {columns.filter(col => !col.hideOnMobile).map((col, colIndex) => {
                         const val = col.render ? col.render(row) : (row as any)[col.key];
                         if (col.key === mobileTitleKey || col.key === mobileSubtitleKey) return null;
                         if (!val && val !== 0) return null;

                         return (
                           <div key={String(col.key) + colIndex} className="space-y-0.5">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                {col.header}
                              </div>
                              <div className="text-sm truncate">
                                {val}
                              </div>
                           </div>
                         );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
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
                  <TableCell colSpan={columns.length + (selection ? 1 : 0)} className="p-0">
                    <TableSkeleton columns={columns.length + (selection ? 1 : 0)} rows={5} />
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
      )}

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground order-2 sm:order-1">
            {selection && selection.selectedIds.length > 0 ? (
              <span>{selection.selectedIds.length} row(s) selected.</span>
            ) : (
              <span>
                Showing {Math.min((pagination.pageIndex - 1) * pagination.pageSize + 1, pagination.totalCount)} to {Math.min(pagination.pageIndex * pagination.pageSize, pagination.totalCount)} of {pagination.totalCount} entries
              </span>
            )}
          </div>
          <div className="order-1 sm:order-2">
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
                {Array.from({ length: Math.min(isMobile ? 3 : 5, totalPages) }).map((_, i) => {
                  // Calculate range to show around current page
                  let p = pagination.pageIndex - (isMobile ? 1 : 2) + i;
                  if (pagination.pageIndex < (isMobile ? 2 : 3)) p = i + 1;
                  if (pagination.pageIndex > totalPages - (isMobile ? 1 : 2)) p = totalPages - (isMobile ? 2 : 4) + i;
                  
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
        </div>
      )}
    </div>
  );
}
