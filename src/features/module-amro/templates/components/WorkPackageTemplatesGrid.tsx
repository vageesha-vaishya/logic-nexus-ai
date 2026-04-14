/**
 * Work Package Templates Enterprise Grid
 * 
 * Main grid component with:
 * - Virtual scrolling for performance
 * - Server-side pagination
 * - Multi-column sorting
 * - Row selection
 * - Column visibility and ordering
 * - Density controls
 * - Full accessibility support
 * - Keyboard navigation
 */

import { useRef, useCallback, useMemo, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useTemplateGridStore, useVisibleColumns } from '../store/useTemplateGridStore';
import { TemplateRow } from './TemplateRow';
import { GridPagination } from './GridPagination';
import { WorkPackageTemplate } from '../AmroWorkPackageTemplatesPage';

// ── Types ──────────────────────────────────────────────────────────────────────

interface WorkPackageTemplatesGridProps {
  // Data
  templates: WorkPackageTemplate[];
  totalCount: number;
  isLoading: boolean;
  error: Error | null;
  
  // Actions
  onEdit: (template: WorkPackageTemplate) => void;
  onDelete: (template: WorkPackageTemplate) => void;
  onClone: (template: WorkPackageTemplate) => void;
  onPreview: (template: WorkPackageTemplate) => void;
  onManageVersions: (template: WorkPackageTemplate) => void;
  onRefresh: () => void;
  onContextMenu: (e: React.MouseEvent, templateId: string) => void;
  
  // Sorting
  onSortChange: (field: string, direction: 'asc' | 'desc', isMulti: boolean) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DENSITY_ROW_HEIGHTS = {
  compact: 38,
  normal: 46,
  comfortable: 56,
};

const COLUMN_LABELS: Record<string, string> = {
  select: 'Select',
  template_code: 'Template Code',
  template_name: 'Template Name',
  maintenance_type: 'Maintenance Type',
  aircraft_model: 'Aircraft Model',
  version: 'Version',
  status: 'Status',
  tasks_count: 'Tasks',
  description: 'Description',
  updated_at: 'Last Updated',
  created_at: 'Created',
  created_by: 'Created By',
  updated_by: 'Updated By',
  estimated_labor_hours: 'Est. Hours',
  actions: 'Actions',
};

const DEFAULT_COLUMN_WIDTHS: Record<string, string> = {
  select: '40px',
  template_code: '140px',
  template_name: 'minmax(200px, 1fr)',
  maintenance_type: '150px',
  aircraft_model: '120px',
  version: '80px',
  status: '130px',
  tasks_count: '100px',
  description: 'minmax(200px, 2fr)',
  updated_at: '120px',
  created_at: '120px',
  created_by: '140px',
  updated_by: '140px',
  estimated_labor_hours: '100px',
  actions: '100px',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function WorkPackageTemplatesGrid({
  templates,
  totalCount,
  isLoading,
  error,
  onEdit,
  onDelete,
  onClone,
  onPreview,
  onManageVersions,
  onRefresh,
  onContextMenu,
  onSortChange,
}: WorkPackageTemplatesGridProps) {
  const {
    density,
    selectedIds,
    toggleSelection,
    selectAll,
    deselectAll,
    sort,
    setSort,
    columnOrder,
    columnSizes,
  } = useTemplateGridStore();

  const visibleColumns = useVisibleColumns();
  
  // Refs
  const gridRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Row height based on density
  const rowHeight = DENSITY_ROW_HEIGHTS[density];

  // Virtualizer setup
  const rowVirtualizer = useVirtualizer({
    count: templates.length,
    getScrollElement: () => gridRef.current,
    estimateSize: () => rowHeight,
    overscan: 5, // Render 5 rows above and below viewport
  });

  // Virtual items
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Check if all items on current page are selected
  const allSelected = useMemo(() => {
    if (templates.length === 0) return false;
    return templates.every(t => selectedIds.has(t.id));
  }, [templates, selectedIds]);

  const someSelected = useMemo(() => {
    if (templates.length === 0) return false;
    return templates.some(t => selectedIds.has(t.id)) && !allSelected;
  }, [templates, selectedIds, allSelected]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      deselectAll();
    } else {
      // Select all visible templates
      const allIds = new Set(templates.map(t => t.id));
      selectAll();
      // Note: In a real implementation, you'd pass allIds to selectAll
      // For now, we'll use a workaround
      allIds.forEach(id => toggleSelection(id));
    }
  }, [allSelected, templates, deselectAll, selectAll, toggleSelection]);

