import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { computePartInventoryMetrics, type PartInventoryRecord } from './mockPartsInventoryData';
import { AmroKpiGrid, AmroModuleSurface } from './AmroPartsUiStandards';
import { AmroModuleGridDetailPanel } from './AmroModuleGridDetailPanel';

type Props = {
  records: PartInventoryRecord[];
};

function currency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
}

export function ReservationsPanel({ records }: Props): JSX.Element {
  const reserved = useMemo(() => records.filter((record) => record.quantity_reserved > 0), [records]);
  const [selectedId, setSelectedId] = useState<string | null>(reserved[0]?.id || null);
  return (
    <AmroModuleSurface
      title="Reservations"
      subtitle="Reserved stock by part and warehouse location."
      moduleId="operations.reservations"
    >
      <div className="space-y-3">
        <AmroKpiGrid items={[{ label: 'Reserved Records', value: String(reserved.length) }]} />
        <AmroModuleGridDetailPanel
          rows={reserved}
          loading={false}
          emptyMessage="No reservations found."
          selectedId={selectedId}
          onSelect={setSelectedId}
          detailTitle="Reservation Detail"
          columns={[
            { key: 'part', label: 'Part', render: (record) => record.part_number },
            { key: 'location', label: 'Location', render: (record) => record.warehouse_location },
            { key: 'reserved', label: 'Reserved', render: (record) => record.quantity_reserved },
            { key: 'available', label: 'Available', render: (record) => record.quantity_available },
          ]}
          renderDetail={(record) => (
            !record ? <p className="text-xs text-muted-foreground">Select a reservation row to inspect details.</p> : (
              <div className="space-y-1 text-xs">
                <p><span className="font-semibold">Part:</span> {record.part_number}</p>
                <p><span className="font-semibold">Description:</span> {record.description}</p>
                <p><span className="font-semibold">Location:</span> {record.warehouse_location}</p>
                <p><span className="font-semibold">Reserved:</span> {record.quantity_reserved}</p>
                <p><span className="font-semibold">Available:</span> {record.quantity_available}</p>
              </div>
            )
          )}
        />
      </div>
    </AmroModuleSurface>
  );
}

export function IssueConsumePanel({ records }: Props): JSX.Element {
  const candidates = useMemo(
    () => records.filter((record) => record.quantity_available > 0).sort((left, right) => right.quantity_available - left.quantity_available).slice(0, 12),
    [records],
  );
  const [selectedId, setSelectedId] = useState<string | null>(candidates[0]?.id || null);
  return (
    <AmroModuleSurface
      title="Issue & Consume"
      subtitle="Operational queue for issue/consume-ready inventory lots."
      moduleId="operations.issue-consume"
    >
      <div className="space-y-3">
        <AmroKpiGrid items={[{ label: 'Ready Candidates', value: String(candidates.length), tone: 'success' }]} />
        <AmroModuleGridDetailPanel
          rows={candidates}
          loading={false}
          emptyMessage="No available inventory to issue."
          selectedId={selectedId}
          onSelect={setSelectedId}
          detailTitle="Issue Candidate Detail"
          columns={[
            { key: 'part', label: 'Part', render: (record) => record.part_number },
            { key: 'type', label: 'Type', render: (record) => <Badge variant="outline">{record.item_type}</Badge> },
            { key: 'available', label: 'Available', render: (record) => record.quantity_available },
            { key: 'location', label: 'Location', render: (record) => record.warehouse_location },
          ]}
          renderDetail={(record) => (
            !record ? <p className="text-xs text-muted-foreground">Select an issue row to inspect details.</p> : (
              <div className="space-y-1 text-xs">
                <p><span className="font-semibold">Part:</span> {record.part_number}</p>
                <p><span className="font-semibold">Description:</span> {record.description}</p>
                <p><span className="font-semibold">Available:</span> {record.quantity_available}</p>
                <p><span className="font-semibold">Reserved:</span> {record.quantity_reserved}</p>
                <p><span className="font-semibold">Location:</span> {record.warehouse_location}</p>
              </div>
            )
          )}
        />
      </div>
    </AmroModuleSurface>
  );
}

export function RestockPanel({ records }: Props): JSX.Element {
  const lowStock = useMemo(
    () => records.filter((record) => record.quantity_available <= record.reorder_level || record.status === 'low_stock').sort((left, right) => left.quantity_available - right.quantity_available),
    [records],
  );
  const [selectedId, setSelectedId] = useState<string | null>(lowStock[0]?.id || null);
  return (
    <AmroModuleSurface
      title="Restock"
      subtitle="Auto-prioritized replenishment list based on reorder thresholds."
      moduleId="operations.restock"
    >
      <div className="space-y-3">
        <AmroKpiGrid items={[{ label: 'Low Stock Items', value: String(lowStock.length), tone: lowStock.length > 0 ? 'warning' : 'success' }]} />
        <AmroModuleGridDetailPanel
          rows={lowStock}
          loading={false}
          emptyMessage="No restock actions required."
          selectedId={selectedId}
          onSelect={setSelectedId}
          detailTitle="Restock Detail"
          columns={[
            { key: 'part', label: 'Part', render: (record) => record.part_number },
            { key: 'available', label: 'Available', render: (record) => record.quantity_available },
            { key: 'reorderLevel', label: 'Reorder Level', render: (record) => record.reorder_level },
            { key: 'reorderQty', label: 'Reorder Qty', render: (record) => record.reorder_quantity },
          ]}
          renderDetail={(record) => (
            !record ? <p className="text-xs text-muted-foreground">Select a restock row to inspect details.</p> : (
              <div className="space-y-1 text-xs">
                <p><span className="font-semibold">Part:</span> {record.part_number}</p>
                <p><span className="font-semibold">Type:</span> {record.item_type}</p>
                <p><span className="font-semibold">Available:</span> {record.quantity_available}</p>
                <p><span className="font-semibold">Reorder Level:</span> {record.reorder_level}</p>
                <p><span className="font-semibold">Reorder Qty:</span> {record.reorder_quantity}</p>
              </div>
            )
          )}
        />
      </div>
    </AmroModuleSurface>
  );
}

