import { useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Loader2, RefreshCcw, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
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
}: AmroPartsInventoryWorkbenchProps) {
  const [statusFilter, setStatusFilter] = useState<(typeof PARTS_STATUS_FILTER_OPTIONS)[number]>('all');

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

  const filteredRecords = useMemo(() => {
    return records.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      return true;
    });
  }, [records, statusFilter]);

  const metrics = useMemo(() => computePartInventoryMetrics(filteredRecords), [filteredRecords]);

  const statusDistribution = useMemo(() => {
    const map = new Map<PartInventoryRecord['status'], number>();
    for (const row of filteredRecords) {
      map.set(row.status, (map.get(row.status) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredRecords]);

  const maxStatusCount = Math.max(1, ...statusDistribution.map((entry) => entry[1]));

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
              <Button size="sm" onClick={onCreatePart}>
                <Boxes className="mr-1.5 h-4 w-4" />
                Add Part
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-dashed">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Items</span>
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-2 text-2xl font-semibold">{metrics.totalItems}</p>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Low Stock</span>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-2xl font-semibold">{metrics.lowStockItems}</p>
                  <Badge variant={metricTone(metrics.lowStockItems, 5, 20)}>{metrics.lowStockItems > 0 ? 'action' : 'healthy'}</Badge>
                </div>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Reserved Items</span>
                  <Boxes className="h-4 w-4 text-sky-500" />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-2xl font-semibold">{metrics.reservedItems}</p>
                  <Badge variant={metricTone(metrics.reservedItems, 10, 30)}>{metrics.reservedItems > 0 ? 'tracked' : 'clear'}</Badge>
                </div>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Quarantined Items</span>
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-2xl font-semibold">{metrics.quarantineItems}</p>
                  <Badge variant={metricTone(metrics.quarantineItems, 1, 5)}>{metrics.quarantineItems > 0 ? 'attention' : 'none'}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters and Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
            </Badge>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as (typeof PARTS_STATUS_FILTER_OPTIONS)[number])}>
              <SelectTrigger className="h-8 w-[180px]" aria-label="Filter by inventory status">
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
            <Badge variant="secondary">Visible: {filteredRecords.length}</Badge>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Status Distribution</p>
              {statusDistribution.length ? statusDistribution.map(([label, count]) => (
                <div key={label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{label}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-2 rounded bg-muted">
                    <div
                      className={cn(
                        'h-2 rounded transition-all duration-300',
                        label === 'quarantined' || label === 'unserviceable'
                          ? 'bg-rose-500'
                          : label === 'low_stock'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500',
                      )}
                      style={{ width: `${(count / maxStatusCount) * 100}%` }}
                    />
                  </div>
                </div>
              )) : <p className="text-sm text-muted-foreground">No status data available.</p>}
            </div>
          </div>
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
        <AmroUnifiedGridRecordDetailShell
          title="Parts Inventory Records"
          subtitle="Navigate records and inspect technical details side-by-side."
          records={filteredRecords}
          columns={columns}
          viewMode={viewMode}
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
      ) : null}
    </div>
  );
}

export default AmroPartsInventoryWorkbench;
