export type UimAnalyticsKpis = {
  total_tracked_items: number;
  available_quantity: number;
  reserved_quantity: number;
  consumed_quantity: number;
  in_transit_items: number;
  low_stock_items: number;
  inventory_turnover_ratio: number;
};

export type UimAnalyticsSnapshot = {
  replay_version: number;
  generated_at: string;
};

export type UimAnalyticsKpiDefinition = {
  key: keyof UimAnalyticsKpis;
  label: string;
  description: string;
  formula: string;
  unit: 'count' | 'quantity' | 'ratio';
  owner_role: string;
};

export type UimAnalyticsSemanticDimension = {
  key: string;
  source: string;
  grain: 'event' | 'inventory_item' | 'projection_snapshot' | 'tenant';
  description: string;
};

export type UimAnalyticsSemanticMeasure = {
  key: string;
  source: string;
  aggregation: 'sum' | 'count' | 'max';
  description: string;
};

export type UimAnalyticsSemanticModel = {
  cube_name: string;
  version: string;
  dimensions: UimAnalyticsSemanticDimension[];
  measures: UimAnalyticsSemanticMeasure[];
};

type AccessContext = {
  tenantId: string;
  franchiseId?: string;
};

type Options = {
  lowStockThreshold: number;
};

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

const UIM_ANALYTICS_KPI_DEFINITIONS: UimAnalyticsKpiDefinition[] = [
  {
    key: 'total_tracked_items',
    label: 'Total tracked items',
    description: 'Distinct inventory items tracked for the current tenant/franchise scope.',
    formula: 'COUNT(uim_inventory_items.id)',
    unit: 'count',
    owner_role: 'Product Analyst',
  },
  {
    key: 'available_quantity',
    label: 'Available quantity',
    description: 'Sum of projected available quantity from projection snapshots.',
    formula: 'SUM(projected_available_quantity)',
    unit: 'quantity',
    owner_role: 'Product Analyst',
  },
  {
    key: 'reserved_quantity',
    label: 'Reserved quantity',
    description: 'Sum of projected reserved quantity from projection snapshots.',
    formula: 'SUM(projected_reserved_quantity)',
    unit: 'quantity',
    owner_role: 'Product Analyst',
  },
  {
    key: 'consumed_quantity',
    label: 'Consumed quantity',
    description: 'Sum of projected consumed quantity from projection snapshots.',
    formula: 'SUM(projected_consumed_quantity)',
    unit: 'quantity',
    owner_role: 'Product Analyst',
  },
  {
    key: 'in_transit_items',
    label: 'In-transit items',
    description: 'Inventory items currently in transit state.',
    formula: "COUNT(status = 'in_transit')",
    unit: 'count',
    owner_role: 'Product Analyst',
  },
  {
    key: 'low_stock_items',
    label: 'Low-stock items',
    description: 'Projection snapshots at or below the configured threshold.',
    formula: 'COUNT(projected_available_quantity <= threshold)',
    unit: 'count',
    owner_role: 'Product Analyst',
  },
  {
    key: 'inventory_turnover_ratio',
    label: 'Inventory turnover ratio',
    description: 'Consumed quantity divided by available + reserved quantity.',
    formula: 'consumed_quantity / MAX(1, available_quantity + reserved_quantity)',
    unit: 'ratio',
    owner_role: 'Product Analyst',
  },
];

const UIM_ANALYTICS_SEMANTIC_MODEL: UimAnalyticsSemanticModel = {
  cube_name: 'uim_inventory_analytics_cube',
  version: 'phase4-prep-v1',
  dimensions: [
    {
      key: 'tenant_id',
      source: 'uim_inventory_projection_snapshots.tenant_id',
      grain: 'tenant',
      description: 'Tenant-level partition key for strict RLS and KPI segmentation.',
    },
    {
      key: 'franchise_id',
      source: 'uim_inventory_projection_snapshots.franchise_id',
      grain: 'tenant',
      description: 'Optional franchise-level segmentation dimension.',
    },
    {
      key: 'inventory_item_id',
      source: 'uim_inventory_projection_snapshots.inventory_item_id',
      grain: 'inventory_item',
      description: 'Atomic inventory entity identifier for drill-down and lineage.',
    },
    {
      key: 'snapshot_date',
      source: 'DATE(uim_inventory_projection_snapshots.created_at)',
      grain: 'projection_snapshot',
      description: 'Date grain used for trend and reconciliation views.',
    },
  ],
  measures: [
    {
      key: 'available_quantity',
      source: 'uim_inventory_projection_snapshots.projected_available_quantity',
      aggregation: 'sum',
      description: 'Projected available quantity for real-time operational stock posture.',
    },
    {
      key: 'reserved_quantity',
      source: 'uim_inventory_projection_snapshots.projected_reserved_quantity',
      aggregation: 'sum',
      description: 'Projected reserved quantity supporting reservation efficiency KPIs.',
    },
    {
      key: 'consumed_quantity',
      source: 'uim_inventory_projection_snapshots.projected_consumed_quantity',
      aggregation: 'sum',
      description: 'Projected consumed quantity supporting turnover and usage analysis.',
    },
    {
      key: 'replay_version',
      source: 'uim_inventory_projection_snapshots.replay_version',
      aggregation: 'max',
      description: 'Projection replay checkpoint for reconciliation confidence.',
    },
  ],
};

function readNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toThreshold(value: number | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_LOW_STOCK_THRESHOLD;
  return Math.floor(parsed);
}

export async function computeUimAnalyticsKpis(
  supabase: any,
  access: AccessContext,
  options?: Partial<Options>,
): Promise<{ kpis: UimAnalyticsKpis; snapshot: UimAnalyticsSnapshot }> {
  const lowStockThreshold = toThreshold(options?.lowStockThreshold);

  let projectionQuery: any = supabase
    .from('uim_inventory_projection_snapshots')
    .select('projected_available_quantity, projected_reserved_quantity, projected_consumed_quantity, replay_version')
    .eq('tenant_id', access.tenantId);
  if (access.franchiseId) projectionQuery = projectionQuery.eq('franchise_id', access.franchiseId);
  const { data: projectionRows, error: projectionError } = await projectionQuery.limit(50000);
  if (projectionError) throw new Error(`Failed to load projection snapshots for analytics: ${projectionError.message || 'unknown error'}`);

  let inventoryQuery: any = supabase
    .from('uim_inventory_items')
    .select('status')
    .eq('tenant_id', access.tenantId);
  if (access.franchiseId) inventoryQuery = inventoryQuery.eq('franchise_id', access.franchiseId);
  const { data: inventoryRows, error: inventoryError } = await inventoryQuery.limit(50000);
  if (inventoryError) throw new Error(`Failed to load inventory items for analytics: ${inventoryError.message || 'unknown error'}`);

  const projections: Array<Record<string, unknown>> = projectionRows || [];
  const items: Array<Record<string, unknown>> = inventoryRows || [];

  const availableQuantity = projections.reduce(
    (total, row) => total + readNumber(row.projected_available_quantity),
    0,
  );
  const reservedQuantity = projections.reduce(
    (total, row) => total + readNumber(row.projected_reserved_quantity),
    0,
  );
  const consumedQuantity = projections.reduce(
    (total, row) => total + readNumber(row.projected_consumed_quantity),
    0,
  );
  const replayVersion = projections.reduce(
    (maxVersion, row) => Math.max(maxVersion, readNumber(row.replay_version)),
    0,
  );

  const lowStockItems = projections.filter(
    (row) => readNumber(row.projected_available_quantity) <= lowStockThreshold,
  ).length;
  const inTransitItems = items.filter((row) => String(row.status || '').toLowerCase() === 'in_transit').length;
  const turnoverDenominator = Math.max(1, availableQuantity + reservedQuantity);

  return {
    kpis: {
      total_tracked_items: items.length,
      available_quantity: Number(availableQuantity.toFixed(4)),
      reserved_quantity: Number(reservedQuantity.toFixed(4)),
      consumed_quantity: Number(consumedQuantity.toFixed(4)),
      in_transit_items: inTransitItems,
      low_stock_items: lowStockItems,
      inventory_turnover_ratio: Number((consumedQuantity / turnoverDenominator).toFixed(4)),
    },
    snapshot: {
      replay_version: replayVersion,
      generated_at: new Date().toISOString(),
    },
  };
}

export const UIM_ANALYTICS_DEFAULT_LOW_STOCK_THRESHOLD = DEFAULT_LOW_STOCK_THRESHOLD;
export const UIM_ANALYTICS_KPI_MODEL_DEFINITIONS = UIM_ANALYTICS_KPI_DEFINITIONS;
export const UIM_ANALYTICS_SEMANTIC_DICTIONARY = UIM_ANALYTICS_SEMANTIC_MODEL;
