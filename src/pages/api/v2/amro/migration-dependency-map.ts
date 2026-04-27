import type { AmroV2EndpointRolloutState, AmroAuditLedgerCutoverState } from './audit-ledger-cutover';
import type { AmroCapability } from './anti-corruption-adapter';

export type AmroMigrationDependencyStepId =
  | 'domain-access-governance'
  | 'schema-activation-rls-scoped-data-access'
  | 'work-order-task-command-paths'
  | 'compliance-gate-audit-ledger-cutover'
  | 'materials-predictive-integrations'
  | 'external-adapters-retry-dead-letter';

export type AmroExternalAdapterName = 'sap-pm' | 'maximo' | 'oracle-eam';
export type AmroRolloutPhase = 'low-risk-tenants' | 'regional-cohorts' | 'global-rollout';

export const AMRO_MIGRATION_DEPENDENCY_ORDER: ReadonlyArray<{
  id: AmroMigrationDependencyStepId;
  title: string;
  checks: string[];
}> = [
  {
    id: 'domain-access-governance',
    title: 'Domain access governance and assignment checks',
    checks: [
      'platform_domains + tenant_domain_assignments validation is active',
      'tenant + franchise scope is applied for every AMRO command path',
    ],
  },
  {
    id: 'schema-activation-rls-scoped-data-access',
    title: 'AMRO schema activation and RLS/ScopedDataAccess conformance',
    checks: [
      'AMRO operational and audit schemas are active',
      'RLS tenant/franchise predicates are enforced with admin audit trail',
      'ScopedDataAccess semantics are preserved at API boundaries',
    ],
  },
  {
    id: 'work-order-task-command-paths',
    title: 'Work package/task command path extraction',
    checks: [
      'legacy maintenance-like flows map to AMRO command/event contracts',
      'command handlers emit deterministic AMRO events with idempotency keys',
    ],
  },
  {
    id: 'compliance-gate-audit-ledger-cutover',
    title: 'Compliance gate and audit ledger cutover',
    checks: [
      'compliance gate decisions are routed through AMRO v2 paths',
      'audit ledger appends source hash, batch id, and replay checkpoint',
    ],
  },
  {
    id: 'materials-predictive-integrations',
    title: 'Materials and predictive integrations',
    checks: [
      'materials allocation integrates with AMRO lifecycle events',
      'predictive integrations read AMRO event streams without bypassing scope',
    ],
  },
  {
    id: 'external-adapters-retry-dead-letter',
    title: 'External adapters with retry and dead-letter protection',
    checks: [
      'SAP PM, Maximo, and Oracle EAM adapters are retry-protected',
      'dead-letter routing and replay paths are active for adapter failures',
    ],
  },
] as const;

export const AMRO_MIGRATION_TASKS: ReadonlyArray<{
  task: string;
  outcome: string;
}> = [
  {
    task: 'Map maintenance-like legacy flows to AMRO commands and events',
    outcome: 'work package, task, and compliance decisions produce canonical AMRO events',
  },
  {
    task: 'Introduce anti-corruption adapters for legacy workflow tables and endpoint contracts',
    outcome: 'legacy workflows remain backward compatible while AMRO v2 contracts are authoritative',
  },
  {
    task: 'Backfill historical records with source hash, migration batch id, and replay checkpoints',
    outcome: 'historical replay and forensic verification are deterministic',
  },
  {
    task: 'Enable canary by low-risk tenants, then regional cohorts, then global rollout',
    outcome: 'phased risk-controlled migration with explicit cohort gates',
  },
] as const;

export const AMRO_FLOW_COMMAND_EVENT_MAP: ReadonlyArray<{
  legacyFlow: string;
  amroCommandPath: string;
  emittedEvent: string;
}> = [
  {
    legacyFlow: 'legacy_work_orders.create',
    amroCommandPath: '/api/v2/amro/work-orders',
    emittedEvent: 'amro.work_order.created.v1',
  },
  {
    legacyFlow: 'legacy_work_orders.tasks.complete',
    amroCommandPath: '/api/v2/amro/tasks',
    emittedEvent: 'amro.task.completed.v1',
  },
  {
    legacyFlow: 'legacy_compliance.decide_gate',
    amroCommandPath: '/api/v2/amro/compliance-gates',
    emittedEvent: 'amro.compliance.gate_decided.v1',
  },
] as const;