  // Handle sort
  const handleSort = useCallback(
    (field: string, event: React.MouseEvent) => {
      const isMulti = event.shiftKey;
      
      // Determine new direction
      const existingSort = sort.find(s => s.field === field);
      let newDirection: 'asc' | 'desc' = 'asc';
      
      if (existingSort) {
        if (isMulti) {
          // Multi-sort: cycle through asc -> desc -> remove
          if (existingSort.direction === 'asc') {
            newDirection = 'desc';
          } else {
            // Remove from sort
            setSort(sort.filter(s => s.field !== field));
            return;
          }
        } else {
          // Single sort: toggle
          newDirection = existingSort.direction === 'asc' ? 'desc' : 'asc';
        }
      }
      
      onSortChange(field, newDirection, isMulti);
    },
    [sort, setSort, onSortChange]
  );

  // Sync header scroll with body
  useEffect(() => {
    const grid = gridRef.current;
    const header = headerRef.current;
    
    if (!grid || !header) return;

    const handleScroll = () => {
      header.scrollLeft = grid.scrollLeft;
    };

    grid.addEventListener('scroll', handleScroll);
    return () => grid.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle keyboard navigation
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSelectAll();
      }
    },
    [handleSelectAll]
  );

  // Loading state
  if (isLoading && templates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && templates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-destructive" />
          <p className="text-sm font-medium mb-2">Failed to load templates</p>
          <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!isLoading && templates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-sm font-medium mb-2">No templates found</p>
          <p className="text-sm text-muted-foreground mb-4">
            Try adjusting your filters or create a new template.
          </p>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Clear Filters
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-card">
      {/* Header */}
      <div
        ref={headerRef}
        className="overflow-hidden border-b bg-muted/50"
        role="row"
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {visibleColumns.map((columnId) => {
                const isSortable = columnId !== 'select' && columnId !== 'actions';
                const currentSort = sort.find(s => s.field === columnId);
                const sortIndex = currentSort ? sort.indexOf(currentSort) : -1;
                const width = columnSizes[columnId] 
                  ? `${columnSizes[columnId]}px` 
                  : DEFAULT_COLUMN_WIDTHS[columnId] || 'auto';

                return (
                  <TableHead
                    key={columnId}
                    className={isSortable ? 'cursor-pointer select-none' : ''}
                    style={{ width }}
                    onClick={isSortable ? (e) => handleSort(columnId, e) : undefined}
                    onKeyDown={isSortable ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSort(columnId, e as any);
                      }
                    } : undefined}
                    tabIndex={isSortable ? 0 : undefined}
                    aria-sort={
                      currentSort
                        ? currentSort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    role="columnheader"
                  >
                    <div className="flex items-center gap-2">
                      {/* Select all checkbox */}
                      {columnId === 'select' ? (
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all templates"
                        />
                      ) : (
                        <>
                          <span className="truncate">
                            {COLUMN_LABELS[columnId] || columnId}
                          </span>
                          
                          {/* Sort indicator */}
                          {isSortable && (
                            <span className="flex items-center gap-0.5">
                              {currentSort ? (
                                <>
                                  {currentSort.direction === 'asc' ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )}
                                  {sort.length > 1 && (
                                    <span className="text-xs text-muted-foreground">
                                      {sortIndex + 1}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                              )}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Body with virtual scrolling */}
      <div
        ref={gridRef}
        className="overflow-auto"
        style={{ maxHeight: 'calc(100vh - 400px)' }}
        onKeyDown={handleGridKeyDown}
        role="grid"
        aria-label="Work package templates"
        tabIndex={0}
      >
        <div
          style={{
            height: `${totalSize}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <Table>
            <TableBody>
              {virtualRows.map((virtualRow) => {
                const template = templates[virtualRow.index];
                
                if (!template) return null;

                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <TableRow
                      data-state={selectedIds.has(template.id) ? 'selected' : undefined}
                      className="hover:bg-muted/50 data-[state=selected]:bg-muted"
                    >
                      <TemplateRow
                        template={template}
                        isSelected={selectedIds.has(template.id)}
                        onToggleSelect={toggleSelection}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onClone={onClone}
                        onPreview={onPreview}
                        onManageVersions={onManageVersions}
                        onContextMenu={onContextMenu}
                        rowIndex={virtualRow.index}
                        visibleColumns={visibleColumns}
                      />
                    </TableRow>
                  </div>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Footer with pagination */}
      <GridPagination totalCount={totalCount} isLoading={isLoading} />
    </div>
  );
}
