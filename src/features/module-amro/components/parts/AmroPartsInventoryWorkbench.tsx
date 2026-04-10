import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, Boxes, ChevronDown, ChevronUp, Download, Loader2, Pencil, RefreshCcw, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  type AmroInventoryDataGridTemplateProps,
  type GridColumnDefinition,
  type GridDensity,
  type GridScrollBehavior,
  type GridViewMode,
} from '../templates/AmroInventoryDataGridTemplate';
import { AmroUnifiedGridRecordDetailShell } from './AmroUnifiedGridRecordDetailShell';
import {
  computePartInventoryMetrics,
  type PartInventoryRecord,
} from './mockPartsInventoryData';
import {
  PARTS_DETAIL_DEFAULT_VISIBLE_KEYS,
  PARTS_DETAIL_HIDDEN_KEYS,
  PARTS_DETAIL_REQUIRED_KEYS,
  PARTS_STATUS_FILTER_OPTIONS,
} from './partsDetailSchema';

export type PartsInventoryViewState = 'loading' | 'empty' | 'ready' | 'error';

export interface AmroPartsInventoryWorkbenchProps {
  records: PartInventoryRecord[];
  state?: PartsInventoryViewState;
  errorMessage?: string;
  title?: string;
  subtitle?: string;
  viewMode?: GridViewMode;
  density?: GridDensity;
  scrollBehavior?: GridScrollBehavior;
  pageSize?: number;
  persistKey?: string;
  onRetry?: () => void;
  onRefresh?: () => void;
  onCreatePart?: () => void;
  onCreateRecord?: AmroInventoryDataGridTemplateProps<PartInventoryRecord>['onCreateRecord'];
  onReadRecord?: AmroInventoryDataGridTemplateProps<PartInventoryRecord>['onReadRecord'];
  onUpdateRecord?: AmroInventoryDataGridTemplateProps<PartInventoryRecord>['onUpdateRecord'];
  onDeleteRecord?: AmroInventoryDataGridTemplateProps<PartInventoryRecord>['onDeleteRecord'];
  onSaveRecord?: AmroInventoryDataGridTemplateProps<PartInventoryRecord>['onSaveRecord'];
  onCancelRecord?: AmroInventoryDataGridTemplateProps<PartInventoryRecord>['onCancelRecord'];
  onCrudAction?: AmroInventoryDataGridTemplateProps<PartInventoryRecord>['onCrudAction'];
  crudPermissions?: AmroInventoryDataGridTemplateProps<PartInventoryRecord>['crudPermissions'];
  onRecordSelectionChange?: AmroInventoryDataGridTemplateProps<PartInventoryRecord>['onRecordSelectionChange'];
  onScrollPositionChange?: AmroInventoryDataGridTemplateProps<PartInventoryRecord>['onScrollPositionChange'];
  onViewModeChange?: AmroInventoryDataGridTemplateProps<PartInventoryRecord>['onViewModeChange'];
  canExport?: boolean;
  canManageAlerts?: boolean;
  canShowTourAgain?: boolean;
}

type GroupingKey = 'item_type' | 'supplier_name' | 'warehouse_location' | 'criticality' | 'status' | 'reorder_band';
type RiskBand = 'healthy' | 'watch' | 'critical';
type StockSignal = 'all' | 'low' | 'critical';
type EasyModePreset = 'all' | 'shortage-risk' | 'critical-only' | 'reorder-due';
type WarehouseStatusSort = 'risk_desc' | 'available_desc';
type AlertSort = 'severity_desc' | 'severity_asc';
type LowStockAlertGroup = { key: string; location: string; records: PartInventoryRecord[] };

const GROUPING_OPTIONS: Array<{ value: GroupingKey; label: string }> = [
  { value: 'item_type', label: 'Part Type' },
  { value: 'supplier_name', label: 'Supplier' },
  { value: 'warehouse_location', label: 'Location' },
  { value: 'criticality', label: 'Criticality' },
  { value: 'status', label: 'Stock Status' },
  { value: 'reorder_band', label: 'Reorder Band' },
];

const TREND_MONTHS = ['M-5', 'M-4', 'M-3', 'M-2', 'M-1', 'Current'];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function computeRiskBand(row: PartInventoryRecord): RiskBand {
  const forecast30d = Math.max(1, toNumber((row.metadata as Record<string, unknown> | undefined)?.demand_forecast_30d, row.reorder_quantity * 2));
  const leadTimeDays = Math.max(1, toNumber((row.metadata as Record<string, unknown> | undefined)?.lead_time_days, 14));
  const dailyDemand = Math.max(0.1, forecast30d / 30);
  const projectedDaysCover = row.quantity_available / dailyDemand;
  if (projectedDaysCover <= leadTimeDays * 0.75 || row.quantity_available <= row.min_serviceable_qty) return 'critical';
  if (projectedDaysCover <= leadTimeDays * 1.3 || row.quantity_available <= row.reorder_level) return 'watch';
  return 'healthy';
}

function computeReorderBand(row: PartInventoryRecord): 'critical_reorder' | 'reorder_due' | 'healthy_stock' {
  if (row.quantity_available <= row.min_serviceable_qty) return 'critical_reorder';
  if (row.quantity_available <= row.reorder_level) return 'reorder_due';
  return 'healthy_stock';
}

function metricTone(value: number, warningThreshold: number, criticalThreshold: number): 'default' | 'secondary' | 'destructive' {
  if (value >= criticalThreshold) return 'destructive';
  if (value >= warningThreshold) return 'secondary';
  return 'default';
}

