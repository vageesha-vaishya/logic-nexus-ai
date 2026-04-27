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

export async function queryUimExternalMroAvailability(partNumbers?: string[]): Promise<{
  output: {
    tenant_id: string;
    franchise_id: string | null;
    records: Array<Record<string, unknown>>;
  };
}> {
  const query = Array.isArray(partNumbers) && partNumbers.length > 0
    ? `?part_numbers=${encodeURIComponent(partNumbers.join(','))}`
    : '';
  return uimApiRequest({
    method: 'GET',
    path: `/integrations/external-mro-pipeline${query}`,
  });
}

export async function executeUimExternalMroPipelineAction(input: {
  action: 'reserve' | 'consume' | 'return' | 'sync-batch' | 'process-queue';
  idempotency_key?: string;
  part_number?: string;
  reservation_id?: string;
  maintenance_order_id?: string;
  work_order_id?: string;
  task_id?: string;
  quantity?: number;
  records?: Array<Record<string, unknown>>;
}): Promise<{ output: Record<string, unknown> }> {
  return uimApiRequest({
    method: 'POST',
    path: '/integrations/external-mro-pipeline',
    body: input,
  });
}

export const queryUimAmroAvailability = queryUimExternalMroAvailability;
export const executeUimAmroPipelineAction = executeUimExternalMroPipelineAction;

export async function queryUimMroSeedStatus(): Promise<{
  output: {
    tenant_id: string;
    franchise_id: string | null;
    seed_limits: {
      min: number;
      max: number;
      default: number;
    };
    seeded: {
      catalog_items: number;
      profile_items: number;
      inventory_items: number;
    };
  };
}> {
  return uimApiRequest({
    method: 'GET',
    path: '/seeding/mro',
  });
}

export async function executeUimMroSeeding(input: {
  target_count?: number;
  dry_run?: boolean;
}): Promise<{ output: Record<string, unknown> }> {
  return uimApiRequest({
    method: 'POST',
    path: '/seeding/mro',
    body: input,
  });
}

export async function queryUimAnalyticsKpis(lowStockThreshold?: number): Promise<{
  output: {
    tenant_id: string;
    franchise_id: string | null;
    low_stock_threshold: number;
    phase4_prep: {
      sequence: string[];
      kpi_model_definitions: Array<{
        key: string;
        label: string;
        description: string;
        formula: string;
        unit: string;
        owner_role: string;
      }>;
      semantic_dictionary: {
        cube_name: string;
        version: string;
        dimensions: Array<{
          key: string;
          source: string;
          grain: string;
          description: string;
        }>;
        measures: Array<{
          key: string;
          source: string;
          aggregation: string;
          description: string;
        }>;
      };
      performance_targets?: {
        dashboard_latency_target_ms: number;
        source: string;
      };
    };
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

export async function queryUimAnalyticsReconciliation(): Promise<{
  output: {
    tenant_id: string;
    franchise_id: string | null;
    readiness: {
      status: 'ready' | 'pending';
      score: number;
      checks: Array<{
        key: string;
        label: string;
        passed: boolean;
        details: string;
      }>;
    };
    snapshot: {
      replay_version: number;
      generated_at: string;
      etl_completed_runs: number;
      etl_failed_runs: number;
    };
  };
}> {
  return uimApiRequest({
    method: 'GET',
    path: '/analytics/reconciliation',
  });
}

export async function queryUimAnalyticsBiCube(): Promise<{
  output: {
    tenant_id: string;
    franchise_id: string | null;
    deployment_artifact: {
      artifact_id: string;
      artifact_hash: string;
      artifact_version: string;
      published_at: string;
      deployment_target: string;
    };
    data_dictionary: {
      cube_name: string;
      publication_status: string;
      dimensions: Array<Record<string, unknown>>;
      measures: Array<Record<string, unknown>>;
      kpi_model_definitions: Array<Record<string, unknown>>;
    };
  };
}> {
  return uimApiRequest({
    method: 'GET',
    path: '/analytics/bi-cube',
  });
}

export async function queryUimAnalyticsQaSignoff(): Promise<{
  output: {
    tenant_id: string;
    franchise_id: string | null;
    latest: Record<string, unknown> | null;
    records: Array<Record<string, unknown>>;
  };
}> {
  return uimApiRequest({
    method: 'GET',
    path: '/analytics/qa-signoff',
  });
}

export async function submitUimAnalyticsQaSignoff(input: {
  signoff_status?: 'signed_off' | 'revoked';
  signed_off_by: string;
  signed_off_role: string;
  reconciliation_verified: boolean;
  latency_target_met: boolean;
  data_dictionary_published: boolean;
  bi_cube_deployed: boolean;
  notes?: string;
}): Promise<{
  output: {
    tenant_id: string;
    franchise_id: string | null;
    signoff: Record<string, unknown>;
  };
}> {
  return uimApiRequest({
    method: 'POST',
    path: '/analytics/qa-signoff',
    body: input,
  });
}

export async function queryUimAnalyticsSlaEvidence(): Promise<{
  output: {
    tenant_id: string;
    franchise_id: string | null;
    gate: string;
    generated_at: string;
    performance_targets: {
      dashboard_latency_target_ms: number;
    };
    evidence_checks: Array<{
      key: string;
      passed: boolean;
      details: string;
    }>;
    readiness_score: number;
    status: 'ready' | 'pending';
  };
}> {
  return uimApiRequest({
    method: 'GET',
    path: '/analytics/sla-evidence',
  });
}
