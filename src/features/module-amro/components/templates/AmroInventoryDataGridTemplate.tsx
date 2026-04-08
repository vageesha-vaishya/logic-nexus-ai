import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Eye, EyeOff, LayoutPanelTop, Rows3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type GridViewMode = 'horizontal-split' | 'vertical-split' | 'stacked-auto';
export type EffectiveGridViewMode = 'horizontal-split' | 'vertical-split' | 'stacked';
export type GridDensity = 'compact' | 'normal' | 'comfortable';
export type GridScrollBehavior = 'virtualization' | 'pagination' | 'infinite-scroll';

export type InventoryDataType = 'text' | 'numeric' | 'date' | 'boolean' | 'object';

export type SortDirection = 'asc' | 'desc';

export type SelectionSource = 'scroll' | 'mouse' | 'keyboard' | 'touch' | 'programmatic';

export type GridSelectionEvent<TRecord> = {
  record: TRecord;
  recordId: string;
  index: number;
  source: SelectionSource;
};

export type GridScrollEvent = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  firstVisibleIndex: number;
  lastVisibleIndex: number;
};

export type GridViewModeEvent = {
  requested: GridViewMode;
  effective: EffectiveGridViewMode;
  viewportWidth: number;
};

export type GridColumnDefinition<TRecord> = {
  key: keyof TRecord | string;
  header: string;
  dataType?: InventoryDataType;
  sortable?: boolean;
  filterable?: boolean;
  groupable?: boolean;
  resizable?: boolean;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  render?: (record: TRecord) => React.ReactNode;
};

export type AmroInventoryDataGridTemplateProps<TRecord extends Record<string, unknown>> = {
  records: TRecord[];
  columns: GridColumnDefinition<TRecord>[];
  title?: string;
  subtitle?: string;
  ariaLabel?: string;
  viewMode?: GridViewMode;
  density?: GridDensity;
  scrollBehavior?: GridScrollBehavior;
  pageSize?: number;
  enableHighContrast?: boolean;
  enableDetailPanelToggle?: boolean;
  defaultDetailPanelVisible?: boolean;
  defaultSelectedRecordId?: string;
  persistKey?: string;
  syncDetailWithScroll?: boolean;
  renderDetail?: (record: TRecord) => React.ReactNode;
  getRecordId?: (record: TRecord, index: number) => string;
  onRecordSelectionChange?: (event: GridSelectionEvent<TRecord>) => void;
  onScrollPositionChange?: (event: GridScrollEvent) => void;
  onViewModeChange?: (event: GridViewModeEvent) => void;
  onDetailPanelVisibilityChange?: (visible: boolean) => void;
  onLoadMore?: () => void;
};

type FlattenedRow<TRecord> =
  | { type: 'group'; label: string; key: string }
  | { type: 'record'; record: TRecord; index: number };

const DENSITY_ROW_HEIGHT: Record<GridDensity, number> = {
  compact: 38,
  normal: 46,
  comfortable: 56,
};

const DENSITY_CELL_PADDING: Record<GridDensity, string> = {
  compact: 'py-1.5 px-2',
  normal: 'py-2 px-3',
  comfortable: 'py-3 px-3.5',
};

const DEFAULT_PAGE_SIZE = 15;
const INFINITE_CHUNK = 30;
const SCROLL_EVENT_DEBOUNCE = 120;

function toComparable(value: unknown): string | number {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.getTime();
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).toLowerCase();
}

function formatCellValue(value: unknown, type: InventoryDataType): React.ReactNode {
  if (value == null) return <span className="text-muted-foreground">-</span>;
  if (type === 'numeric') return typeof value === 'number' ? value.toLocaleString() : String(value);
  if (type === 'boolean') {
    return (
      <Badge variant={value ? 'default' : 'secondary'}>
        {value ? 'Yes' : 'No'}
      </Badge>
    );
  }
  if (type === 'date') {
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  }
  if (type === 'object') {
    return (
      <code className="inline-block max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-xs">
        {JSON.stringify(value)}
      </code>
    );
  }
  return String(value);
}

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