export function AmroPartsInventoryWorkbench({
  records,
  state = 'ready',
  errorMessage = 'Unable to load parts inventory data.',
  title = 'Parts Inventory Operations',
  subtitle = 'Monitor stock levels, reservations, serviceability, and reorder pressure.',
  viewMode = 'horizontal-split',
  density = 'normal',
  scrollBehavior = 'virtualization',
  pageSize = 20,
  persistKey = 'amro-parts-inventory-workbench',
  onRetry,
  onRefresh,
  onCreatePart,
  onCreateRecord,
  onReadRecord,
  onUpdateRecord,
  onDeleteRecord,
  onSaveRecord,
  onCancelRecord,
  onCrudAction,
  crudPermissions,
  onRecordSelectionChange,
  onScrollPositionChange,
  onViewModeChange,
  canExport = true,
  canManageAlerts = true,
  canShowTourAgain = false,
}: AmroPartsInventoryWorkbenchProps) {
  const [statusFilter, setStatusFilter] = useState<(typeof PARTS_STATUS_FILTER_OPTIONS)[number]>('all');
  const [criticalityFilter, setCriticalityFilter] = useState<'all' | PartInventoryRecord['criticality']>('all');
  const [itemTypeFilter, setItemTypeFilter] = useState<'all' | PartInventoryRecord['item_type']>('all');
  const [supplierFilter, setSupplierFilter] = useState<'all' | string>('all');
  const [locationFilter, setLocationFilter] = useState<'all' | string>('all');
  const [stockSignalFilter, setStockSignalFilter] = useState<StockSignal>('all');
  const [riskBandFilter, setRiskBandFilter] = useState<'all' | RiskBand>('all');
  const [erpLinkedOnly, setErpLinkedOnly] = useState<'all' | 'linked'>('all');
  const [groupBy, setGroupBy] = useState<GroupingKey>('item_type');
  const [searchText, setSearchText] = useState('');
  const [easyMode, setEasyMode] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [easyPreset, setEasyPreset] = useState<EasyModePreset>('all');
  const [preferredViewMode, setPreferredViewMode] = useState<GridViewMode>(viewMode);
  const [showGuidedTour, setShowGuidedTour] = useState(false);
  const [warehousePanelCollapsed, setWarehousePanelCollapsed] = useState(false);
  const [alertsPanelCollapsed, setAlertsPanelCollapsed] = useState(false);
  const [recordsPanelCollapsed, setRecordsPanelCollapsed] = useState(false);
  const [selectedWarehouseRecordByLocation, setSelectedWarehouseRecordByLocation] = useState<Record<string, string>>({});
  const [selectedWarehouseBulkByLocation, setSelectedWarehouseBulkByLocation] = useState<Record<string, string[]>>({});
  const [warehouseVisibleCountByLocation, setWarehouseVisibleCountByLocation] = useState<Record<string, number>>({});
  const [warehouseStatusSort, setWarehouseStatusSort] = useState<WarehouseStatusSort>('risk_desc');
  const [warehouseRecordSearch, setWarehouseRecordSearch] = useState('');
  const [alertSort, setAlertSort] = useState<AlertSort>('severity_desc');
  const [alertRecordSearch, setAlertRecordSearch] = useState('');
  const [selectedAlertRecordByGroup, setSelectedAlertRecordByGroup] = useState<Record<string, string>>({});
  const [selectedAlertBulkByGroup, setSelectedAlertBulkByGroup] = useState<Record<string, string[]>>({});
  const [alertVisibleCountByGroup, setAlertVisibleCountByGroup] = useState<Record<string, number>>({});
  const [editOpsNotice, setEditOpsNotice] = useState<string | null>(null);

  const guidedTourStorageKey = useMemo(() => `amro-parts-guided-tour-dismissed:${persistKey}`, [persistKey]);
  const panelStateStorageKey = useMemo(() => `amro-parts-panel-state:${persistKey}`, [persistKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = window.localStorage.getItem(guidedTourStorageKey) === '1';
    if (!dismissed) {
      setShowGuidedTour(true);
    }
  }, [guidedTourStorageKey]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(panelStateStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        warehousePanelCollapsed?: boolean;
        alertsPanelCollapsed?: boolean;
        recordsPanelCollapsed?: boolean;
      };
      setWarehousePanelCollapsed(Boolean(parsed.warehousePanelCollapsed));
      setAlertsPanelCollapsed(Boolean(parsed.alertsPanelCollapsed));
      setRecordsPanelCollapsed(Boolean(parsed.recordsPanelCollapsed));
    } catch {
      // ignore invalid localStorage payload
    }
  }, [panelStateStorageKey]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      panelStateStorageKey,
      JSON.stringify({ warehousePanelCollapsed, alertsPanelCollapsed, recordsPanelCollapsed }),
    );
  }, [alertsPanelCollapsed, panelStateStorageKey, recordsPanelCollapsed, warehousePanelCollapsed]);
  useEffect(() => {
    if (!onRefresh) return;
    const timer = window.setInterval(() => {
      onRefresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [onRefresh]);

  useEffect(() => {
    setPreferredViewMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (easyPreset === 'all') {
      setStatusFilter('all');
      setStockSignalFilter('all');
      setRiskBandFilter('all');
      setCriticalityFilter('all');
      return;
    }
    if (easyPreset === 'shortage-risk') {
      setStockSignalFilter('low');
      setRiskBandFilter('watch');
      setStatusFilter('all');
      setCriticalityFilter('all');
      return;
    }
    if (easyPreset === 'critical-only') {
      setStockSignalFilter('critical');
      setRiskBandFilter('critical');
      setCriticalityFilter('critical');
      setStatusFilter('all');
      return;
    }
    if (easyPreset === 'reorder-due') {
      setStockSignalFilter('low');
      setRiskBandFilter('all');
      setStatusFilter('low_stock');
      setCriticalityFilter('all');
    }
  }, [easyPreset]);

  const columns = useMemo<GridColumnDefinition<PartInventoryRecord>[]>(() => [
    {
      key: 'part_number',
      header: 'Part Number',
      sortable: true,
      filterable: true,
      groupable: true,
      resizable: true,
      dataType: 'text',
      width: 220,
      render: (row) => (
        <div className="flex items-center gap-2">
          <span>{row.part_number}</span>
          {row.metadata.item_master_id ? (
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              Linked Item Master
            </Badge>
          ) : null}
        </div>
      ),
    },
    { key: 'serial_number', header: 'Serial', sortable: true, filterable: true, groupable: false, resizable: true, dataType: 'text', width: 150 },
    { key: 'description', header: 'Description', sortable: true, filterable: true, groupable: false, resizable: true, dataType: 'text', width: 240 },
    { key: 'item_type', header: 'Type', sortable: true, filterable: true, groupable: true, resizable: true, dataType: 'text', width: 120 },
    { key: 'ata_chapter', header: 'ATA', sortable: true, filterable: true, groupable: true, resizable: true, dataType: 'text', width: 90 },
    { key: 'quantity_on_hand', header: 'On Hand', sortable: true, filterable: false, groupable: false, resizable: true, dataType: 'numeric', width: 110 },
    { key: 'quantity_reserved', header: 'Reserved', sortable: true, filterable: false, groupable: false, resizable: true, dataType: 'numeric', width: 110 },
    { key: 'quantity_available', header: 'Available', sortable: true, filterable: false, groupable: false, resizable: true, dataType: 'numeric', width: 110 },
    { key: 'warehouse_location', header: 'Location', sortable: true, filterable: true, groupable: true, resizable: true, dataType: 'text', width: 120 },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      filterable: true,
      groupable: true,
      resizable: true,
      dataType: 'text',
      width: 130,
      render: (row) => (
        <Badge variant={row.status === 'quarantined' || row.status === 'unserviceable' ? 'destructive' : row.status === 'low_stock' ? 'secondary' : 'default'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'criticality',
      header: 'Criticality',
      sortable: true,
      filterable: true,
      groupable: true,
      resizable: true,
      dataType: 'text',
      width: 130,
      render: (row) => (
        <Badge variant={row.criticality === 'critical' ? 'destructive' : row.criticality === 'high' ? 'secondary' : 'outline'}>
          {row.criticality}
        </Badge>
      ),
    },
    {
      key: 'metadata',
      header: 'Tags',
      sortable: false,
      filterable: true,
      groupable: false,
      resizable: true,
      dataType: 'object',
      width: 200,
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.metadata.tags.slice(0, 3).map((tag) => (
            <Badge key={`${row.id}:${tag}`} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      ),
    },
  ], []);

  const supplierOptions = useMemo(
    () => Array.from(new Set(records.map((record) => String(record.supplier_name || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [records],
  );
  const locationOptions = useMemo(
    () => Array.from(new Set(records.map((record) => String(record.warehouse_location || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [records],
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    return records.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (criticalityFilter !== 'all' && row.criticality !== criticalityFilter) return false;
      if (itemTypeFilter !== 'all' && row.item_type !== itemTypeFilter) return false;
      if (supplierFilter !== 'all' && row.supplier_name !== supplierFilter) return false;
      if (locationFilter !== 'all' && row.warehouse_location !== locationFilter) return false;
      if (stockSignalFilter === 'low' && !(row.quantity_available <= row.reorder_level || row.status === 'low_stock')) return false;
      if (stockSignalFilter === 'critical' && !(row.quantity_available <= row.min_serviceable_qty || row.criticality === 'critical')) return false;
      const riskBand = computeRiskBand(row);
      if (riskBandFilter !== 'all' && riskBand !== riskBandFilter) return false;
      if (erpLinkedOnly === 'linked' && !row.metadata.item_master_id) return false;
      if (normalizedSearch) {
        const searchable = [
          row.part_number,
          row.description,
          row.supplier_name,
          row.warehouse_location,
          row.ata_chapter,
          row.item_type,
          row.status,
          row.criticality,
        ].join(' ').toLowerCase();
        if (!searchable.includes(normalizedSearch)) return false;
      }
      return true;
    });
  }, [records, statusFilter, criticalityFilter, itemTypeFilter, supplierFilter, locationFilter, stockSignalFilter, riskBandFilter, erpLinkedOnly, searchText]);

  const metrics = useMemo(() => computePartInventoryMetrics(filteredRecords), [filteredRecords]);

  const statusDistribution = useMemo(() => {
    const map = new Map<PartInventoryRecord['status'], number>();
    for (const row of filteredRecords) {
      map.set(row.status, (map.get(row.status) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredRecords]);

  const groupedSummary = useMemo(() => {
    const groups = new Map<string, { label: string; count: number; availableQty: number; value: number; lowStock: number }>();
    for (const row of filteredRecords) {
      const reorderBand = computeReorderBand(row);
      const keyValue = groupBy === 'reorder_band'
        ? reorderBand
        : String(row[groupBy] || 'Unassigned');
      const current = groups.get(keyValue) || { label: keyValue, count: 0, availableQty: 0, value: 0, lowStock: 0 };
      current.count += 1;
      current.availableQty += row.quantity_available;
      current.value += row.quantity_on_hand * row.unit_cost;
      if (row.quantity_available <= row.reorder_level || row.status === 'low_stock') current.lowStock += 1;
      groups.set(keyValue, current);
    }
    return Array.from(groups.values()).sort((left, right) => right.count - left.count);
  }, [filteredRecords, groupBy]);

  const criticalAlerts = useMemo(
    () =>
      filteredRecords
        .filter((row) => computeRiskBand(row) === 'critical')
        .sort((left, right) => (left.quantity_available - left.min_serviceable_qty) - (right.quantity_available - right.min_serviceable_qty))
        .slice(0, 8),
    [filteredRecords],
  );
  const sortedCriticalAlerts = useMemo(() => {
    const rows = [...criticalAlerts];
    if (alertSort === 'severity_asc') {
      return rows.sort((left, right) => (left.quantity_available - left.min_serviceable_qty) - (right.quantity_available - right.min_serviceable_qty));
    }
    return rows.sort((left, right) => (right.min_serviceable_qty - right.quantity_available) - (left.min_serviceable_qty - left.quantity_available));
  }, [alertSort, criticalAlerts]);
  const normalizedWarehouseRecordSearch = warehouseRecordSearch.trim().toLowerCase();
  const normalizedAlertRecordSearch = alertRecordSearch.trim().toLowerCase();
  const lowStockAlertGroups = useMemo<LowStockAlertGroup[]>(() => {
    const map = new Map<string, PartInventoryRecord[]>();
    for (const row of sortedCriticalAlerts) {
      const location = row.warehouse_location || 'UNASSIGNED';
      const key = location;
      const bucket = map.get(key) || [];
      bucket.push(row);
      map.set(key, bucket);
    }
    return Array.from(map.entries())
      .map(([key, groupRecords]) => ({
        key,
        location: key,
        records: groupRecords.filter((record) => {
          if (!normalizedAlertRecordSearch) return true;
          const searchable = `${record.part_number} ${record.description} ${record.supplier_name} ${record.warehouse_location}`.toLowerCase();
          return searchable.includes(normalizedAlertRecordSearch);
        }),
      }))
      .filter((group) => group.records.length > 0);
  }, [sortedCriticalAlerts, normalizedAlertRecordSearch]);

  const locationCriticalityHeatmap = useMemo(() => {
    const grid = new Map<string, Map<string, number>>();
    for (const row of filteredRecords) {
      const location = row.warehouse_location || 'UNASSIGNED';
      const severity = row.criticality || 'normal';
      const locationMap = grid.get(location) || new Map<string, number>();
      locationMap.set(severity, (locationMap.get(severity) || 0) + 1);
      grid.set(location, locationMap);
    }
    return Array.from(grid.entries()).map(([location, severityMap]) => ({
      location,
      critical: severityMap.get('critical') || 0,
      high: severityMap.get('high') || 0,
      normal: severityMap.get('normal') || 0,
      low: severityMap.get('low') || 0,
      total: (severityMap.get('critical') || 0) + (severityMap.get('high') || 0) + (severityMap.get('normal') || 0) + (severityMap.get('low') || 0),
    }));
  }, [filteredRecords]);
  const warehouseStatusSummary = useMemo(() => {
    const rows = locationCriticalityHeatmap.map((entry) => {
      const warehouseRows = filteredRecords.filter((row) => (row.warehouse_location || 'UNASSIGNED') === entry.location);
      const availableQty = warehouseRows.reduce((sum, row) => sum + row.quantity_available, 0);
      const riskScore = entry.critical * 3 + entry.high * 2 + entry.normal;
      return {
        ...entry,
        availableQty,
        riskScore,
      };
    });
    if (warehouseStatusSort === 'available_desc') {
      return rows.sort((left, right) => right.availableQty - left.availableQty);
    }
    return rows.sort((left, right) => right.riskScore - left.riskScore);
  }, [filteredRecords, locationCriticalityHeatmap, warehouseStatusSort]);
  const warehouseRecordsByLocation = useMemo(() => {
    const map = new Map<string, PartInventoryRecord[]>();
    for (const entry of warehouseStatusSummary) {
      const scoped = filteredRecords
        .filter((row) => (row.warehouse_location || 'UNASSIGNED') === entry.location)
        .sort((left, right) => {
          const leftSeverity = (left.min_serviceable_qty - left.quantity_available) + (left.criticality === 'critical' ? 100 : left.criticality === 'high' ? 50 : 0);
          const rightSeverity = (right.min_serviceable_qty - right.quantity_available) + (right.criticality === 'critical' ? 100 : right.criticality === 'high' ? 50 : 0);
          return rightSeverity - leftSeverity;
        });
      map.set(entry.location, scoped);
    }
    return map;
  }, [filteredRecords, warehouseStatusSummary]);
  useEffect(() => {
    const nextSelection: Record<string, string> = {};
    for (const [location, records] of warehouseRecordsByLocation.entries()) {
      if (records.length === 0) continue;
      const currentSelected = selectedWarehouseRecordByLocation[location];
      const selectedStillExists = currentSelected && records.some((record) => record.id === currentSelected);
      nextSelection[location] = selectedStillExists ? currentSelected : records[0].id;
    }
    setSelectedWarehouseRecordByLocation(nextSelection);
  }, [selectedWarehouseRecordByLocation, warehouseRecordsByLocation]);
  useEffect(() => {
    const nextSelection: Record<string, string> = {};
    const nextVisibleCount: Record<string, number> = {};
    for (const group of lowStockAlertGroups) {
      const currentSelected = selectedAlertRecordByGroup[group.key];
      const selectedStillExists = currentSelected && group.records.some((record) => record.id === currentSelected);
      nextSelection[group.key] = selectedStillExists ? currentSelected : group.records[0]?.id || '';
      nextVisibleCount[group.key] = Math.max(6, alertVisibleCountByGroup[group.key] || 6);
    }
    setSelectedAlertRecordByGroup(nextSelection);
    setAlertVisibleCountByGroup((current) => ({ ...nextVisibleCount, ...current }));
  }, [alertVisibleCountByGroup, lowStockAlertGroups, selectedAlertRecordByGroup]);

  function validateRecordForEdit(record: PartInventoryRecord): string[] {
    const errors: string[] = [];
    if (record.quantity_available < 0) errors.push('Available quantity cannot be negative');
    if (record.quantity_available > record.quantity_on_hand) errors.push('Available quantity cannot exceed on-hand quantity');
    if (record.reorder_level < record.min_serviceable_qty) errors.push('Reorder level must be >= minimum serviceable quantity');
    return errors;
  }

  function startSequentialBatchEdit(batch: PartInventoryRecord[], scopeLabel: string): void {
    if (!batch.length || !onUpdateRecord) return;
    const [first] = batch;
    setEditOpsNotice(`Batch edit queued for ${batch.length} records in ${scopeLabel}. Opening first record now; continue sequentially.`);
    onUpdateRecord(first);
  }

  const trendSeries = useMemo(() => {
    const totalValue = filteredRecords.reduce((sum, row) => sum + row.quantity_on_hand * row.unit_cost, 0);
    const lowStockCount = filteredRecords.filter((row) => row.quantity_available <= row.reorder_level || row.status === 'low_stock').length;
    return TREND_MONTHS.map((month, index) => {
      const factor = 0.86 + (index * 0.04);
      const churn = 1 + ((index % 2 === 0 ? -1 : 1) * 0.06);
      return {
        month,
        value: Math.round(totalValue * factor),
        lowStock: Math.max(0, Math.round(lowStockCount * churn)),
      };
    });
  }, [filteredRecords]);

  const maxHeatMapTotal = Math.max(1, ...locationCriticalityHeatmap.map((entry) => entry.total));
  const maxStatusCount = Math.max(1, ...statusDistribution.map((entry) => entry[1]));

  const exportCurrentInventory = () => {
    if (!canExport) return;
    const header = ['part_number', 'description', 'item_type', 'supplier_name', 'warehouse_location', 'criticality', 'status', 'quantity_on_hand', 'quantity_reserved', 'quantity_available', 'reorder_level', 'min_serviceable_qty', 'risk_band'];
    const lines = filteredRecords.map((row) => [
      row.part_number,
      row.description,
      row.item_type,
      row.supplier_name,
      row.warehouse_location,
      row.criticality,
      row.status,
      row.quantity_on_hand,
      row.quantity_reserved,
      row.quantity_available,
      row.reorder_level,
      row.min_serviceable_qty,
      computeRiskBand(row),
    ]);
    const csv = [header.join(','), ...lines.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'amro-parts-inventory-report.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const dismissGuidedTour = () => {
    setShowGuidedTour(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(guidedTourStorageKey, '1');
    }
  };

  const showGuidedTourAgain = () => {
    setShowGuidedTour(true);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(guidedTourStorageKey);
    }
  };

  return (
    <div className="space-y-4" aria-label="AMRO parts inventory workbench">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{subtitle}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCcw className="mr-1.5 h-4 w-4" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportCurrentInventory} disabled={!canExport}>
                <Download className="mr-1.5 h-4 w-4" />
                Export
              </Button>
              <Button size="sm" onClick={onCreatePart}>
                <Boxes className="mr-1.5 h-4 w-4" />
                Add Part
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">Auto refresh: 30s</Badge>
            <Badge variant="secondary">Visible records: {filteredRecords.length}</Badge>
            <Badge variant="outline">Target load: under 2s</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters and View</CardTitle>
          <CardDescription>
            Easy Mode gives fast, guided filtering. Advanced Mode unlocks full parameter controls.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showGuidedTour ? (
            <div className="rounded border border-sky-200 bg-sky-50/70 p-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-sky-900">Quick Guided Tour</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-sky-900">
                    <Badge variant="outline" className="border-sky-300 bg-white text-sky-800">Step 1: Search</Badge>
                    <span>{'->'}</span>
                    <Badge variant="outline" className="border-sky-300 bg-white text-sky-800">Step 2: Preset</Badge>
                    <span>{'->'}</span>
                    <Badge variant="outline" className="border-sky-300 bg-white text-sky-800">Step 3: View</Badge>
                  </div>
                  <p className="text-[11px] text-sky-900">
                    Start with search, apply a quick preset, then choose the preferred view layout.
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-7 border-sky-300 bg-white text-sky-800 hover:bg-sky-100" onClick={dismissGuidedTour}>
                    Got it
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={easyMode ? 'default' : 'outline'}>Easy Mode</Badge>
            <Button
              size="sm"
              variant={easyMode ? 'default' : 'outline'}
              onClick={() => setEasyMode(true)}
            >
              Simplified
            </Button>
            <Button
              size="sm"
              variant={!easyMode ? 'default' : 'outline'}
              onClick={() => setEasyMode(false)}
            >
              Advanced
            </Button>
            {canShowTourAgain && !showGuidedTour ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={showGuidedTourAgain}
              >
                Show Tour Again
              </Button>
            ) : null}
            <Badge variant="secondary">Visible: {filteredRecords.length}</Badge>
          </div>
          {editOpsNotice ? (
            <div className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-900" role="status" aria-live="polite">
              {editOpsNotice}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search by item, supplier, or location..."
              aria-label="Search parts inventory"
              className="h-8"
            />
            <Select value={erpLinkedOnly} onValueChange={(value) => setErpLinkedOnly(value as 'all' | 'linked')}>
              <SelectTrigger className="h-8" aria-label="Filter by ERP link status">
                <SelectValue placeholder="ERP Link" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ERP: all</SelectItem>
                <SelectItem value="linked">ERP: linked only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as (typeof PARTS_STATUS_FILTER_OPTIONS)[number])}>
              <SelectTrigger className="h-8" aria-label="Filter by inventory status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {PARTS_STATUS_FILTER_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    Status: {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="gap-1">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Focused Filters
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <Select value={easyPreset} onValueChange={(value) => setEasyPreset(value as EasyModePreset)}>
              <SelectTrigger className="h-8" aria-label="Quick filter preset">
                <SelectValue placeholder="Quick Preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Quick Preset: All Inventory</SelectItem>
                <SelectItem value="shortage-risk">Quick Preset: Shortage Risk</SelectItem>
                <SelectItem value="critical-only">Quick Preset: Critical Only</SelectItem>
                <SelectItem value="reorder-due">Quick Preset: Reorder Due</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={preferredViewMode}
              onValueChange={(value) => {
                const next = value as GridViewMode;
                setPreferredViewMode(next);
              }}
            >
              <SelectTrigger className="h-8" aria-label="Inventory layout mode">
                <SelectValue placeholder="View Layout" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="horizontal-split">View: Horizontal Split (Recommended)</SelectItem>
                <SelectItem value="vertical-split">View: Vertical Split</SelectItem>
                <SelectItem value="stacked-auto">View: Stacked Auto</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setShowAdvancedFilters((previous) => !previous)}
            >
              {showAdvancedFilters ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
            </Button>
          </div>

          {!easyMode || showAdvancedFilters ? (
            <div className="flex flex-wrap items-center gap-2 rounded border bg-muted/20 p-2">
            <Select value={criticalityFilter} onValueChange={(value) => setCriticalityFilter(value as 'all' | PartInventoryRecord['criticality'])}>
              <SelectTrigger className="h-8 w-[180px]" aria-label="Filter by criticality">
                <SelectValue placeholder="Criticality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Criticality: all</SelectItem>
                <SelectItem value="critical">Criticality: critical</SelectItem>
                <SelectItem value="high">Criticality: high</SelectItem>
                <SelectItem value="normal">Criticality: normal</SelectItem>
                <SelectItem value="low">Criticality: low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={itemTypeFilter} onValueChange={(value) => setItemTypeFilter(value as 'all' | PartInventoryRecord['item_type'])}>
              <SelectTrigger className="h-8 w-[180px]" aria-label="Filter by part type">
                <SelectValue placeholder="Part Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Type: all</SelectItem>
                <SelectItem value="part">Type: part</SelectItem>
                <SelectItem value="consumable">Type: consumable</SelectItem>
                <SelectItem value="tool">Type: tool</SelectItem>
                <SelectItem value="equipment">Type: equipment</SelectItem>
              </SelectContent>
            </Select>
            <Select value={supplierFilter} onValueChange={(value) => setSupplierFilter(value)}>
              <SelectTrigger className="h-8 w-[180px]" aria-label="Filter by supplier">
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Supplier: all</SelectItem>
                {supplierOptions.map((supplier) => (
                  <SelectItem key={supplier} value={supplier}>
                    {supplier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={(value) => setLocationFilter(value)}>
              <SelectTrigger className="h-8 w-[180px]" aria-label="Filter by location">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Location: all</SelectItem>
                {locationOptions.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stockSignalFilter} onValueChange={(value) => setStockSignalFilter(value as StockSignal)}>
              <SelectTrigger className="h-8 w-[180px]" aria-label="Filter by stock signal">
                <SelectValue placeholder="Stock Signal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Signal: all</SelectItem>
                <SelectItem value="low">Signal: low stock</SelectItem>
                <SelectItem value="critical">Signal: critical stock</SelectItem>
              </SelectContent>
            </Select>
            <Select value={riskBandFilter} onValueChange={(value) => setRiskBandFilter(value as 'all' | RiskBand)}>
              <SelectTrigger className="h-8 w-[180px]" aria-label="Filter by risk band">
                <SelectValue placeholder="Risk Band" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Risk: all</SelectItem>
                <SelectItem value="healthy">Risk: healthy</SelectItem>
                <SelectItem value="watch">Risk: watch</SelectItem>
                <SelectItem value="critical">Risk: critical</SelectItem>
              </SelectContent>
            </Select>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Easy Mode active: using quick preset and search. Enable advanced filters if needed.
            </div>
          )}

          <section className="rounded border">
            <button
              type="button"
              className="flex h-12 w-full items-center justify-between px-3 text-left"
              onClick={() => setWarehousePanelCollapsed((previous) => !previous)}
              aria-expanded={!warehousePanelCollapsed}
              aria-controls="warehouse-status-multi"
            >
              <span className="text-sm font-medium">Warehouse Status - Multi-Warehouse</span>
              {warehousePanelCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
            <div
              id="warehouse-status-multi"
              className={cn(
                'overflow-hidden px-3 transition-all duration-300',
                warehousePanelCollapsed ? 'max-h-0 pb-0' : 'max-h-[1200px] pb-3',
              )}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Select value={warehouseStatusSort} onValueChange={(value) => setWarehouseStatusSort(value as WarehouseStatusSort)}>
                  <SelectTrigger className="h-8 w-[220px]" aria-label="Sort warehouse status">
                    <SelectValue placeholder="Warehouse Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="risk_desc">Sort: Highest Risk</SelectItem>
                    <SelectItem value="available_desc">Sort: Highest Available Qty</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={warehouseRecordSearch}
                  onChange={(event) => setWarehouseRecordSearch(event.target.value)}
                  className="h-8 w-[260px]"
                  placeholder="Search records in warehouse cards..."
                  aria-label="Search warehouse records"
                />
                <Badge variant="outline">Scale Target: 10 / 50 / 100+</Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {warehouseStatusSummary.map((entry) => {
                  const warehouseRecordsRaw = warehouseRecordsByLocation.get(entry.location) || [];
                  const warehouseRecords = warehouseRecordsRaw.filter((record) => {
                    if (!normalizedWarehouseRecordSearch) return true;
                    const searchable = `${record.part_number} ${record.description} ${record.supplier_name} ${record.serial_number}`.toLowerCase();
                    return searchable.includes(normalizedWarehouseRecordSearch);
                  });
                  const visibleCount = warehouseVisibleCountByLocation[entry.location] || 6;
                  const visibleRecords = warehouseRecords.slice(0, visibleCount);
                  const selectedRecordId = selectedWarehouseRecordByLocation[entry.location] || warehouseRecords[0]?.id || '';
                  const selectedRecord = warehouseRecords.find((record) => record.id === selectedRecordId) || warehouseRecords[0];
                  const selectedBulkIds = selectedWarehouseBulkByLocation[entry.location] || [];
                  const selectedBulkRecords = warehouseRecords.filter((record) => selectedBulkIds.includes(record.id));
                  const validationIssues = selectedRecord ? validateRecordForEdit(selectedRecord) : [];
                  return (
                  <div key={entry.location} className="rounded border p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{entry.location}</span>
                      <Badge variant={entry.riskScore > 5 ? 'destructive' : 'secondary'}>Risk {entry.riskScore}</Badge>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                      <span>Avail: {entry.availableQty}</span>
                      <span>Total: {entry.total}</span>
                      <span>Critical: {entry.critical}</span>
                      <span>High: {entry.high}</span>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-1 text-[11px]">
                      <span className="rounded bg-rose-100 px-1 py-0.5 text-rose-900">C {entry.critical}</span>
                      <span className="rounded bg-amber-100 px-1 py-0.5 text-amber-900">H {entry.high}</span>
                      <span className="rounded bg-emerald-100 px-1 py-0.5 text-emerald-900">N {entry.normal}</span>
                      <span className="rounded bg-slate-100 px-1 py-0.5 text-slate-900">L {entry.low}</span>
                    </div>
                    <div className="mt-2 max-h-40 overflow-auto rounded border">
                      {visibleRecords.length ? visibleRecords.map((record) => {
                        const isActive = selectedRecordId === record.id;
                        const isChecked = selectedBulkIds.includes(record.id);
                        return (
                          <label key={`${entry.location}-${record.id}`} className={cn('flex cursor-pointer items-center justify-between gap-2 border-b px-2 py-1 text-[11px]', isActive ? 'bg-primary/5' : '')}>
                            <div className="flex min-w-0 items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(event) => {
                                  setSelectedWarehouseBulkByLocation((current) => {
                                    const next = new Set(current[entry.location] || []);
                                    if (event.target.checked) next.add(record.id); else next.delete(record.id);
                                    return { ...current, [entry.location]: Array.from(next) };
                                  });
                                }}
                                aria-label={`Select ${record.part_number} for batch edit`}
                              />
                              <button
                                type="button"
                                className="truncate text-left font-medium"
                                onClick={() => setSelectedWarehouseRecordByLocation((current) => ({ ...current, [entry.location]: record.id }))}
                              >
                                {record.part_number} · Avail {record.quantity_available}
                              </button>
                            </div>
                            <span className="text-muted-foreground">{record.supplier_name}</span>
                          </label>
                        );
                      }) : <div className="px-2 py-2 text-xs text-muted-foreground">No records match card search.</div>}
                    </div>
                    {warehouseRecords.length > visibleCount ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-7 text-xs"
                        onClick={() => setWarehouseVisibleCountByLocation((current) => ({ ...current, [entry.location]: (current[entry.location] || 6) + 10 }))}
                      >
                        Load More ({warehouseRecords.length - visibleCount} remaining)
                      </Button>
                    ) : null}
                    {validationIssues.length ? (
                      <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
                        Validation: {validationIssues[0]}
                      </div>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        Selected: {selectedBulkRecords.length} for batch
                      </Badge>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={!selectedBulkRecords.length}
                          onClick={() => startSequentialBatchEdit(selectedBulkRecords, entry.location)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Batch Edit
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={!selectedRecord || validationIssues.length > 0}
                        onClick={() => {
                          if (selectedRecord) onUpdateRecord?.(selectedRecord);
                        }}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        disabled={!selectedRecord || validationIssues.length > 0}
                        onClick={() => {
                          if (selectedRecord) onDeleteRecord?.(selectedRecord);
                        }}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );})}
              </div>
            </div>
          </section>

          <section className="rounded border">
            <button
              type="button"
              className="flex h-12 w-full items-center justify-between px-3 text-left"
              onClick={() => setAlertsPanelCollapsed((previous) => !previous)}
              aria-expanded={!alertsPanelCollapsed}
              aria-controls="low-stock-alerts"
            >
              <span className="text-sm font-medium">Automated Low-Stock Alerts</span>
              {alertsPanelCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
            <div
              id="low-stock-alerts"
              className={cn(
                'overflow-hidden px-3 transition-all duration-300',
                alertsPanelCollapsed ? 'max-h-0 pb-0' : 'max-h-[1200px] pb-3',
              )}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Select value={alertSort} onValueChange={(value) => setAlertSort(value as AlertSort)}>
                    <SelectTrigger className="h-8 w-[240px]" aria-label="Sort low-stock alerts">
                      <SelectValue placeholder="Alert sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="severity_desc">Sort: Most Severe First</SelectItem>
                      <SelectItem value="severity_asc">Sort: Least Severe First</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={alertRecordSearch}
                    onChange={(event) => setAlertRecordSearch(event.target.value)}
                    className="h-8 w-[260px]"
                    placeholder="Search alert records..."
                    aria-label="Search low-stock alert records"
                  />
                  <Badge variant="secondary">Alerts: {sortedCriticalAlerts.length}</Badge>
                </div>
                <Button size="sm" variant="outline" disabled={!canManageAlerts}>
                  <BellRing className="mr-1.5 h-4 w-4" />
                  Manage
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {lowStockAlertGroups.length ? lowStockAlertGroups.map((group) => {
                  const selectedRecordId = selectedAlertRecordByGroup[group.key] || group.records[0]?.id || '';
                  const selectedRecord = group.records.find((record) => record.id === selectedRecordId) || group.records[0];
                  const visibleCount = alertVisibleCountByGroup[group.key] || 6;
                  const visibleRecords = group.records.slice(0, visibleCount);
                  const selectedBulkIds = selectedAlertBulkByGroup[group.key] || [];
                  const selectedBulkRecords = group.records.filter((record) => selectedBulkIds.includes(record.id));
                  const validationIssues = selectedRecord ? validateRecordForEdit(selectedRecord) : [];
                  return (
                  <div key={group.key} className="rounded border border-rose-200 bg-rose-50/40 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{group.location}</span>
                      <Badge variant="destructive">critical x{group.records.length}</Badge>
                    </div>
                    <div className="mt-2 max-h-40 overflow-auto rounded border bg-white/60">
                      {visibleRecords.map((record) => (
                        <label key={`${group.key}-${record.id}`} className={cn('flex cursor-pointer items-center justify-between gap-2 border-b px-2 py-1 text-[11px]', selectedRecordId === record.id ? 'bg-primary/5' : '')}>
                          <div className="flex min-w-0 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedBulkIds.includes(record.id)}
                              onChange={(event) => {
                                setSelectedAlertBulkByGroup((current) => {
                                  const next = new Set(current[group.key] || []);
                                  if (event.target.checked) next.add(record.id); else next.delete(record.id);
                                  return { ...current, [group.key]: Array.from(next) };
                                });
                              }}
                              aria-label={`Select ${record.part_number} for batch edit`}
                            />
                            <button
                              type="button"
                              className="truncate text-left font-medium"
                              onClick={() => setSelectedAlertRecordByGroup((current) => ({ ...current, [group.key]: record.id }))}
                            >
                              {record.part_number} · Avail {record.quantity_available} · Min {record.min_serviceable_qty}
                            </button>
                          </div>
                          <span className="truncate text-muted-foreground">{record.supplier_name}</span>
                        </label>
                      ))}
                    </div>
                    {group.records.length > visibleCount ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-7 text-xs"
                        onClick={() => setAlertVisibleCountByGroup((current) => ({ ...current, [group.key]: (current[group.key] || 6) + 10 }))}
                      >
                        Load More ({group.records.length - visibleCount} remaining)
                      </Button>
                    ) : null}
                    {validationIssues.length ? (
                      <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
                        Validation: {validationIssues[0]}
                      </div>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        Selected: {selectedBulkRecords.length} for batch
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={!selectedBulkRecords.length}
                        onClick={() => startSequentialBatchEdit(selectedBulkRecords, group.location)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Batch Edit
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={!selectedRecord || validationIssues.length > 0}
                        onClick={() => selectedRecord && onUpdateRecord?.(selectedRecord)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        disabled={!selectedRecord || validationIssues.length > 0}
                        onClick={() => selectedRecord && onDeleteRecord?.(selectedRecord)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );}) : <p className="text-sm text-muted-foreground">No critical alerts for current filter scope.</p>}
              </div>
            </div>
          </section>
        </CardContent>
      </Card>

      {state === 'loading' ? (
        <Card>
          <CardContent className="flex min-h-[240px] items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading parts inventory...
            </div>
          </CardContent>
        </Card>
      ) : null}

      {state === 'error' ? (
        <Card className="border-destructive/40">
          <CardContent className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="max-w-xl text-sm text-muted-foreground">{errorMessage}</p>
            <Button variant="outline" onClick={onRetry}>Retry</Button>
          </CardContent>
        </Card>
      ) : null}

      {state === 'empty' ? (
        <Card>
          <CardContent className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
            <Boxes className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No parts inventory records match the current filters.</p>
            <Button variant="outline" onClick={() => {
              setStatusFilter('all');
            }}>
              Reset Filters
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {state === 'ready' ? (
        <section className="rounded border">
          <button
            type="button"
            className="flex h-12 w-full items-center justify-between px-3 text-left"
            onClick={() => setRecordsPanelCollapsed((previous) => !previous)}
            aria-expanded={!recordsPanelCollapsed}
            aria-controls="records-workspace"
          >
            <span className="text-sm font-medium">Records Workspace</span>
            {recordsPanelCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <div
            id="records-workspace"
            className={cn(
              'overflow-hidden transition-all duration-300',
              recordsPanelCollapsed ? 'max-h-0 pb-0' : 'max-h-[4000px] pb-2',
            )}
          >
            <AmroUnifiedGridRecordDetailShell
              title="Parts Inventory Records"
              subtitle="Grid and detail form for full CRUD operations."
              records={filteredRecords}
              columns={columns}
              viewMode={preferredViewMode}
              density={density}
              scrollBehavior={scrollBehavior}
              pageSize={pageSize}
              persistKey={persistKey}
              syncDetailWithScroll
              ariaLabel="AMRO parts inventory grid"
              onRecordSelectionChange={onRecordSelectionChange}
              onScrollPositionChange={onScrollPositionChange}
              onViewModeChange={onViewModeChange}
              onCreateRecord={onCreateRecord}
              onReadRecord={onReadRecord}
              onUpdateRecord={onUpdateRecord}
              onDeleteRecord={onDeleteRecord}
              onSaveRecord={onSaveRecord}
              onCancelRecord={onCancelRecord}
              onCrudAction={onCrudAction}
              crudPermissions={crudPermissions}
              requiredDetailFieldKeys={[...PARTS_DETAIL_REQUIRED_KEYS]}
              defaultVisibleDetailFieldKeys={[...PARTS_DETAIL_DEFAULT_VISIBLE_KEYS]}
              hiddenDetailFieldKeys={[...PARTS_DETAIL_HIDDEN_KEYS]}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default AmroPartsInventoryWorkbench;
