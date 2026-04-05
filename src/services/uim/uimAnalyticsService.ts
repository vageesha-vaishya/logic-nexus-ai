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

type AccessContext = {
  tenantId: string;
  franchiseId?: string;
};

type Options = {
  lowStockThreshold: number;
};

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

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
