import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Eye, EyeOff, GripHorizontal, GripVertical, LayoutPanelTop, PanelBottomClose, PanelBottomOpen, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Rows3, Save, Trash2, X } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type GridViewMode = 'horizontal-split' | 'vertical-split' | 'stacked-auto';
export type EffectiveGridViewMode = 'horizontal-split' | 'vertical-split' | 'stacked';
export type GridDensity = 'compact' | 'normal' | 'comfortable';
export type GridScrollBehavior = 'virtualization' | 'pagination' | 'infinite-scroll';

export type InventoryDataType = 'text' | 'numeric' | 'date' | 'boolean' | 'object';
export type CrudAction = 'create' | 'read' | 'update' | 'delete' | 'save' | 'cancel';
export type CrudPermissionMap = Partial<Record<CrudAction, boolean>>;

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
  requiredDetailFieldKeys?: string[];
  hiddenDetailFieldKeys?: string[];
  defaultVisibleDetailFieldKeys?: string[];
  getRecordId?: (record: TRecord, index: number) => string;
  onRecordSelectionChange?: (event: GridSelectionEvent<TRecord>) => void;
  onScrollPositionChange?: (event: GridScrollEvent) => void;
  onViewModeChange?: (event: GridViewModeEvent) => void;
  onDetailPanelVisibilityChange?: (visible: boolean) => void;
  onLoadMore?: () => void;
  onCreateRecord?: () => void;
  onReadRecord?: (record: TRecord) => void;
  onUpdateRecord?: (record: TRecord) => void;
  onDeleteRecord?: (record: TRecord) => void;
  onSaveRecord?: (record: TRecord) => void;
  onCancelRecord?: (record: TRecord) => void;
  onCrudAction?: (action: CrudAction, record: TRecord | null) => void;
  crudPermissions?: CrudPermissionMap;
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
const DEFAULT_HORIZONTAL_SPLIT = 58;
const DEFAULT_VERTICAL_SPLIT = 54;
const MIN_PANEL_PERCENT = 35;
const MAX_PANEL_PERCENT = 70;

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

function toFieldLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function inferFieldType(value: unknown, key: string): InventoryDataType {
  const normalizedKey = key.toLowerCase();
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'numeric';
  if (normalizedKey.includes('date') || normalizedKey.endsWith('_at') || normalizedKey.includes('expiry')) return 'date';
  if (value instanceof Date) return 'date';
  if (typeof value === 'object' && value !== null) return 'object';
  return 'text';
}

function resolveLinkedItemMasterPill(record: Record<string, unknown>): { partNumber: string | null; itemMasterId: string | null } | null {
  const metadata = record.metadata && typeof record.metadata === 'object'
    ? record.metadata as Record<string, unknown>
    : null;
  if (!metadata) return null;
  const itemMasterId = String(metadata.item_master_id || '').trim() || null;
  const partNumber = String(metadata.item_master_part_number || '').trim() || null;
  if (!itemMasterId && !partNumber) return null;
  return { partNumber, itemMasterId };
}

