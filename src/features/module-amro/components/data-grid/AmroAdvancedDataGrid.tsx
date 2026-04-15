/**
 * AMRO Advanced Data Grid
 *
 * Feature-rich data grid with:
 * - Column resizing with drag handles and persistence
 * - Multi-column sorting with visual indicators
 * - Action column with icon buttons and tooltips
 * - Row selection with checkbox
 * - Density control (compact/normal/comfortable)
 * - Responsive design for mobile/desktop
 * - WCAG 2.1 AA accessibility compliance
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Eye,
  Pencil,
  Trash2,
  Copy,
  MoreHorizontal,
  CheckSquare,
  Square,
  GripVertical,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  useDataGridStore,
  useVisibleColumns,
  ColumnConfig,
  GridDensity,
} from './store/useDataGridStore';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AmroAdvancedDataGridProps<T extends Record<string, any>> {
  /** Grid data rows */
  data: T[];
  /** Loading state */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Custom row render function */
  renderRow?: (row: T, columns: ColumnConfig[]) => React.ReactNode;
  /** Custom cell render function */
  renderCell?: (row: T, column: ColumnConfig) => React.ReactNode;
  /** Grid density */
  density?: GridDensity;
  /** Enable row selection */
  enableSelection?: boolean;
  /** Enable column resize */
  enableColumnResize?: boolean;
  /** Enable multi-sort */
  enableMultiSort?: boolean;
  /** Minimum column width */
  minColumnWidth?: number;
  /** Maximum column width */
  maxColumnWidth?: number;
  /** Row height in pixels */
  rowHeight?: number;
  /** Pagination info */
  pagination?: {
    pageIndex: number;
    pageSize: number;
    totalCount: number;
  };
  /** Action items for each row */
  actions?: Array<{
    label: string;
    icon: React.ElementType;
    onClick: (row: T) => void;
    destructive?: boolean;
    disabled?: boolean;
  }>;
  /** View handler */
  onView?: (row: T) => void;
  /** Edit handler */
  onEdit?: (row: T) => void;
  /** Delete handler */
  onDelete?: (row: T) => void;
  /** Duplicate handler */
  onDuplicate?: (row: T) => void;
  /** CSS class name */
  className?: string;
}

// ── Density Configurations ─────────────────────────────────────────────────────

const DENSITY_CONFIG = {
  compact: { rowHeight: 36, cellPadding: 'px-2 py-1', fontSize: 'text-xs' },
  normal: { rowHeight: 48, cellPadding: 'px-4 py-2', fontSize: 'text-sm' },
  comfortable: { rowHeight: 60, cellPadding: 'px-4 py-3', fontSize: 'text-sm' },
};

// ── Column Resize Handle Component ─────────────────────────────────────────────

interface ColumnResizeHandleProps {
  columnId: string;
  onResize: (columnId: string, width: number) => void;
  currentWidth: number;
  minWidth: number;
  maxWidth: number;
}

