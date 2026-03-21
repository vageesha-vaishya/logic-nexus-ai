import { AMRO_COEXISTENCE_SAFEGUARDS, AMRO_INTEGRATION_CONTRACTS } from './integration-contracts';

export type WorkPackageStatus = 'planned' | 'in_progress' | 'completed';
export type TaskStatus = 'planned' | 'in_progress' | 'completed';
export type ComplianceDecision = 'approved' | 'rejected' | 'pending';
export type AmroServiceName =
  | 'amro-work-order-service'
  | 'amro-scheduling-service'
  | 'amro-compliance-service'
  | 'amro-materials-service'
  | 'amro-audit-ledger-service'
  | 'amro-integration-hub-service'
  | 'amro-forecast-service';
export type AmroCapability =
  | 'work-packages'
  | 'tasks'
  | 'compliance-gates'
  | 'certification'
  | 'integration-hub'
  | 'forecast-reliability';
export type AmroDomainId = 'amro';
export type AmroApiVersion = 'v2';

export type LegacyWorkPackageRow = {
  legacy_id: string;
  legacy_code: string;
  legacy_title: string;
  legacy_status: WorkPackageStatus;
  tenant_id: string;
  franchise_id: string | null;
  domain_id: AmroDomainId;
  version: AmroApiVersion;
};

export type LegacyTaskRow = {
  legacy_id: string;
  work_package_id: string;
  task_code: string;
  legacy_title: string;
  legacy_status: TaskStatus;
  certifier_authority_level: 'A' | 'B' | 'C';
  tenant_id: string;
  franchise_id: string | null;
  domain_id: AmroDomainId;
  version: AmroApiVersion;
};

export type LegacyComplianceGateRow = {
  legacy_gate_id: string;
  work_package_id: string;
  task_code: string;
  decision: ComplianceDecision;
  decided_by: string | null;
  decided_at: string | null;
  tenant_id: string;
  franchise_id: string | null;
  domain_id: AmroDomainId;
  version: AmroApiVersion;
};

export type WorkPackageItem = {
  id: string;
  code: string;
  title: string;
  status: WorkPackageStatus;
  tenantId: string;
  franchiseId: string | null;
  domainId: AmroDomainId;
  version: AmroApiVersion;
};

export type TaskItem = {
  id: string;
  workPackageId: string;
  taskCode: string;
  title: string;
  status: TaskStatus;
  certifierAuthorityLevel: 'A' | 'B' | 'C';
  tenantId: string;
  franchiseId: string | null;
  domainId: AmroDomainId;
  version: AmroApiVersion;
};

export type ComplianceGateItem = {
  gateId: string;
  workPackageId: string;
  taskCode: string;
  decision: ComplianceDecision;
  decidedBy: string | null;
  decidedAt: string | null;
  tenantId: string;
  franchiseId: string | null;
  domainId: AmroDomainId;
  version: AmroApiVersion;
};

export type AmroIsolationScope = {
  tenantId: string;
  franchiseId: string | null;
  domainId: AmroDomainId;
  version: AmroApiVersion;
};

export const AMRO_SERVICE_DECOMPOSITION: ReadonlyArray<{
  service: AmroServiceName;
  responsibilities: string[];
}> = [
  {
    service: 'amro-work-order-service',
    responsibilities: ['work package commands', 'task commands', 'lifecycle policies'],
  },
  {
    service: 'amro-scheduling-service',
    responsibilities: ['hangar windowing', 'line windowing', 'technician qualification matching'],
  },
  {
    service: 'amro-compliance-service',
    responsibilities: ['authority rule evaluation', 'release-to-service gates', 'evidence signing'],
  },
  {
    service: 'amro-materials-service',
    responsibilities: ['parts allocation', 'install flow', 'remove flow', 'repair flow'],
  },
  {
    service: 'amro-audit-ledger-service',
    responsibilities: ['append-only mro_audit writer', 'mro_audit replay api'],
  },
  {
    service: 'amro-integration-hub-service',
    responsibilities: ['partner payload ingestion', 'replay orchestration', 'callback dispatch'],
  },
  {
    service: 'amro-forecast-service',
    responsibilities: ['risk scoring', 'intervention recommendation', 'model feedback loop'],
  },
] as const;

export const AMRO_DATA_OWNERSHIP = {
  operationalTables: [
    'aircraft',
    'components',
    'work_packages',
    'tasks',
    'staff_qualifications',
    'maintenance_events',
    'work_package_materials',
  ],
  immutableSchema: ['mro_audit.records', 'mro_audit.trails'],
  mandatoryIsolationFields: ['tenant_id', 'franchise_id', 'domain_id', 'version'],
} as const;

export function createAmroIsolationScope(tenantId: string, franchiseId: string | null): AmroIsolationScope {
  return {
    tenantId,
    franchiseId,
    domainId: 'amro',
    version: 'v2',
  };
}

type LegacyScopedRow = {
  tenant_id: string;
  franchise_id: string | null;
  domain_id?: AmroDomainId;
  version?: AmroApiVersion;
};

export function enforceAmroScopedLegacyRows<T extends LegacyScopedRow>(rows: T[], scope: AmroIsolationScope): T[] {
  return rows
    .filter((row) => row.tenant_id === scope.tenantId)
    .filter((row) => scope.franchiseId == null || row.franchise_id === scope.franchiseId)
    .map((row) => ({
      ...row,
      tenant_id: scope.tenantId,
      franchise_id: scope.franchiseId,
      domain_id: scope.domainId,
      version: scope.version,
    }));
}