export function AmroInventoryDataGridTemplate<TRecord extends Record<string, unknown>>({
  records,
  columns,
  title = 'Inventory Data Grid',
  subtitle = 'Dynamic grid-detail workspace template',
  ariaLabel = 'Inventory data grid',
  viewMode = 'horizontal-split',
  density = 'normal',
  scrollBehavior = 'virtualization',
  pageSize = DEFAULT_PAGE_SIZE,
  enableHighContrast = false,
  enableDetailPanelToggle = true,
  defaultDetailPanelVisible = true,
  defaultSelectedRecordId,
  persistKey,
  syncDetailWithScroll = true,
  renderDetail,
  getRecordId,
  onRecordSelectionChange,
  onScrollPositionChange,
  onViewModeChange,
  onDetailPanelVisibilityChange,
  onLoadMore,
}: AmroInventoryDataGridTemplateProps<TRecord>) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const resizerRef = useRef<{ columnKey: string; startX: number; startWidth: number } | null>(null);
  const scrollDebounceRef = useRef<number | null>(null);
  const lastViewModePayloadRef = useRef<string | null>(null);

  const [viewportWidth, setViewportWidth] = useState<number>(typeof window === 'undefined' ? 1280 : window.innerWidth);
  const [requestedMode, setRequestedMode] = useState<GridViewMode>(viewMode);
  const [detailVisible, setDetailVisible] = useState(defaultDetailPanelVisible);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(defaultSelectedRecordId || null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sortState, setSortState] = useState<{ key: string; direction: SortDirection } | null>(null);
  const [groupByKey, setGroupByKey] = useState<string>('none');
  const [query, setQuery] = useState('');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => (
    columns.reduce<Record<string, number>>((acc, col) => {
      if (col.width) acc[String(col.key)] = col.width;
      return acc;
    }, {})
  ));
  const [currentPage, setCurrentPage] = useState(1);
  const [infiniteCount, setInfiniteCount] = useState(Math.max(pageSize, INFINITE_CHUNK));
  const [screenReaderMessage, setScreenReaderMessage] = useState('');

  const resolveRecordId = useCallback((record: TRecord, index: number) => {
    if (getRecordId) return getRecordId(record, index);
    const maybeId = record.id;
    if (maybeId != null) return String(maybeId);
    return String(index);
  }, [getRecordId]);

  const effectiveViewMode: EffectiveGridViewMode = useMemo(() => {
    if (requestedMode !== 'stacked-auto') return requestedMode;
    if (viewportWidth < 768) return 'stacked';
    if (viewportWidth <= 1024) return 'vertical-split';
    return 'horizontal-split';
  }, [requestedMode, viewportWidth]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setRequestedMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    const payload = {
      requested: requestedMode,
      effective: effectiveViewMode,
      viewportWidth,
    } as GridViewModeEvent;
    const payloadKey = `${payload.requested}:${payload.effective}:${payload.viewportWidth}`;
    if (lastViewModePayloadRef.current === payloadKey) return;
    lastViewModePayloadRef.current = payloadKey;
    onViewModeChange?.(payload);
  }, [requestedMode, effectiveViewMode, viewportWidth, onViewModeChange]);

  useEffect(() => {
    if (!persistKey || typeof window === 'undefined') return;
    const saved = window.sessionStorage.getItem(`grid-template:${persistKey}`);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { selectedRecordId?: string; detailVisible?: boolean; requestedMode?: GridViewMode; scrollTop?: number };
      if (parsed.selectedRecordId) setSelectedRecordId(parsed.selectedRecordId);
      if (typeof parsed.detailVisible === 'boolean') setDetailVisible(parsed.detailVisible);
      if (parsed.requestedMode) setRequestedMode(parsed.requestedMode);
      requestAnimationFrame(() => {
        if (listRef.current && typeof parsed.scrollTop === 'number') {
          listRef.current.scrollTop = parsed.scrollTop;
        }
      });
    } catch {
      // Ignore invalid persisted payloads.
    }
  }, [persistKey]);

  const persistState = useCallback((scrollTop?: number) => {
    if (!persistKey || typeof window === 'undefined') return;
    const payload = {
      selectedRecordId,
      detailVisible,
      requestedMode,
      scrollTop: scrollTop ?? listRef.current?.scrollTop ?? 0,
    };
    window.sessionStorage.setItem(`grid-template:${persistKey}`, JSON.stringify(payload));
  }, [detailVisible, persistKey, requestedMode, selectedRecordId]);

  useEffect(() => {
    persistState();
  }, [selectedRecordId, detailVisible, requestedMode, persistState]);

  const filterableColumns = useMemo(() => columns.filter((column) => column.filterable !== false), [columns]);
  const groupableColumns = useMemo(() => columns.filter((column) => column.groupable), [columns]);

  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return records;
    return records.filter((record) => {
      return filterableColumns.some((column) => {
        const key = String(column.key);
        const value = record[key];
        if (value == null) return false;
        return String(value).toLowerCase().includes(normalized);
      });
    });
  }, [records, query, filterableColumns]);

  const sortedRecords = useMemo(() => {
    if (!sortState) return filteredRecords;
    return [...filteredRecords].sort((a, b) => {
      const aValue = toComparable(a[sortState.key]);
      const bValue = toComparable(b[sortState.key]);
      if (aValue < bValue) return sortState.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortState.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRecords, sortState]);

  const pagedRecords = useMemo(() => {
    if (scrollBehavior !== 'pagination') return sortedRecords;
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, scrollBehavior, currentPage, pageSize]);

  const infiniteRecords = useMemo(() => {
    if (scrollBehavior !== 'infinite-scroll') return pagedRecords;
    return pagedRecords.slice(0, infiniteCount);
  }, [scrollBehavior, pagedRecords, infiniteCount]);

  const recordsForRender = useMemo(() => {
    if (scrollBehavior === 'infinite-scroll') return infiniteRecords;
    return pagedRecords;
  }, [scrollBehavior, infiniteRecords, pagedRecords]);

  const flattenedRows = useMemo<FlattenedRow<TRecord>[]>(() => {
    if (groupByKey === 'none') {
      return recordsForRender.map((record, index) => ({ type: 'record', record, index }));
    }
    const groups = new Map<string, TRecord[]>();
    recordsForRender.forEach((record) => {
      const raw = record[groupByKey];
      const label = raw == null ? 'Unspecified' : String(raw);
      const items = groups.get(label) || [];
      items.push(record);
      groups.set(label, items);
    });
    const rows: FlattenedRow<TRecord>[] = [];
    Array.from(groups.entries()).forEach(([label, grouped]) => {
      rows.push({ type: 'group', label, key: `${groupByKey}:${label}` });
      grouped.forEach((record, index) => rows.push({ type: 'record', record, index }));
    });
    return rows;
  }, [groupByKey, recordsForRender]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(sortedRecords.length / pageSize)), [sortedRecords.length, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const selectedRecord = useMemo(() => {
    if (!selectedRecordId) return null;
    return records.find((record, index) => resolveRecordId(record, index) === selectedRecordId) || null;
  }, [records, resolveRecordId, selectedRecordId]);

  useEffect(() => {
    if (!selectedRecord && recordsForRender.length > 0) {
      const firstId = resolveRecordId(recordsForRender[0], 0);
      setSelectedRecordId(firstId);
      setActiveIndex(0);
    }
  }, [recordsForRender, resolveRecordId, selectedRecord]);

  const announce = useCallback((message: string) => {
    setScreenReaderMessage(message);
  }, []);

  const selectRecord = useCallback((record: TRecord, index: number, source: SelectionSource) => {
    const recordId = resolveRecordId(record, index);
    if (recordId === selectedRecordId && index === activeIndex) return;
    setSelectedRecordId(recordId);
    setActiveIndex(index);
    onRecordSelectionChange?.({ record, recordId, index, source });
    if (source !== 'scroll') {
      announce(`Selected record ${recordId}`);
    }
  }, [activeIndex, announce, onRecordSelectionChange, resolveRecordId, selectedRecordId]);

  const effectiveRowHeight = DENSITY_ROW_HEIGHT[density];

  const rowVirtualizer = useVirtualizer({
    count: flattenedRows.length,
    getScrollElement: () => listRef.current,
    estimateSize: (idx) => flattenedRows[idx]?.type === 'group' ? 32 : effectiveRowHeight,
    overscan: 8,
  });

  const emitScrollEvent = useCallback((scrollTop: number, clientHeight: number, scrollHeight: number, firstVisibleIndex: number, lastVisibleIndex: number) => {
    if (scrollDebounceRef.current) {
      window.clearTimeout(scrollDebounceRef.current);
    }
    scrollDebounceRef.current = window.setTimeout(() => {
      onScrollPositionChange?.({
        scrollTop,
        clientHeight,
        scrollHeight,
        firstVisibleIndex,
        lastVisibleIndex,
      });
    }, SCROLL_EVENT_DEBOUNCE);
  }, [onScrollPositionChange]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const scrollTop = target.scrollTop;
    const clientHeight = target.clientHeight;
    const scrollHeight = target.scrollHeight;
    persistState(scrollTop);

    const firstVisibleIndex = Math.max(0, Math.floor(scrollTop / effectiveRowHeight));
    const lastVisibleIndex = Math.min(recordsForRender.length - 1, Math.floor((scrollTop + clientHeight) / effectiveRowHeight));
    emitScrollEvent(scrollTop, clientHeight, scrollHeight, firstVisibleIndex, Math.max(firstVisibleIndex, lastVisibleIndex));

    if (syncDetailWithScroll && recordsForRender[firstVisibleIndex]) {
      const firstVisibleRecord = recordsForRender[firstVisibleIndex];
      const firstVisibleRecordId = resolveRecordId(firstVisibleRecord, firstVisibleIndex);
      if (firstVisibleRecordId !== selectedRecordId) {
        selectRecord(firstVisibleRecord, firstVisibleIndex, 'scroll');
      }
    }

    if (scrollBehavior === 'infinite-scroll') {
      const nearBottom = scrollTop + clientHeight >= scrollHeight - 80;
      if (nearBottom && infiniteCount < sortedRecords.length) {
        setInfiniteCount((current) => Math.min(current + INFINITE_CHUNK, sortedRecords.length));
      } else if (nearBottom && infiniteCount >= sortedRecords.length) {
        onLoadMore?.();
      }
    }
  }, [
    effectiveRowHeight,
    emitScrollEvent,
    infiniteCount,
    onLoadMore,
    persistState,
    recordsForRender,
    resolveRecordId,
    scrollBehavior,
    selectedRecordId,
    selectRecord,
    sortedRecords.length,
    syncDetailWithScroll,
  ]);

  const resizeColumn = useCallback((columnKey: string, width: number, definition: GridColumnDefinition<TRecord>) => {
    const min = definition.minWidth || 80;
    const max = definition.maxWidth || 560;
    const bounded = Math.min(max, Math.max(min, width));
    setColumnWidths((current) => ({ ...current, [columnKey]: bounded }));
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!resizerRef.current) return;
    const columnKey = resizerRef.current.columnKey;
    const delta = event.clientX - resizerRef.current.startX;
    const columnDef = columns.find((column) => String(column.key) === columnKey);
    if (!columnDef) return;
    resizeColumn(columnKey, resizerRef.current.startWidth + delta, columnDef);
  }, [columns, resizeColumn]);

  const handleMouseUp = useCallback(() => {
    resizerRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const startResize = useCallback((column: GridColumnDefinition<TRecord>, event: React.MouseEvent<HTMLButtonElement>) => {
    const key = String(column.key);
    const width = columnWidths[key] || column.width || 180;
    resizerRef.current = {
      columnKey: key,
      startX: event.clientX,
      startWidth: width,
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths, handleMouseMove, handleMouseUp]);

  const toggleSort = useCallback((column: GridColumnDefinition<TRecord>) => {
    if (!column.sortable) return;
    const key = String(column.key);
    setSortState((current) => {
      if (!current || current.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  }, []);

  const gridAreaClassName = useMemo(() => {
    if (effectiveViewMode === 'horizontal-split') return 'grid-cols-1 lg:grid-cols-[1.45fr_1fr]';
    if (effectiveViewMode === 'vertical-split') return 'grid-cols-1';
    return 'grid-cols-1';
  }, [effectiveViewMode]);

  const detailPanelClassName = useMemo(() => {
    if (effectiveViewMode === 'vertical-split') return 'min-h-[260px]';
    if (effectiveViewMode === 'stacked') return 'min-h-[220px]';
    return 'min-h-[520px]';
  }, [effectiveViewMode]);

  const highContrastClassName = enableHighContrast ? 'border-black bg-white text-black dark:border-white dark:bg-black dark:text-white' : '';

  const interactionHints = useMemo(() => ({
    input: isTouchDevice() ? 'touch' : 'mouse',
    keyboard: 'ArrowUp/ArrowDown/Enter/Escape/Tab',
  }), []);

  const handleKeyboardNavigation = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (recordsForRender.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => {
        const next = Math.min(current + 1, recordsForRender.length - 1);
        const nextRecord = recordsForRender[next];
        if (nextRecord) selectRecord(nextRecord, next, 'keyboard');
        return next;
      });
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => {
        const prev = Math.max(current - 1, 0);
        const prevRecord = recordsForRender[prev];
        if (prevRecord) selectRecord(prevRecord, prev, 'keyboard');
        return prev;
      });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const record = recordsForRender[activeIndex];
      if (record) selectRecord(record, activeIndex, 'keyboard');
      return;
    }
    if (event.key === 'Escape' && enableDetailPanelToggle) {
      event.preventDefault();
      setDetailVisible(false);
      onDetailPanelVisibilityChange?.(false);
      announce('Detail panel hidden');
    }
  }, [activeIndex, announce, enableDetailPanelToggle, onDetailPanelVisibilityChange, recordsForRender, selectRecord]);

  const renderRowCells = useCallback((record: TRecord) => {
    return columns.map((column) => {
      const key = String(column.key);
      const width = columnWidths[key] || column.width || 180;
      const dataType = column.dataType || 'text';
      return (
        <div
          key={key}
          className={cn(
            'shrink-0 border-r border-border last:border-r-0',
            DENSITY_CELL_PADDING[density],
          )}
          style={{ width }}
          role="gridcell"
        >
          <div className="truncate">
            {column.render ? column.render(record) : formatCellValue(record[key], dataType)}
          </div>
        </div>
      );
    });
  }, [columnWidths, columns, density]);

  const headerRow = (
    <div className={cn('sticky top-0 z-10 flex border-b bg-muted/80 backdrop-blur-sm', highContrastClassName)} role="row">
      {columns.map((column) => {
        const key = String(column.key);
        const width = columnWidths[key] || column.width || 180;
        const sortActive = sortState?.key === key;
        const sortDirection = sortState?.direction;
        return (
          <div
            key={key}
            style={{ width }}
            className="group relative shrink-0 border-r border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide last:border-r-0"
            role="columnheader"
            aria-sort={sortActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            <button
              type="button"
              className={cn('flex w-full items-center justify-between gap-2 text-left', column.sortable ? 'cursor-pointer' : 'cursor-default')}
              onClick={() => toggleSort(column)}
              aria-label={`${column.header}${column.sortable ? ', sortable' : ''}`}
            >
              <span className="truncate">{column.header}</span>
              {column.sortable ? (
                <span className="text-muted-foreground">
                  {sortActive && sortDirection === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5 opacity-70" />}
                </span>
              ) : null}
            </button>
            {column.resizable ? (
              <button
                type="button"
                className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`Resize ${column.header} column`}
                onMouseDown={(event) => startResize(column, event)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );

  const renderRows = () => {
    if (scrollBehavior === 'virtualization') {
      const virtualItems = rowVirtualizer.getVirtualItems();
      return (
        <div
          style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}
          role="rowgroup"
        >
          {virtualItems.map((virtualRow) => {
            const flat = flattenedRows[virtualRow.index];
            if (!flat) return null;
            if (flat.type === 'group') {
              return (
                <div
                  key={flat.key}
                  className="absolute left-0 right-0 border-b bg-muted/40 px-3 py-1.5 text-xs font-semibold"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                  role="row"
                >
                  {flat.label}
                </div>
              );
            }
            const recordId = resolveRecordId(flat.record, flat.index);
            const isSelected = selectedRecordId === recordId;
            return (
              <button
                key={recordId}
                type="button"
                className={cn(
                  'absolute left-0 right-0 flex w-full border-b text-left transition-colors',
                  isSelected ? 'bg-primary/10' : 'hover:bg-muted/60',
                  highContrastClassName,
                )}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
                onClick={() => selectRecord(flat.record, flat.index, isTouchDevice() ? 'touch' : 'mouse')}
                aria-label={`Select record ${recordId}`}
                role="row"
              >
                {renderRowCells(flat.record)}
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div role="rowgroup">
        {flattenedRows.map((flat, index) => {
          if (flat.type === 'group') {
            return (
              <div key={flat.key} className="border-b bg-muted/40 px-3 py-1.5 text-xs font-semibold" role="row">
                {flat.label}
              </div>
            );
          }
          const recordId = resolveRecordId(flat.record, flat.index);
          const isSelected = selectedRecordId === recordId;
          return (
            <button
              key={`${recordId}:${index}`}
              type="button"
              className={cn(
                'flex w-full border-b text-left transition-colors',
                isSelected ? 'bg-primary/10' : 'hover:bg-muted/60',
                highContrastClassName,
              )}
              role="row"
              aria-label={`Select record ${recordId}`}
              onClick={() => selectRecord(flat.record, flat.index, isTouchDevice() ? 'touch' : 'mouse')}
            >
              {renderRowCells(flat.record)}
            </button>
          );
        })}
      </div>
    );
  };

  const renderDefaultDetail = (record: TRecord) => (
    <div className="space-y-3">
      {Object.entries(record).map(([key, value]) => (
        <div key={key} className="grid grid-cols-[140px_1fr] items-start gap-2 text-sm">
          <span className="font-semibold text-muted-foreground">{key}</span>
          <span className="break-words">{formatCellValue(value, typeof value === 'boolean' ? 'boolean' : (value instanceof Date ? 'date' : (typeof value === 'number' ? 'numeric' : (typeof value === 'object' ? 'object' : 'text'))))}</span>
        </div>
      ))}
    </div>
  );

  return (
    <Card className={cn('transition-colors', highContrastClassName)}>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{subtitle}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Input: {interactionHints.input}</Badge>
            <Badge variant="outline">Keyboard: {interactionHints.keyboard}</Badge>
            {enableHighContrast ? <Badge>High Contrast</Badge> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter records..."
            className="h-9 w-[240px]"
            aria-label="Filter records"
          />
          <Select value={groupByKey} onValueChange={setGroupByKey}>
            <SelectTrigger className="h-9 w-[190px]" aria-label="Group records">
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No grouping</SelectItem>
              {groupableColumns.map((column) => (
                <SelectItem key={String(column.key)} value={String(column.key)}>
                  Group by {column.header}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={requestedMode === 'horizontal-split' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRequestedMode('horizontal-split')}
            aria-label="Horizontal split layout"
          >
            <Columns3 className="mr-1.5 h-4 w-4" />
            Horizontal
          </Button>
          <Button
            type="button"
            variant={requestedMode === 'vertical-split' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRequestedMode('vertical-split')}
            aria-label="Vertical split layout"
          >
            <LayoutPanelTop className="mr-1.5 h-4 w-4" />
            Vertical
          </Button>
          <Button
            type="button"
            variant={requestedMode === 'stacked-auto' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRequestedMode('stacked-auto')}
            aria-label="Responsive stacked layout"
          >
            <Rows3 className="mr-1.5 h-4 w-4" />
            Responsive
          </Button>
          {enableDetailPanelToggle ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const next = !detailVisible;
                setDetailVisible(next);
                onDetailPanelVisibilityChange?.(next);
                announce(next ? 'Detail panel shown' : 'Detail panel hidden');
              }}
              aria-label={detailVisible ? 'Hide detail panel' : 'Show detail panel'}
            >
              {detailVisible ? <EyeOff className="mr-1.5 h-4 w-4" /> : <Eye className="mr-1.5 h-4 w-4" />}
              {detailVisible ? 'Hide Detail' : 'Show Detail'}
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        <div className={cn(
          'grid gap-4 transition-all duration-300 ease-in-out',
          gridAreaClassName,
        )}>
          <div
            className={cn('rounded-md border transition-all duration-300', highContrastClassName)}
            onKeyDown={handleKeyboardNavigation}
            role="region"
            aria-label={ariaLabel}
          >
            {headerRow}
            <div
              ref={listRef}
              className={cn(
                'overflow-auto',
                effectiveViewMode === 'vertical-split' ? 'max-h-[360px]' : 'max-h-[560px]',
              )}
              onScroll={handleScroll}
              role="grid"
              aria-rowcount={recordsForRender.length}
              aria-colcount={columns.length}
              tabIndex={0}
            >
              {renderRows()}
            </div>

            {scrollBehavior === 'pagination' ? (
              <div className="flex items-center justify-between border-t px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  Page {currentPage} / {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-7 w-7" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {detailVisible ? (
            <div className={cn('rounded-md border p-3 transition-all duration-300', detailPanelClassName, highContrastClassName)}>
              <h3 className="mb-2 text-sm font-semibold">Record Detail</h3>
              {selectedRecord ? (
                renderDetail ? renderDetail(selectedRecord) : renderDefaultDetail(selectedRecord)
              ) : (
                <p className="text-sm text-muted-foreground">Select a record to view details.</p>
              )}
            </div>
          ) : null}
        </div>
      </CardContent>

      <div className="sr-only" aria-live="polite">
        {screenReaderMessage}
      </div>
    </Card>
  );
}

export default AmroInventoryDataGridTemplate;