export const AMRO_ANTI_CORRUPTION_ADAPTERS: ReadonlyArray<{
  legacySurface: string;
  adapterRole: string;
  amroContract: string;
}> = [
  {
    legacySurface: 'legacy_work_orders table',
    adapterRole: 'row mapping, scope hardening, deterministic ID translation',
    amroContract: '/api/v2/amro/work-orders',
  },
  {
    legacySurface: 'legacy_tasks table',
    adapterRole: 'task command translation and compatibility projection',
    amroContract: '/api/v2/amro/tasks',
  },
  {
    legacySurface: 'legacy_compliance_gate table',
    adapterRole: 'gate decision normalization and contract parity enforcement',
    amroContract: '/api/v2/amro/compliance-gates',
  },
] as const;

export const AMRO_BACKFILL_METADATA_FIELDS = ['sourceHash', 'migrationBatchId', 'replayCheckpoint'] as const;

export const AMRO_EXTERNAL_ADAPTERS: ReadonlyArray<{
  name: AmroExternalAdapterName;
  retry: {
    maxAttempts: number;
    strategy: 'exponential-backoff';
    baseDelayMs: number;
    maxDelayMs: number;
  };
  deadLetter: {
    queue: string;
    replayCommandPath: string;
  };
}> = [
  {
    name: 'sap-pm',
    retry: {
      maxAttempts: 5,
      strategy: 'exponential-backoff',
      baseDelayMs: 250,
      maxDelayMs: 10_000,
    },
    deadLetter: {
      queue: 'amro.sap_pm.dlq',
      replayCommandPath: '/api/v2/amro/work-orders',
    },
  },
  {
    name: 'maximo',
    retry: {
      maxAttempts: 5,
      strategy: 'exponential-backoff',
      baseDelayMs: 250,
      maxDelayMs: 10_000,
    },
    deadLetter: {
      queue: 'amro.maximo.dlq',
      replayCommandPath: '/api/v2/amro/tasks',
    },
  },
  {
    name: 'oracle-eam',
    retry: {
      maxAttempts: 5,
      strategy: 'exponential-backoff',
      baseDelayMs: 250,
      maxDelayMs: 10_000,
    },
    deadLetter: {
      queue: 'amro.oracle_eam.dlq',
      replayCommandPath: '/api/v2/amro/compliance-gates',
    },
  },
] as const;

export const AMRO_SUCCESS_CRITERIA_THRESHOLDS = {
  historicalReplayParityMin: 0.9999,
  complianceDecisionAccuracyMin: 0.9999,
  rollbackSwitchbackSecondsMax: 300,
  crossTenantLeakageMax: 0,
} as const;

export type AmroMigrationValidationInput = {
  crossTenantLeakageCount: number;
  replayCompared: number;
  replayMatched: number;
  complianceCompared: number;
  complianceMatched: number;
  switchbackSeconds: number;
};

export type AmroMigrationValidationReport = {
  noCrossTenantFranchiseLeakage: { passed: boolean; observedLeakage: number; maxAllowed: number };
  historicalReplayParity: { passed: boolean; observed: number; minimum: number };
  complianceGateDecisionAccuracy: { passed: boolean; observed: number; minimum: number };
  rollbackReadiness: { passed: boolean; observedSwitchbackSeconds: number; maxAllowedSeconds: number };
  overallPassed: boolean;
};

