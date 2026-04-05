import { uimApiRequest } from './uimApi';

export type UimCommandType = 'RECEIVE' | 'MOVE' | 'RESERVE' | 'CONSUME';

export type UimExecuteCommandInput = {
  command_type: UimCommandType;
  command_payload: Record<string, unknown>;
  idempotency_key?: string;
};

export type UimExecuteCommandOutput = {
  output: {
    command_id: string;
    command_type: UimCommandType;
    command_status: 'applied' | 'accepted' | 'failed';
    applied_output: Record<string, unknown>;
  };
};

export async function executeUimCommand(input: UimExecuteCommandInput): Promise<UimExecuteCommandOutput> {
  return uimApiRequest<UimExecuteCommandOutput, UimExecuteCommandInput>({
    method: 'POST',
    path: '/commands',
    body: input,
  });
}

export async function replayUimProjections(): Promise<{
  output: {
    replayed_events: number;
    updated_snapshots: number;
  };
}> {
  return uimApiRequest({
    method: 'POST',
    path: '/projections/replay',
    body: {},
  });
}

export async function queryUimProjectionItems(limit = 50, offset = 0): Promise<{
  output: {
    pagination: {
      limit: number;
      offset: number;
      total: number;
    };
    snapshots: Array<Record<string, unknown>>;
  };
}> {
  return uimApiRequest({
    method: 'GET',
    path: `/projections/items?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`,
  });
}

export async function queryUimAnalyticsKpis(lowStockThreshold?: number): Promise<{
  output: {
    tenant_id: string;
    franchise_id: string | null;
    low_stock_threshold: number;
    kpis: {
      total_tracked_items: number;
      available_quantity: number;
      reserved_quantity: number;
      consumed_quantity: number;
      in_transit_items: number;
      low_stock_items: number;
      inventory_turnover_ratio: number;
    };
    snapshot: {
      replay_version: number;
      generated_at: string;
    };
  };
}> {
  const threshold = Number.isFinite(Number(lowStockThreshold))
    ? `?low_stock_threshold=${encodeURIComponent(String(Math.max(0, Math.floor(Number(lowStockThreshold)))))}` : '';
  return uimApiRequest({
    method: 'GET',
    path: `/analytics/kpis${threshold}`,
  });
}

export async function queryUimAnalyticsEtlStatus(): Promise<{
  output: {
    tenant_id: string;
    franchise_id: string | null;
    scheduler: {
      running: boolean;
      interval_ms: number;
    };
    queue: {
      queued: number;
      running: number;
      retryScheduled: number;
      completed: number;
      failed: number;
    };
    telemetry: Record<string, unknown>;
    runs: Array<Record<string, unknown>>;
  };
}> {
  return uimApiRequest({
    method: 'GET',
    path: '/analytics/etl',
  });
}

export async function executeUimAnalyticsEtlAction(input: {
  action: 'schedule-run' | 'process-now' | 'start-scheduler' | 'stop-scheduler';
  source?: string;
  window_start?: string;
  window_end?: string;
  trigger?: 'manual' | 'scheduled';
  max_attempts?: number;
  interval_ms?: number;
}): Promise<{ output: Record<string, unknown> }> {
  return uimApiRequest({
    method: 'POST',
    path: '/analytics/etl',
    body: input,
  });
}