function toInputDateValue(value: unknown): string {
  if (value == null) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function fieldSection(key: string, fieldType: InventoryDataType): 'identity' | 'inventory' | 'dates' | 'metadata' {
  const normalizedKey = key.toLowerCase();
  if (fieldType === 'object') return 'metadata';
  if (fieldType === 'date' || normalizedKey.includes('expiry') || normalizedKey.endsWith('_at')) return 'dates';
  if (
    normalizedKey.includes('qty')
    || normalizedKey.includes('quantity')
    || normalizedKey.includes('status')
    || normalizedKey.includes('location')
    || normalizedKey.includes('warehouse')
    || normalizedKey.includes('reorder')
    || normalizedKey.includes('cost')
  ) return 'inventory';
  return 'identity';
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
  requiredDetailFieldKeys,
  hiddenDetailFieldKeys,
  defaultVisibleDetailFieldKeys,
  getRecordId,
  onRecordSelectionChange,
  onScrollPositionChange,
  onViewModeChange,
  onDetailPanelVisibilityChange,
  onLoadMore,
  onCreateRecord,
  onReadRecord,
  onUpdateRecord,
  onDeleteRecord,
  onSaveRecord,
  onCancelRecord,
  onCrudAction,
  crudPermissions,
}: AmroInventoryDataGridTemplateProps<TRecord>) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizerRef = useRef<{ columnKey: string; startX: number; startWidth: number } | null>(null);
  const scrollDebounceRef = useRef<number | null>(null);
  const lastViewModePayloadRef = useRef<string | null>(null);
  const panelResizeRef = useRef<{ orientation: 'horizontal' | 'vertical'; start: number; startPct: number } | null>(null);

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
  const [detailFormValues, setDetailFormValues] = useState<Record<string, unknown>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState<'none' | 'grid' | 'detail'>('none');
  const normalizeDetailKey = useCallback((value: string) => value.trim().toLowerCase(), []);
  const requiredDetailFieldSet = useMemo(() => (
    new Set((requiredDetailFieldKeys || []).map(normalizeDetailKey))
  ), [requiredDetailFieldKeys, normalizeDetailKey]);
  const hiddenDetailFieldSet = useMemo(() => (
    new Set((hiddenDetailFieldKeys || []).map(normalizeDetailKey))
  ), [hiddenDetailFieldKeys, normalizeDetailKey]);
  const defaultVisibleDetailFieldSet = useMemo(() => (
    new Set((defaultVisibleDetailFieldKeys || []).map(normalizeDetailKey))
  ), [defaultVisibleDetailFieldKeys, normalizeDetailKey]);
  const [horizontalSplitPct, setHorizontalSplitPct] = useState(DEFAULT_HORIZONTAL_SPLIT);
  const [verticalSplitPct, setVerticalSplitPct] = useState(DEFAULT_VERTICAL_SPLIT);

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
    if (!selectedRecord) {
      setDetailFormValues({});
      return;
    }
    setDetailFormValues({ ...selectedRecord });
    setIsEditing(false);
  }, [selectedRecord]);

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
    if (effectiveViewMode === 'horizontal-split') return 'grid-cols-1 lg:grid-cols-[1fr_auto_1fr]';
    if (effectiveViewMode === 'vertical-split') return 'grid-cols-1 grid-rows-[1fr_auto_1fr]';
    return 'grid-cols-1';
  }, [effectiveViewMode]);

  const detailPanelClassName = useMemo(() => {
    if (effectiveViewMode === 'vertical-split') return 'h-[min(50vh,420px)]';
    if (effectiveViewMode === 'stacked') return 'min-h-[260px]';
    return 'h-[min(68vh,640px)]';
  }, [effectiveViewMode]);
  const gridPanelClassName = useMemo(() => {
    if (effectiveViewMode === 'vertical-split') return 'h-[min(44vh,360px)]';
    if (effectiveViewMode === 'stacked') return 'min-h-[320px]';
    return 'h-[min(68vh,640px)]';
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

  const applyPanelSplit = useCallback((orientation: 'horizontal' | 'vertical', nextPercent: number) => {
    const bounded = Math.max(MIN_PANEL_PERCENT, Math.min(MAX_PANEL_PERCENT, nextPercent));
    if (orientation === 'horizontal') {
      setHorizontalSplitPct(bounded);
    } else {
      setVerticalSplitPct(bounded);
    }
  }, []);

  const onPanelResizeMove = useCallback((event: MouseEvent) => {
    const active = panelResizeRef.current;
    if (!active || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (active.orientation === 'horizontal') {
      const deltaPx = event.clientX - active.start;
      const percentDelta = (deltaPx / Math.max(rect.width, 1)) * 100;
      applyPanelSplit('horizontal', active.startPct + percentDelta);
    } else {
      const deltaPx = event.clientY - active.start;
      const percentDelta = (deltaPx / Math.max(rect.height, 1)) * 100;
      applyPanelSplit('vertical', active.startPct + percentDelta);
    }
  }, [applyPanelSplit]);

  const onPanelResizeEnd = useCallback(() => {
    panelResizeRef.current = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', onPanelResizeMove);
    window.removeEventListener('mouseup', onPanelResizeEnd);
  }, [onPanelResizeMove]);

  const onPanelResizeStart = useCallback((orientation: 'horizontal' | 'vertical', event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    panelResizeRef.current = {
      orientation,
      start: orientation === 'horizontal' ? event.clientX : event.clientY,
      startPct: orientation === 'horizontal' ? horizontalSplitPct : verticalSplitPct,
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize';
    window.addEventListener('mousemove', onPanelResizeMove);
    window.addEventListener('mouseup', onPanelResizeEnd);
  }, [horizontalSplitPct, onPanelResizeEnd, onPanelResizeMove, verticalSplitPct]);

  const gridTemplateStyle = useMemo<React.CSSProperties>(() => {
    if (!detailVisible || effectiveViewMode === 'stacked') return {};
    if (panelCollapsed === 'grid') {
      return effectiveViewMode === 'horizontal-split'
        ? { gridTemplateColumns: '0 min-content 1fr' }
        : { gridTemplateRows: '0 min-content 1fr' };
    }
    if (panelCollapsed === 'detail') {
      return effectiveViewMode === 'horizontal-split'
        ? { gridTemplateColumns: '1fr min-content 0' }
        : { gridTemplateRows: '1fr min-content 0' };
    }
    if (effectiveViewMode === 'horizontal-split') {
      return { gridTemplateColumns: `${horizontalSplitPct}% min-content ${100 - horizontalSplitPct}%` };
    }
    return { gridTemplateRows: `${verticalSplitPct}% min-content ${100 - verticalSplitPct}%` };
  }, [detailVisible, effectiveViewMode, horizontalSplitPct, panelCollapsed, verticalSplitPct]);

  const onSeparatorKeyDown = useCallback((orientation: 'horizontal' | 'vertical', event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowLeft' && orientation === 'horizontal') {
      event.preventDefault();
      applyPanelSplit('horizontal', horizontalSplitPct - 2);
    } else if (event.key === 'ArrowRight' && orientation === 'horizontal') {
      event.preventDefault();
      applyPanelSplit('horizontal', horizontalSplitPct + 2);
    } else if (event.key === 'ArrowUp' && orientation === 'vertical') {
      event.preventDefault();
      applyPanelSplit('vertical', verticalSplitPct - 2);
    } else if (event.key === 'ArrowDown' && orientation === 'vertical') {
      event.preventDefault();
      applyPanelSplit('vertical', verticalSplitPct + 2);
    } else if (event.key === 'Home') {
      event.preventDefault();
      applyPanelSplit(orientation, MIN_PANEL_PERCENT);
    } else if (event.key === 'End') {
      event.preventDefault();
      applyPanelSplit(orientation, MAX_PANEL_PERCENT);
    }
  }, [applyPanelSplit, horizontalSplitPct, verticalSplitPct]);

  const restoreCollapsedPanels = useCallback(() => {
    setPanelCollapsed('none');
    announce('Panels restored');
  }, [announce]);

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

  const statusOptions = useMemo(() => {
    const values = records
      .map((record) => record.status)
      .filter((value): value is string => typeof value === 'string');
    const unique = Array.from(new Set(values));
    return unique.length ? unique : ['available', 'reserved', 'low_stock', 'quarantined', 'unserviceable'];
  }, [records]);

  const resolvedCrudPermissions = useMemo<Record<CrudAction, boolean>>(() => ({
    create: crudPermissions?.create ?? true,
    read: crudPermissions?.read ?? true,
    update: crudPermissions?.update ?? true,
    delete: crudPermissions?.delete ?? true,
    save: crudPermissions?.save ?? true,
    cancel: crudPermissions?.cancel ?? true,
  }), [crudPermissions]);

  const canExecuteCrud = useCallback((action: CrudAction) => {
    if (!resolvedCrudPermissions[action]) return false;
    if (action === 'create') return true;
    if (action === 'save' || action === 'cancel') return isEditing;
    return Boolean(selectedRecord);
  }, [isEditing, resolvedCrudPermissions, selectedRecord]);

  const handleCrud = useCallback((action: CrudAction, options?: { confirmedDelete?: boolean }) => {
    if (!canExecuteCrud(action)) return;
    const typedRecord = selectedRecord ? (detailFormValues as TRecord) : null;
    onCrudAction?.(action, typedRecord);
    if (action === 'create') {
      onCreateRecord?.();
      announce('create action executed');
      return;
    }
    if (!typedRecord) return;
    if (action === 'read') onReadRecord?.(typedRecord);
    if (action === 'update') {
      setIsEditing(true);
      onUpdateRecord?.(typedRecord);
    }
    if (action === 'delete') {
      if (!options?.confirmedDelete) {
        setDeleteConfirmOpen(true);
        announce('delete confirmation requested');
        return;
      }
      onDeleteRecord?.(typedRecord);
      setDeleteConfirmOpen(false);
    }
    if (action === 'save') {
      setIsEditing(false);
      onSaveRecord?.(typedRecord);
    }
    if (action === 'cancel') {
      setDetailFormValues({ ...selectedRecord });
      setIsEditing(false);
      onCancelRecord?.(typedRecord);
    }
    announce(`${action} action executed`);
  }, [
    canExecuteCrud,
    announce,
    detailFormValues,
    onCancelRecord,
    onCreateRecord,
    onCrudAction,
    onDeleteRecord,
    onReadRecord,
    onSaveRecord,
    onUpdateRecord,
    selectedRecord,
  ]);

  const handleWorkspaceShortcut = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      restoreCollapsedPanels();
      return;
    }
    if (!detailVisible) return;
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      handleCrud('create');
      return;
    }
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'r') {
      event.preventDefault();
      handleCrud('read');
      return;
    }
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'u') {
      event.preventDefault();
      handleCrud('update');
      return;
    }
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      handleCrud('delete');
      return;
    }
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === 's') {
      event.preventDefault();
      handleCrud('save');
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCrud('cancel');
    }
  }, [detailVisible, handleCrud, restoreCollapsedPanels]);

  const renderDetailField = useCallback((key: string, value: unknown) => {
    const fieldType = inferFieldType(value, key);
    const label = toFieldLabel(key);
    const normalizedKey = key.toLowerCase();
    const required = requiredDetailFieldSet.size > 0
      ? requiredDetailFieldSet.has(normalizedKey)
      : normalizedKey.includes('id') || normalizedKey.includes('part') || normalizedKey.includes('quantity');
    const currentValue = detailFormValues[key];

    if (fieldType === 'boolean') {
      const fieldId = `detail-${key}`;
      
      return (
        <div key={key} className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <Label htmlFor={fieldId} className="text-xs font-semibold text-muted-foreground">
              {label}
              {required ? <span className="ml-1 text-destructive">*</span> : null}
            </Label>
            <Switch
              id={fieldId}
              checked={Boolean(currentValue)}
              disabled={!isEditing}
              onCheckedChange={(checked) => setDetailFormValues((current) => ({ ...current, [key]: checked }))}
              // Issue AC-02: ARIA attributes for switch
              aria-label={`${label} toggle`}
              aria-required={required || undefined}
            />
          </div>
        </div>
      );
    }

    if (fieldType === 'numeric') {
      const invalid = Number.isNaN(Number(currentValue ?? 0));
      const fieldId = `detail-${key}`;
      const errorId = invalid ? `${fieldId}-error` : undefined;
      
      return (
        <div key={key} className="space-y-2 rounded-md border p-3">
          <Label htmlFor={fieldId} className="text-xs font-semibold text-muted-foreground">
            {label}
            {required ? <span className="ml-1 text-destructive">*</span> : null}
          </Label>
          <Input
            id={fieldId}
            type="number"
            value={currentValue == null ? '' : String(currentValue)}
            disabled={!isEditing}
            onChange={(event) => setDetailFormValues((current) => ({ ...current, [key]: Number(event.target.value) }))}
            // Issue AC-02: ARIA error association
            aria-invalid={invalid}
            aria-describedby={errorId}
            aria-required={required || undefined}
          />
          {invalid ? (
            <p id={errorId} className="text-xs text-destructive" role="alert">
              Invalid numeric value
            </p>
          ) : null}
        </div>
      );
    }

    if (fieldType === 'date') {
      const fieldId = `detail-${key}`;
      const invalid = currentValue && isNaN(new Date(String(currentValue)).getTime());
      const errorId = invalid ? `${fieldId}-error` : undefined;
      
      return (
        <div key={key} className="space-y-2 rounded-md border p-3">
          <Label htmlFor={fieldId} className="text-xs font-semibold text-muted-foreground">
            {label}
            {required ? <span className="ml-1 text-destructive">*</span> : null}
          </Label>
          <Input
            id={fieldId}
            type="date"
            value={toInputDateValue(currentValue)}
            disabled={!isEditing}
            onChange={(event) => setDetailFormValues((current) => ({ ...current, [key]: event.target.value }))}
            // Issue AC-02: ARIA error association
            aria-invalid={!!invalid}
            aria-describedby={errorId}
            aria-required={required || undefined}
          />
          {invalid ? (
            <p id={errorId} className="text-xs text-destructive" role="alert">
              Invalid date format
            </p>
          ) : null}
        </div>
      );
    }

    if (normalizedKey.includes('status')) {
      const selected = String(currentValue ?? '');
      const fallback = selected && !statusOptions.includes(selected) ? [selected, ...statusOptions] : statusOptions;
      const fieldId = `detail-${key}`;
      
      return (
        <div key={key} className="space-y-2 rounded-md border p-3">
          <Label htmlFor={fieldId} className="text-xs font-semibold text-muted-foreground">
            {label}
            {required ? <span className="ml-1 text-destructive">*</span> : null}
          </Label>
          <Select
            value={selected || fallback[0]}
            onValueChange={(next) => setDetailFormValues((current) => ({ ...current, [key]: next }))}
            disabled={!isEditing}
          >
            <SelectTrigger 
              id={fieldId} 
              // Issue AC-02: ARIA attributes for select
              aria-label={label}
              aria-required={required || undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fallback.map((option) => (
                <SelectItem key={`${key}:${option}`} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (fieldType === 'object') {
      const fieldId = `detail-${key}`;
      let invalid = false;
      try {
        if (typeof currentValue === 'string') {
          JSON.parse(currentValue);
        }
      } catch {
        invalid = true;
      }
      const errorId = invalid ? `${fieldId}-error` : undefined;
      
      return (
        <div key={key} className="space-y-2 rounded-md border p-3 md:col-span-2">
          <Label htmlFor={fieldId} className="text-xs font-semibold text-muted-foreground">
            {label}
            {required ? <span className="ml-1 text-destructive">*</span> : null}
          </Label>
          <Textarea
            id={fieldId}
            value={JSON.stringify(currentValue ?? {}, null, 2)}
            disabled={!isEditing}
            rows={6}
            onChange={(event) => {
              const text = event.target.value;
              try {
                const parsed = JSON.parse(text);
                setDetailFormValues((current) => ({ ...current, [key]: parsed }));
              } catch {
                setDetailFormValues((current) => ({ ...current, [key]: text }));
              }
            }}
            // Issue AC-02: ARIA error association
            aria-invalid={invalid}
            aria-describedby={errorId}
            aria-required={required || undefined}
          />
          {invalid ? (
            <p id={errorId} className="text-xs text-destructive" role="alert">
              Invalid JSON format
            </p>
          ) : null}
        </div>
      );
    }

    const isLongText = String(currentValue ?? '').length > 64 || normalizedKey.includes('description') || normalizedKey.includes('notes');
    const fieldId = `detail-${key}`;
    
    return (
      <div key={key} className={cn('space-y-2 rounded-md border p-3', isLongText ? 'md:col-span-2' : '')}>
        <Label htmlFor={fieldId} className="text-xs font-semibold text-muted-foreground">
          {label}
          {required ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>
        {isLongText ? (
          <Textarea
            id={fieldId}
            value={String(currentValue ?? '')}
            disabled={!isEditing}
            rows={3}
            onChange={(event) => setDetailFormValues((current) => ({ ...current, [key]: event.target.value }))}
            // Issue AC-02: ARIA attributes for textarea
            aria-required={required || undefined}
          />
        ) : (
          <Input
            id={fieldId}
            value={String(currentValue ?? '')}
            disabled={!isEditing}
            onChange={(event) => setDetailFormValues((current) => ({ ...current, [key]: event.target.value }))}
            // Issue AC-02: ARIA attributes for input
            aria-required={required || undefined}
          />
        )}
      </div>
    );
  }, [detailFormValues, isEditing, requiredDetailFieldSet, statusOptions]);

  const renderDefaultDetail = (record: TRecord) => {
    const entries = Object.entries(record).filter(([key]) => {
      const normalizedKey = normalizeDetailKey(key);
      if (hiddenDetailFieldSet.has(normalizedKey)) return false;
      if (defaultVisibleDetailFieldSet.size > 0 && !defaultVisibleDetailFieldSet.has(normalizedKey)) return false;
      return true;
    });
    const sections: Array<{ id: 'identity' | 'inventory' | 'dates' | 'metadata'; title: string }> = [
      { id: 'identity', title: 'Identity' },
      { id: 'inventory', title: 'Inventory and Operations' },
      { id: 'dates', title: 'Dates and Validity' },
      { id: 'metadata', title: 'Metadata and Extended Attributes' },
    ];
    const visibleSections = sections
      .map((section) => ({
        ...section,
        fields: entries.filter(([key, value]) => fieldSection(key, inferFieldType(value, key)) === section.id),
      }))
      .filter((section) => section.fields.length > 0);

    return (
      <div className="record-detail-section-stack space-y-3">
        <div
          className="record-detail-separator-box relative z-10 flex min-h-8 items-center rounded-md border border-border/80 bg-background px-2.5 py-1.5 shadow-sm"
          role="separator"
          aria-label="Record detail sections"
          data-testid="record-detail-separator-box"
        >
          <span className="record-detail-separator-label shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Record Detail Sections
          </span>
          <span className="ml-2 h-px flex-1 bg-border" aria-hidden />
        </div>
        {visibleSections.map((section, index) => {
          return (
            <React.Fragment key={section.id}>
              {index > 0 ? (
                <div
                  className="record-detail-separator-box relative z-10 flex min-h-8 items-center rounded-md border border-border/80 bg-background px-2.5 py-1.5 shadow-sm"
                  role="separator"
                  aria-label={`Separator before ${section.title}`}
                  data-testid="record-detail-separator-box"
                >
                  <span className="record-detail-separator-label shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.title}
                  </span>
                  <span className="ml-2 h-px flex-1 bg-border" aria-hidden />
                </div>
              ) : null}
              <section className="record-detail-section-box relative z-10 space-y-2 rounded-md border border-border/70 bg-background p-2.5 md:p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {section.fields.map(([key, value]) => renderDetailField(key, value))}
                </div>
              </section>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

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
          {detailVisible && panelCollapsed !== 'none' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={restoreCollapsedPanels}
              aria-label="Restore collapsed panels"
            >
              <PanelLeftOpen className="mr-1.5 h-4 w-4" />
              Restore Panel
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent data-testid="inventory-workspace-content" onKeyDownCapture={handleWorkspaceShortcut}>
        <div
          ref={containerRef}
          className={cn(
          'relative isolate grid gap-4 overflow-hidden transition-[grid-template-columns,grid-template-rows,opacity,transform] duration-300 ease-in-out',
          gridAreaClassName,
          )}
          style={gridTemplateStyle}
        >
          {detailVisible && panelCollapsed !== 'none' ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="absolute right-2 top-2 z-30 shadow-sm"
                    aria-label="Restore collapsed panels"
                    aria-keyshortcuts="Control+Shift+E Meta+Shift+E"
                    onClick={restoreCollapsedPanels}
                  >
                    <PanelLeftOpen className="mr-1.5 h-4 w-4" />
                    Restore Panel
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Restore collapsed panels (Ctrl/Cmd + Shift + E)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}

          <div
            className={cn('min-w-0 overflow-hidden rounded-md border transition-all duration-300', highContrastClassName, gridPanelClassName)}
            onKeyDown={handleKeyboardNavigation}
            role="region"
            aria-label={ariaLabel}
          >
            {headerRow}
            <div
              ref={listRef}
              className={cn(
                'h-full overflow-auto',
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

          {detailVisible && effectiveViewMode !== 'stacked' ? (
            <button
              type="button"
              role="separator"
              aria-label={effectiveViewMode === 'horizontal-split' ? 'Resize grid and detail panels horizontally' : 'Resize grid and detail panels vertically'}
              aria-orientation={effectiveViewMode === 'horizontal-split' ? 'vertical' : 'horizontal'}
              aria-valuemin={MIN_PANEL_PERCENT}
              aria-valuemax={MAX_PANEL_PERCENT}
              aria-valuenow={effectiveViewMode === 'horizontal-split' ? horizontalSplitPct : verticalSplitPct}
              className={cn(
                'group relative z-0 flex items-center justify-center rounded bg-transparent transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                effectiveViewMode === 'horizontal-split' ? 'w-3 cursor-col-resize' : 'h-3 cursor-row-resize',
              )}
              onMouseDown={(event) => onPanelResizeStart(effectiveViewMode === 'horizontal-split' ? 'horizontal' : 'vertical', event)}
              onKeyDown={(event) => onSeparatorKeyDown(effectiveViewMode === 'horizontal-split' ? 'horizontal' : 'vertical', event)}
            >
              <span className="sr-only">Use arrow keys to resize panel split</span>
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute rounded-full bg-border/80 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 group-focus-visible:opacity-100',
                  effectiveViewMode === 'horizontal-split' ? 'inset-y-0 left-1/2 w-px -translate-x-1/2' : 'inset-x-0 top-1/2 h-px -translate-y-1/2',
                )}
              />
              {effectiveViewMode === 'horizontal-split' ? (
                <GripVertical className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
              ) : (
                <GripHorizontal className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
              )}
            </button>
          ) : null}

          {detailVisible ? (
            <div
              className={cn(
                'relative z-10 min-w-0 rounded-md bg-border/90 p-[1px] pr-[2px] transition-all duration-300',
                detailPanelClassName,
                highContrastClassName,
              )}
            >
              <div
                className="relative h-full overflow-hidden rounded-[inherit] bg-background p-3"
                style={{ boxShadow: 'inset -2px 0 0 hsl(var(--border))' }}
              >
                <span
                  aria-hidden
                  data-testid="record-detail-right-border"
                  className="pointer-events-none absolute inset-y-0 right-0 z-20 w-[2px] rounded-r-[inherit] bg-slate-300/95 dark:bg-slate-500/80"
                />
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Record Detail</h3>
                  <p className="text-xs text-muted-foreground">Shortcuts: Alt+Shift+C/R/U/D, Alt+Shift+S, Esc</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label="Create record"
                          aria-keyshortcuts="Alt+Shift+C"
                          disabled={!canExecuteCrud('create')}
                          onClick={() => handleCrud('create')}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Create (Alt+Shift+C)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label="Read record"
                          aria-keyshortcuts="Alt+Shift+R"
                          disabled={!canExecuteCrud('read')}
                          onClick={() => handleCrud('read')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Read (Alt+Shift+R)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant={isEditing ? 'default' : 'outline'}
                          aria-label="Update record"
                          aria-keyshortcuts="Alt+Shift+U"
                          disabled={!canExecuteCrud('update')}
                          onClick={() => handleCrud('update')}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Update (Alt+Shift+U)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label="Delete record"
                          aria-keyshortcuts="Alt+Shift+D"
                          disabled={!canExecuteCrud('delete')}
                          onClick={() => handleCrud('delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete (Alt+Shift+D)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="default"
                          aria-label="Save record"
                          aria-keyshortcuts="Alt+Shift+S"
                          disabled={!canExecuteCrud('save')}
                          onClick={() => handleCrud('save')}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Save (Alt+Shift+S)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label="Cancel changes"
                          aria-keyshortcuts="Escape"
                          disabled={!canExecuteCrud('cancel')}
                          onClick={() => handleCrud('cancel')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Cancel (Esc)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="mx-1 h-5 w-px bg-border" />
                  <div className="flex items-center gap-1">
                  {effectiveViewMode !== 'stacked' ? (
                    <>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={panelCollapsed === 'grid' ? 'Expand grid panel' : 'Collapse grid panel'}
                        onClick={() => setPanelCollapsed((current) => current === 'grid' ? 'none' : 'grid')}
                      >
                        {panelCollapsed === 'grid' ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={panelCollapsed === 'detail' ? 'Expand detail panel' : 'Collapse detail panel'}
                        onClick={() => setPanelCollapsed((current) => current === 'detail' ? 'none' : 'detail')}
                      >
                        {panelCollapsed === 'detail'
                          ? <PanelBottomOpen className="h-4 w-4" />
                          : <PanelBottomClose className="h-4 w-4" />}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              </div>
              {selectedRecord ? (
                <div className="h-full overflow-auto overflow-x-hidden pr-1">
                  {(() => {
                    const linked = resolveLinkedItemMasterPill(selectedRecord);
                    if (!linked) return null;
                    return (
                      <div className="mb-2">
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                          Linked Item Master: {linked.partNumber || linked.itemMasterId}
                        </Badge>
                      </div>
                    );
                  })()}
                  {renderDetail ? renderDetail(selectedRecord) : renderDefaultDetail(selectedRecord)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a record to view details.</p>
              )}
              </div>
            </div>
          ) : null}
        </div>

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Record?</AlertDialogTitle>
              <AlertDialogDescription>
                This operation is destructive and may affect downstream inventory reconciliation records.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleCrud('delete', { confirmedDelete: true })}>
                Confirm Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>

      <div className="sr-only" aria-live="polite">
        {screenReaderMessage}
      </div>
    </Card>
  );
}

export default AmroInventoryDataGridTemplate;
