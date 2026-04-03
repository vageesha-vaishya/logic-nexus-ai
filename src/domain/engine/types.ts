export type EngineAsset = {
  id: string;
  tailNumber?: string;
  engineSerialNumber?: string;
  position?: 'L' | 'R' | 'C' | 'AUX' | string;
  tsn?: number;
  csn?: number;
  status?: 'active' | 'inactive' | 'in_maintenance' | string;
  tenant_id?: string;
  franchise_id?: string;
};

export type EngineConfigurationNode = {
  id: string;
  label: string;
  type: 'module' | 'llp' | 'component' | string;
  parentId?: string | null;
  serial?: string;
  tsn?: number | null;
  csn?: number | null;
  position?: string | null;
  installedAt?: string | null;
  removedAt?: string | null;
};

export type EngineConfigurationGraph = {
  engineId: string;
  nodes: EngineConfigurationNode[];
  tenant_id?: string;
  franchise_id?: string;
};

export type NextDueRequest = {
  usageMeters?: Record<string, number>;
  policySnapshotId?: string;
  includeCompliance?: boolean;
};

export type NextDueItem = {
  taskId: string;
  taskLabel?: string;
  dueAt?: string | null;
  dueAfterCycles?: number | null;
  dueAfterHours?: number | null;
  blockers?: string[];
};

export type NextDueResponse = {
  engineId: string;
  items: NextDueItem[];
  traceId?: string;
  tenant_id?: string;
  franchise_id?: string;
};

export type PerformanceHistoryPoint = {
  ts: string;
  metric: string;
  value: number;
  unit?: string;
};

export type PerformanceHistory = {
  engineId: string;
  series: PerformanceHistoryPoint[];
  tenant_id?: string;
  franchise_id?: string;
};