export function LocationsPanel({ records }: Props): JSX.Element {
  const byLocation = useMemo(() => {
    const accumulator = new Map<string, { count: number; value: number }>();
    for (const record of records) {
      const key = record.warehouse_location || 'UNASSIGNED';
      const current = accumulator.get(key) || { count: 0, value: 0 };
      current.count += 1;
      current.value += record.quantity_on_hand * record.unit_cost;
      accumulator.set(key, current);
    }
    return Array.from(accumulator.entries()).sort((left, right) => left[0].localeCompare(right[0]));
  }, [records]);
  const rows = useMemo(() => byLocation.map(([location, summary]) => ({ id: location, location, ...summary })), [byLocation]);
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id || null);
  return (
    <AmroModuleSurface
      title="Locations"
      subtitle="Location-level inventory density and value distribution."
      moduleId="operations.locations"
    >
      <div className="space-y-3">
        <AmroKpiGrid items={[{ label: 'Active Locations', value: String(byLocation.length) }]} />
        <AmroModuleGridDetailPanel
          rows={rows}
          loading={false}
          emptyMessage="No location distribution available."
          selectedId={selectedId}
          onSelect={setSelectedId}
          detailTitle="Location Detail"
          columns={[
            { key: 'location', label: 'Location', render: (row) => row.location },
            { key: 'count', label: 'Distinct SKUs', render: (row) => row.count },
            { key: 'value', label: 'Inventory Value', render: (row) => currency(row.value) },
          ]}
          renderDetail={(row) => (
            !row ? <p className="text-xs text-muted-foreground">Select a location row to inspect details.</p> : (
              <div className="space-y-1 text-xs">
                <p><span className="font-semibold">Location:</span> {row.location}</p>
                <p><span className="font-semibold">Distinct SKUs:</span> {row.count}</p>
                <p><span className="font-semibold">Inventory Value:</span> {currency(row.value)}</p>
              </div>
            )
          )}
        />
      </div>
    </AmroModuleSurface>
  );
}

export function AnalyticsPanel({ records }: Props): JSX.Element {
  const metrics = useMemo(() => computePartInventoryMetrics(records), [records]);
  const rows = useMemo(() => ([
    { id: 'totalItems', metric: 'Total Items', value: String(metrics.totalItems) },
    { id: 'lowStock', metric: 'Low Stock', value: String(metrics.lowStockItems) },
    { id: 'reserved', metric: 'Reserved', value: String(metrics.reservedItems) },
    { id: 'quarantine', metric: 'Quarantine', value: String(metrics.quarantineItems) },
    { id: 'critical', metric: 'Critical', value: String(metrics.criticalItems) },
    { id: 'value', metric: 'Inventory Value', value: currency(metrics.inventoryValue) },
  ]), [metrics]);
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id || null);
  return (
    <AmroModuleSurface
      title="Analytics"
      subtitle="KPI snapshot for inventory health, reservation pressure, and value exposure."
      moduleId="insights.analytics"
    >
      <div className="space-y-3">
        <AmroKpiGrid
          items={[
            { label: 'Total Items', value: String(metrics.totalItems) },
            { label: 'Low Stock', value: String(metrics.lowStockItems), tone: metrics.lowStockItems > 0 ? 'warning' : 'success' },
            { label: 'Inventory Value', value: currency(metrics.inventoryValue) },
          ]}
        />
        <AmroModuleGridDetailPanel
          rows={rows}
          loading={false}
          emptyMessage="No analytics metrics available."
          selectedId={selectedId}
          onSelect={setSelectedId}
          detailTitle="Metric Detail"
          columns={[
            { key: 'metric', label: 'Metric', render: (row) => row.metric },
            { key: 'value', label: 'Value', render: (row) => row.value },
          ]}
          renderDetail={(row) => (
            !row ? <p className="text-xs text-muted-foreground">Select a metric row to inspect details.</p> : (
              <div className="space-y-1 text-xs">
                <p><span className="font-semibold">Metric:</span> {row.metric}</p>
                <p><span className="font-semibold">Current Value:</span> {row.value}</p>
                <p className="text-muted-foreground">This metric follows the unified record detail layout and selection behavior.</p>
              </div>
            )
          )}
        />
      </div>
    </AmroModuleSurface>
  );
}
