import type {
  EngineAsset,
  EngineConfigurationGraph,
  NextDueRequest,
  NextDueResponse,
  PerformanceHistory,
} from '@/domain/engine/types';

type Scope = {
  tenantId: string;
  franchiseId: string | null;
};

function scopedId(scope: Scope, suffix: string): string {
  return `${scope.tenantId}-${scope.franchiseId || 'global'}-${suffix}`;
}

export function listEngineAssets(scope: Scope): EngineAsset[] {
  return [
    {
      id: scopedId(scope, 'eng-asset-1001'),
      tailNumber: `${scope.tenantId}-A320-NEO-01`,
      engineSerialNumber: 'ENG-1001',
      position: 'L',
      tsn: 12440,
      csn: 8421,
      status: 'active',
      tenant_id: scope.tenantId,
      franchise_id: scope.franchiseId || undefined,
    },
    {
      id: scopedId(scope, 'eng-asset-1002'),
      tailNumber: `${scope.tenantId}-A320-NEO-01`,
      engineSerialNumber: 'ENG-1002',
      position: 'R',
      tsn: 12110,
      csn: 8175,
      status: 'active',
      tenant_id: scope.tenantId,
      franchise_id: scope.franchiseId || undefined,
    },
  ];
}

export function getEngineConfigurationGraph(scope: Scope, engineId: string): EngineConfigurationGraph {
  return {
    engineId,
    tenant_id: scope.tenantId,
    franchise_id: scope.franchiseId || undefined,
    nodes: [
      { id: `${engineId}-core`, label: 'Core Module', type: 'module', parentId: null, serial: 'CORE-774', tsn: 12440, csn: 8421, position: 'L' },
      { id: `${engineId}-fan`, label: 'Fan Module', type: 'module', parentId: null, serial: 'FAN-553', tsn: 12440, csn: 8421, position: 'L' },
      { id: `${engineId}-llp-1`, label: 'LLP Disk A', type: 'llp', parentId: `${engineId}-core`, serial: 'LLP-001-A', tsn: 6200, csn: 4210 },
      { id: `${engineId}-llp-2`, label: 'LLP Disk B', type: 'llp', parentId: `${engineId}-fan`, serial: 'LLP-002-B', tsn: 6100, csn: 4100 },
    ],
  };
}

export function computeEngineNextDue(scope: Scope, engineId: string, request: NextDueRequest): NextDueResponse {
  const cycles = Number(request.usageMeters?.cycles || 0);
  const hours = Number(request.usageMeters?.hours || 0);
  const dueAfterCycles = Math.max(0, 500 - cycles);
  const dueAfterHours = Math.max(0, 1200 - hours);
  return {
    engineId,
    traceId: scopedId(scope, 'eng-next-due'),
    tenant_id: scope.tenantId,
    franchise_id: scope.franchiseId || undefined,
    items: [
      {
        taskId: scopedId(scope, 'borescope'),
        taskLabel: 'Borescope Inspection',
        dueAfterCycles,
        dueAfterHours,
        blockers: request.includeCompliance ? [] : ['compliance-not-evaluated'],
      },
    ],
  };
}

export function getEnginePerformanceHistory(scope: Scope, engineId: string): PerformanceHistory {
  const now = Date.now();
  return {
    engineId,
    tenant_id: scope.tenantId,
    franchise_id: scope.franchiseId || undefined,
    series: Array.from({ length: 6 }).map((_, index) => ({
      ts: new Date(now - (5 - index) * 24 * 60 * 60 * 1000).toISOString(),
      metric: 'egt_margin',
      value: Number((21.2 - index * 0.5).toFixed(2)),
      unit: 'degC',
    })),
  };
}

export function listEngineConfigurationEntries(scope: Scope): Array<Record<string, unknown>> {
  return listEngineAssets(scope).map((asset) => ({
    engine_serial_number: asset.engineSerialNumber,
    engine_position: asset.position,
    tsn: asset.tsn,
    csn: asset.csn,
    module: 'CORE',
  }));
}