export function evaluateAmroMigrationValidation(input: AmroMigrationValidationInput): AmroMigrationValidationReport {
  const replayParity = input.replayCompared <= 0 ? 1 : input.replayMatched / input.replayCompared;
  const complianceAccuracy = input.complianceCompared <= 0 ? 1 : input.complianceMatched / input.complianceCompared;
  const noLeakagePassed = input.crossTenantLeakageCount <= AMRO_SUCCESS_CRITERIA_THRESHOLDS.crossTenantLeakageMax;
  const replayPassed = replayParity >= AMRO_SUCCESS_CRITERIA_THRESHOLDS.historicalReplayParityMin;
  const compliancePassed = complianceAccuracy >= AMRO_SUCCESS_CRITERIA_THRESHOLDS.complianceDecisionAccuracyMin;
  const rollbackPassed = input.switchbackSeconds <= AMRO_SUCCESS_CRITERIA_THRESHOLDS.rollbackSwitchbackSecondsMax;
  return {
    noCrossTenantFranchiseLeakage: {
      passed: noLeakagePassed,
      observedLeakage: input.crossTenantLeakageCount,
      maxAllowed: AMRO_SUCCESS_CRITERIA_THRESHOLDS.crossTenantLeakageMax,
    },
    historicalReplayParity: {
      passed: replayPassed,
      observed: Number(replayParity.toFixed(6)),
      minimum: AMRO_SUCCESS_CRITERIA_THRESHOLDS.historicalReplayParityMin,
    },
    complianceGateDecisionAccuracy: {
      passed: compliancePassed,
      observed: Number(complianceAccuracy.toFixed(6)),
      minimum: AMRO_SUCCESS_CRITERIA_THRESHOLDS.complianceDecisionAccuracyMin,
    },
    rollbackReadiness: {
      passed: rollbackPassed,
      observedSwitchbackSeconds: input.switchbackSeconds,
      maxAllowedSeconds: AMRO_SUCCESS_CRITERIA_THRESHOLDS.rollbackSwitchbackSecondsMax,
    },
    overallPassed: noLeakagePassed && replayPassed && compliancePassed && rollbackPassed,
  };
}

function parseRolloutPhase(value: string | undefined): AmroRolloutPhase {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'global-rollout') return 'global-rollout';
  if (normalized === 'regional-cohorts') return 'regional-cohorts';
  return 'low-risk-tenants';
}

export function resolveAmroMigrationRolloutPhase(): AmroRolloutPhase {
  return parseRolloutPhase(process.env.AMRO_MIGRATION_ROLLOUT_PHASE);
}

export function buildAmroMigrationDependencyEnvelope(input: {
  capability: AmroCapability;
  tenantId: string;
  franchiseId: string | null;
  subscriptionStatus: string;
  validatedAt: string;
  endpointRollout: AmroV2EndpointRolloutState;
  auditLedgerCutover: AmroAuditLedgerCutoverState;
  validation: AmroMigrationValidationReport;
}) {
  const rolloutPhase = resolveAmroMigrationRolloutPhase();
  return {
    dependencyOrder: AMRO_MIGRATION_DEPENDENCY_ORDER,
    migrationTasks: AMRO_MIGRATION_TASKS,
    flowCommandEventMap: AMRO_FLOW_COMMAND_EVENT_MAP,
    antiCorruptionAdapters: AMRO_ANTI_CORRUPTION_ADAPTERS,
    backfill: {
      requiredMetadata: AMRO_BACKFILL_METADATA_FIELDS,
      batchTracking: 'migration batch id + replay checkpoint per compatibility scope',
    },
    rollout: {
      phase: rolloutPhase,
      sequence: ['low-risk-tenants', 'regional-cohorts', 'global-rollout'] as const,
      endpointRollout: input.endpointRollout,
      auditLedgerCutover: input.auditLedgerCutover,
    },
    externalAdapters: AMRO_EXTERNAL_ADAPTERS,
    successCriteria: {
      noCrossTenantFranchiseLeakage: 'No cross-tenant/franchise leakage in audit verification',
      historicalReplayParity: 'Historical replay parity >= 99.99% for migrated records',
      complianceGateDecisionAccuracy: 'Compliance gate decision accuracy parity with baseline rule engines',
      rollbackReadiness: 'Rollback readiness proven with <= 5 minute switchback',
      thresholds: AMRO_SUCCESS_CRITERIA_THRESHOLDS,
      validation: input.validation,
    },
    scope: {
      capability: input.capability,
      tenantId: input.tenantId,
      franchiseId: input.franchiseId,
      subscriptionStatus: input.subscriptionStatus,
      validatedAt: input.validatedAt,
    },
  };
}