function ColumnResizeHandle({
  columnId,
  onResize,
  currentWidth,
  minWidth,
  maxWidth,
}: ColumnResizeHandleProps) {
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing.current = true;
      startX.current = e.clientX;
      startWidth.current = currentWidth;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;
        const diff = e.clientX - startX.current;
        const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth.current + diff));
        onResize(columnId, newWidth);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [columnId, currentWidth, minWidth, maxWidth, onResize]
  );

  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group"
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${columnId} column`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          onResize(columnId, Math.min(maxWidth, currentWidth + 10));
        } else if (e.key === 'ArrowLeft') {
          onResize(columnId, Math.max(minWidth, currentWidth - 10));
        }
      }}
    >
      <div className="absolute inset-y-0 -left-1 right-1 group-hover:bg-primary/30 transition-colors" />
      <div className="absolute inset-y-0 left-0 w-px bg-border group-hover:bg-primary transition-colors" />
    </div>
  );
}

// ── Sortable Header Component ──────────────────────────────────────────────────

interface SortableHeaderProps {
  column: ColumnConfig;
  isActive: boolean;
  direction: 'asc' | 'desc' | null;
  sortOrder: number | null;
  onSort: (field: string, multi: boolean) => void;
  enableMultiSort: boolean;
}

function SortableHeader({
  column,
  isActive,
  direction,
  sortOrder,
  onSort,
  enableMultiSort,
}: SortableHeaderProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!column.sortable) return;
      onSort(column.id, enableMultiSort && e.shiftKey);
    },
    [column, onSort, enableMultiSort]
  );

  if (!column.sortable) {
    return <span className="truncate">{column.label}</span>;
  }

  return (
    <button
      type="button"
      className="flex items-center gap-2 w-full text-left hover:opacity-80 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded"
      onClick={handleClick}
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      title={
        isActive
          ? direction === 'asc'
            ? 'Sorted ascending'
            : 'Sorted descending'
          : enableMultiSort
          ? 'Click to sort (Shift+Click for multi-sort)'
          : 'Click to sort'
      }
    >
      <span className="truncate">{column.label}</span>
      <span className="inline-flex items-center gap-1 shrink-0">
        {isActive ? (
          <>
            {direction === 'asc' ? (
              <ChevronUp className="h-3.5 w-3.5 text-primary" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-primary" />
            )}
            {sortOrder && sortOrder > 1 && (
              <span className="text-[10px] font-medium text-muted-foreground">{sortOrder}</span>
            )}
          </>
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
        )}
      </span>
    </button>
  );
}

// ── Cell Renderer ──────────────────────────────────────────────────────────────

function CellContent({
  row,
  column,
}: {
  row: Record<string, any>;
  column: ColumnConfig;
}) {
  const value = typeof column.accessor === 'function' ? column.accessor(row) : row[column.accessor];

  switch (column.format) {
    case 'badge':
      return (
        <Badge
          variant={
            value === 'available' || value === 'active' || value === 'serviceable'
              ? 'default'
              : value === 'low_stock' || value === 'warning' || value === 'inspection_due'
              ? 'secondary'
              : value === 'reserved' || value === 'quarantined' || value === 'needs_repair'
              ? 'outline'
              : 'default'
          }
          className="text-xs"
        >
          {String(value).replace(/_/g, ' ')}
        </Badge>
      );

    case 'currency':
      return (
        <span className="font-mono">
          ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      );

    case 'number':
      return <span className="font-mono tabular-nums">{Number(value || 0).toLocaleString()}</span>;

    case 'date':
      return (
        <span className="text-muted-foreground">
          {value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
        </span>
      );

    default:
      return <span className="truncate">{value || '—'}</span>;
  }
}

// ── Action Column Component ────────────────────────────────────────────────────

interface ActionColumnProps<T> {
  row: T;
  actions: Array<{
    label: string;
    icon: React.ElementType;
    onClick: (row: T) => void;
    destructive?: boolean;
    disabled?: boolean;
  }>;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onDuplicate?: (row: T) => void;
}

function ActionColumn<T extends Record<string, any>>({
  row,
  actions,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
}: ActionColumnProps<T>) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const defaultActions = [
    ...(onView
      ? [{ label: 'View', icon: Eye, onClick: () => onView(row), destructive: false }]
      : []),
    ...(onEdit
      ? [{ label: 'Edit', icon: Pencil, onClick: () => onEdit(row), destructive: false }]
      : []),
    ...(onDuplicate
      ? [{ label: 'Duplicate', icon: Copy, onClick: () => onDuplicate(row), destructive: false }]
      : []),
    ...(onDelete
      ? [{ label: 'Delete', icon: Trash2, onClick: () => setConfirmDelete(true), destructive: true }]
      : []),
  ];

  const allActions = actions.length > 0 ? actions : defaultActions;

  return (
    <>
      <TooltipProvider>
        <div className="flex items-center gap-1">
          {/* Quick actions (first 2) */}
          {allActions.slice(0, 2).map((action) => {
            const Icon = action.icon;
            return (
              <Tooltip key={action.label}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => action.onClick(row)}
                    disabled={action.disabled}
                    aria-label={action.label}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{action.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* More actions dropdown */}
          {allActions.length > 2 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {allActions.slice(2).map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <DropdownMenuItem
                      key={action.label}
                      onClick={() => action.onClick(row)}
                      disabled={action.disabled}
                      className={action.destructive ? 'text-destructive focus:text-destructive' : ''}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {action.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </TooltipProvider>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (onDelete) {
                  onDelete(row);
                }
                setConfirmDelete(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Main Data Grid Component ───────────────────────────────────────────────────

export function AmroAdvancedDataGrid<T extends Record<string, any>>({
  data,
  isLoading = false,
  emptyMessage = 'No records found',
  onRowClick,
  renderRow,
  renderCell,
  density = 'normal',
  enableSelection = true,
  enableColumnResize = true,
  enableMultiSort = true,
  minColumnWidth = 60,
  maxColumnWidth = 500,
  rowHeight: customRowHeight,
  pagination,
  actions,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  className,
}: AmroAdvancedDataGridProps<T>) {
  const {
    sort,
    addSort,
    selectedIds,
    toggleSelection,
    selectAll,
    deselectAll,
    columnSizes,
    setColumnSize,
  } = useDataGridStore();

  const visibleColumns = useVisibleColumns();
  const densityConfig = DENSITY_CONFIG[density];
  const rowHeight = customRowHeight || densityConfig.rowHeight;

  // Calculate column widths
  const getColumnWidth = useCallback(
    (column: ColumnConfig) => {
      return columnSizes[column.id] || column.defaultWidth || 150;
    },
    [columnSizes]
  );

  // Handle column resize
  const handleColumnResize = useCallback(
    (columnId: string, width: number) => {
      setColumnSize(columnId, width);
    },
    [setColumnSize]
  );

  // Handle sort
  const handleSort = useCallback(
    (field: string, multi: boolean) => {
      const currentSort = sort.find(s => s.field === field);
      let direction: 'asc' | 'desc' = 'asc';
      if (currentSort) {
        direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      }
      addSort(field, direction, multi);
    },
    [sort, addSort]
  );

  // Get sort info for a column
  const getSortInfo = useCallback(
    (columnId: string) => {
      const sortItem = sort.find(s => s.field === columnId);
      return {
        isActive: !!sortItem,
        direction: sortItem?.direction || null,
        sortOrder: sortItem?.order || null,
      };
    },
    [sort]
  );

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === data.length) {
      deselectAll();
    } else {
      selectAll(data.map(d => String(d.id)));
    }
  }, [data, selectedIds, selectAll, deselectAll]);

  // Table wrapper style for horizontal scroll
  const tableStyle = useMemo(() => {
    const totalWidth = visibleColumns.reduce((sum, col) => sum + getColumnWidth(col), 0);
    return { minWidth: totalWidth };
  }, [visibleColumns, getColumnWidth]);

  // Density class
  const densityClass = densityConfig.cellPadding;
  const fontSizeClass = densityConfig.fontSize;

  return (
    <div className={cn('relative w-full', className)}>
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={tableStyle}>
            {/* Table Header */}
            <thead className="bg-muted/50 border-b sticky top-0 z-10">
              <tr>
                {visibleColumns.map((column) => {
                  const width = getColumnWidth(column);
                  const { isActive, direction, sortOrder } = getSortInfo(column.id);

                  return (
                    <th
                      key={column.id}
                      className={cn(
                        'relative text-left font-semibold border-r last:border-r-0',
                        densityClass,
                        fontSizeClass,
                        column.id === 'select' && 'w-12 text-center',
                        column.id === 'actions' && 'w-24 text-center'
                      )}
                      style={{ width, minWidth: column.minWidth || minColumnWidth, maxWidth: column.maxWidth || maxColumnWidth }}
                    >
                      <div className="flex items-center">
                        {column.id === 'select' && enableSelection ? (
                          <Checkbox
                            checked={data.length > 0 && selectedIds.size === data.length}
                            onCheckedChange={handleSelectAll}
                            aria-label="Select all rows"
                          />
                        ) : column.id === 'actions' ? (
                          <span className="mx-auto">{column.label}</span>
                        ) : (
                          <SortableHeader
                            column={column}
                            isActive={isActive}
                            direction={direction}
                            sortOrder={sortOrder}
                            onSort={handleSort}
                            enableMultiSort={enableMultiSort}
                          />
                        )}
                      </div>

                      {/* Resize Handle */}
                      {enableColumnResize && column.resizable && column.id !== 'select' && column.id !== 'actions' && (
                        <ColumnResizeHandle
                          columnId={column.id}
                          onResize={handleColumnResize}
                          currentWidth={width}
                          minWidth={column.minWidth || minColumnWidth}
                          maxWidth={column.maxWidth || maxColumnWidth}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {isLoading ? (
                // Loading skeleton rows
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="border-b">
                    {visibleColumns.map((col) => (
                      <td key={col.id} className={cn('animate-pulse', densityClass)}>
                        <div className="h-4 bg-muted rounded" style={{ width: `${Math.random() * 60 + 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                // Empty state
                <tr>
                  <td
                    colSpan={visibleColumns.length}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <p className="text-lg font-medium mb-1">{emptyMessage}</p>
                    <p className="text-xs">Try adjusting your search or filter criteria</p>
                  </td>
                </tr>
              ) : (
                // Data rows
                data.map((row) => {
                  const isSelected = selectedIds.has(String(row.id));

                  if (renderRow) {
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          'border-b transition-colors',
                          isSelected && 'bg-muted',
                          onRowClick && 'hover:bg-muted/50 cursor-pointer'
                        )}
                        onClick={() => onRowClick?.(row)}
                      >
                        {renderRow(row, visibleColumns)}
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'border-b transition-colors',
                        isSelected && 'bg-muted',
                        onRowClick && 'hover:bg-muted/50 cursor-pointer'
                      )}
                      onClick={() => onRowClick?.(row)}
                    >
                      {visibleColumns.map((column) => {
                        if (renderCell) {
                          return (
                            <td
                              key={`${row.id}-${column.id}`}
                              className={cn(
                                densityClass,
                                fontSizeClass,
                                column.id === 'select' && 'w-12 text-center',
                                column.id === 'actions' && 'w-24 text-center'
                              )}
                            >
                              {renderCell(row, column)}
                            </td>
                          );
                        }

                        if (column.id === 'select') {
                          return (
                            <td key={`${row.id}-${column.id}`} className="w-12 text-center" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelection(String(row.id))}
                                aria-label={`Select row ${row.id}`}
                              />
                            </td>
                          );
                        }

                        if (column.id === 'actions') {
                          return (
                            <td key={`${row.id}-${column.id}`} className="w-24 text-center" onClick={(e) => e.stopPropagation()}>
                              <ActionColumn
                                row={row}
                                actions={actions || []}
                                onView={onView}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onDuplicate={onDuplicate}
                              />
                            </td>
                          );
                        }

                        return (
                          <td
                            key={`${row.id}-${column.id}`}
                            className={cn(densityClass, fontSizeClass)}
                          >
                            <CellContent row={row} column={column} />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selection Summary Bar */}
      {enableSelection && selectedIds.size > 0 && (
        <div className="mt-2 flex items-center justify-between p-2 bg-primary/5 rounded-md border">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} row{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <Button variant="ghost" size="sm" onClick={deselectAll}>
            Clear Selection
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Export ─────────────────────────────────────────────────────────────────────

export default AmroAdvancedDataGrid;