export function buildAmroServiceBoundaryEnvelope(params: {
  capability: AmroCapability;
  scope: AmroIsolationScope;
  subscriptionStatus: string;
  validatedAt: string;
}) {
  const capabilityServiceMap: Record<AmroCapability, AmroServiceName[]> = {
    'work-packages': ['amro-work-order-service', 'amro-scheduling-service', 'amro-materials-service'],
    tasks: ['amro-work-order-service', 'amro-scheduling-service', 'amro-materials-service'],
    'compliance-gates': ['amro-compliance-service', 'amro-audit-ledger-service'],
    certification: ['amro-compliance-service', 'amro-audit-ledger-service'],
    'integration-hub': ['amro-integration-hub-service', 'amro-audit-ledger-service'],
    'forecast-reliability': ['amro-forecast-service', 'amro-compliance-service'],
  };
  return {
    capability: params.capability,
    services: AMRO_SERVICE_DECOMPOSITION.filter((entry) => capabilityServiceMap[params.capability].includes(entry.service)),
    dataOwnership: AMRO_DATA_OWNERSHIP,
    scopedAccess: {
      tenant_id: params.scope.tenantId,
      franchise_id: params.scope.franchiseId,
      domain_id: params.scope.domainId,
      version: params.scope.version,
      domainAssignmentValidation: {
        provider: 'platform_domains + tenant_domain_assignments',
        status: params.subscriptionStatus,
        validatedAt: params.validatedAt,
      },
    },
  };
}

export function buildAmroIntegrationContractEnvelope(params: {
  capability: AmroCapability;
  tenantId: string;
  franchiseId: string | null;
  endpointRollout: Record<string, unknown>;
  auditLedgerCutover: Record<string, unknown>;
}) {
  return {
    contracts: AMRO_INTEGRATION_CONTRACTS,
    coexistence: {
      safeguards: AMRO_COEXISTENCE_SAFEGUARDS,
      featureFlags: {
        capability: params.capability,
        tenantId: params.tenantId,
        franchiseId: params.franchiseId,
        endpointRollout: params.endpointRollout,
        auditLedgerCutover: params.auditLedgerCutover,
      },
    },
  };
}

function toModuleId(legacyId: string): string {
  return legacyId.startsWith('legacy-') ? legacyId.replace('legacy-', 'amro-') : `amro-${legacyId}`;
}

function toModuleTitle(legacyTitle: string): string {
  return legacyTitle.startsWith('Legacy ') ? `AMRO ${legacyTitle.slice(7)}` : legacyTitle;
}

export function adaptLegacyWorkPackages(rows: LegacyWorkPackageRow[]): WorkPackageItem[] {
  return rows.map((row) => ({
    id: row.legacy_id,
    code: row.legacy_code,
    title: row.legacy_title,
    status: row.legacy_status,
    tenantId: row.tenant_id,
    franchiseId: row.franchise_id,
    domainId: row.domain_id,
    version: row.version,
  }));
}

export function adaptModuleWorkPackagesFromLegacy(rows: LegacyWorkPackageRow[]): WorkPackageItem[] {
  return rows.map((row) => ({
    id: toModuleId(row.legacy_id),
    code: row.legacy_code,
    title: toModuleTitle(row.legacy_title),
    status: row.legacy_status,
    tenantId: row.tenant_id,
    franchiseId: row.franchise_id,
    domainId: row.domain_id,
    version: row.version,
  }));
}

export function adaptLegacyTasks(rows: LegacyTaskRow[]): TaskItem[] {
  return rows.map((row) => ({
    id: row.legacy_id,
    workPackageId: row.work_package_id,
    taskCode: row.task_code,
    title: row.legacy_title,
    status: row.legacy_status,
    certifierAuthorityLevel: row.certifier_authority_level,
    tenantId: row.tenant_id,
    franchiseId: row.franchise_id,
    domainId: row.domain_id,
    version: row.version,
  }));
}

export function adaptModuleTasksFromLegacy(rows: LegacyTaskRow[]): TaskItem[] {
  return rows.map((row) => ({
    id: toModuleId(row.legacy_id),
    workPackageId: row.work_package_id,
    taskCode: row.task_code,
    title: toModuleTitle(row.legacy_title),
    status: row.legacy_status,
    certifierAuthorityLevel: row.certifier_authority_level,
    tenantId: row.tenant_id,
    franchiseId: row.franchise_id,
    domainId: row.domain_id,
    version: row.version,
  }));
}

export function adaptLegacyComplianceGates(rows: LegacyComplianceGateRow[]): ComplianceGateItem[] {
  return rows.map((row) => ({
    gateId: row.legacy_gate_id,
    workPackageId: row.work_package_id,
    taskCode: row.task_code,
    decision: row.decision,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    tenantId: row.tenant_id,
    franchiseId: row.franchise_id,
    domainId: row.domain_id,
    version: row.version,
  }));
}

export function adaptModuleComplianceGatesFromLegacy(rows: LegacyComplianceGateRow[]): ComplianceGateItem[] {
  return rows.map((row) => ({
    gateId: toModuleId(row.legacy_gate_id),
    workPackageId: row.work_package_id,
    taskCode: row.task_code,
    decision: row.decision,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    tenantId: row.tenant_id,
    franchiseId: row.franchise_id,
    domainId: row.domain_id,
    version: row.version,
  }));
}
