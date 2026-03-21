export type AmroPhaseId = 'p0-foundation' | 'p1-core-workflows' | 'p2-compliance-mobility' | 'p3-intelligence-optimization' | 'p4-integration-scale';
export type AmroPhaseStatus = 'not-started' | 'in-progress' | 'completed';
export type AmroSequentialMilestoneId = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M9' | 'M10';
export type AmroSequentialMilestoneStatus = 'not-started' | 'in-progress' | 'completed';
export type AmroSequentialPrerequisiteId =
  | 'architecture-security-scope-approved'
  | 'tenant-franchise-isolation-defined'
  | 'backward-compatibility-assessment-completed'
  | 'test-plan-prepared'
  | 'observability-baseline-available';

export type AmroPhasePlanRow = {
  id: AmroPhaseId;
  label: string;
  backendBuildScope: string;
  frontendBuildScope: string;
  dataAndSecurityScope: string;
  testScope: string;
  deliverables: string;
};

export type AmroSequentialPrerequisiteGate = {
  id: AmroSequentialPrerequisiteId;
  label: string;
  satisfied: boolean;
};

export type AmroSequentialMilestoneCriteria = {
  key: string;
  label: string;
  satisfied: boolean;
};

export type AmroSequentialMilestoneRule = {
  id: AmroSequentialMilestoneId;
  executionOrder: number;
  componentScope: string;
  requiredDependencies: ReadonlyArray<AmroSequentialMilestoneId>;
  criteria: ReadonlyArray<AmroSequentialMilestoneCriteria>;
  status: AmroSequentialMilestoneStatus;
};

export const AMRO_PHASE_PLAN_MATRIX: ReadonlyArray<AmroPhasePlanRow> = [
  {
    id: 'p0-foundation',
    label: 'P0 Foundation',
    backendBuildScope: 'Build v2 API skeletons, request/response envelope utilities, error model, auth middleware hooks',
    frontendBuildScope: 'Build AMRO route shell, module navigation entry points, placeholder pages for Overview/Work Package/Scheduling',
    dataAndSecurityScope: 'Create baseline tables and RLS policies with tenant_id and franchise_id; enforce AMRO domain assignment checks',
    testScope: 'Add unit tests for auth/access middleware and contract health endpoints',
    deliverables: 'Running AMRO domain routes, secured API scaffold, passing CI baseline',
  },
  {
    id: 'p1-core-workflows',
    label: 'P1 Core Workflows',
    backendBuildScope: 'Implement work package lifecycle APIs (create/transition/clone), task step update APIs, parts reserve/shortage APIs',
    frontendBuildScope: 'Implement SCR-AMRO-001/002/003/004/005/006/007 baseline views and forms',
    dataAndSecurityScope: 'Implement schema for work_packages, tasks, reservations, stock movements with policy-safe transitions',
    testScope: 'Add integration tests for plan-to-execute flow and API validation rules',
    deliverables: 'End-to-end flow: create WP -> schedule -> execute task -> reserve parts',
  },
  {
    id: 'p2-compliance-mobility',
    label: 'P2 Compliance and Mobility',
    backendBuildScope: 'Implement compliance gate, exception, dossier APIs; implement certification authority and decision APIs',
    frontendBuildScope: 'Implement SCR-AMRO-008/009/010 and mobile execution behavior including offline queue UX',
    dataAndSecurityScope: 'Add compliance_records, obligations, certification_actions, signed evidence references; enforce ABAC cert rules',
    testScope: 'Add replayable audit tests, signature integrity tests, offline sync conflict tests',
    deliverables: 'Compliance and certification gate path fully executable with audit trail',
  },
  {
    id: 'p3-intelligence-optimization',
    label: 'P3 Intelligence and Optimization',
    backendBuildScope: 'Implement risk scoring, intervention recommendation, feedback capture APIs; optimize heavy queries',
    frontendBuildScope: 'Implement SCR-AMRO-011/012 analytics, forecast explainability, operator action feedback UI',
    dataAndSecurityScope: 'Add forecast_outputs, asset_health_signals, model feedback policy configs',
    testScope: 'Add model contract tests, low-confidence flag tests, p95/p99 performance tests',
    deliverables: 'Forecast loop operational: score -> recommend -> outcome feedback',
  },
  {
    id: 'p4-integration-scale',
    label: 'P4 Integration and Scale',
    backendBuildScope: 'Implement partner ingest/replay/callback hardening, adapter retries, dead-letter/replay orchestration',
    frontendBuildScope: 'Implement integration monitor operational console hardening and admin controls',
    dataAndSecurityScope: 'Add integration_jobs/mappings audit fields, retention rules, and replay governance controls',
    testScope: 'Add adapter contract tests, resilience tests, DR validation tests',
    deliverables: 'Production-ready integrations with replay, observability, and DR evidence',
  },
] as const;

function parseStatus(value: string | undefined): AmroPhaseStatus {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'completed') return 'completed';
  if (normalized === 'in-progress') return 'in-progress';
  return 'not-started';
}

function parseSequentialStatus(value: string | undefined): AmroSequentialMilestoneStatus {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'completed') return 'completed';
  if (normalized === 'in-progress') return 'in-progress';
  return 'not-started';
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

export function resolveAmroPhasePlanStatuses(): Record<AmroPhaseId, AmroPhaseStatus> {
  return {
    'p0-foundation': parseStatus(process.env.AMRO_PHASE_P0_STATUS),
    'p1-core-workflows': parseStatus(process.env.AMRO_PHASE_P1_STATUS),
    'p2-compliance-mobility': parseStatus(process.env.AMRO_PHASE_P2_STATUS),
    'p3-intelligence-optimization': parseStatus(process.env.AMRO_PHASE_P3_STATUS),
    'p4-integration-scale': parseStatus(process.env.AMRO_PHASE_P4_STATUS),
  };
}

export function buildAmroPhasePlanProgressEnvelope() {
  const statuses = resolveAmroPhasePlanStatuses();
  const rows = AMRO_PHASE_PLAN_MATRIX.map((row) => ({
    ...row,
    status: statuses[row.id],
  }));
  const completedCount = rows.filter((row) => row.status === 'completed').length;
  const inProgressCount = rows.filter((row) => row.status === 'in-progress').length;
  const completionRatio = Number((completedCount / rows.length).toFixed(2));
  return {
    rows,
    summary: {
      totalPhases: rows.length,
      completedPhases: completedCount,
      inProgressPhases: inProgressCount,
      notStartedPhases: rows.length - completedCount - inProgressCount,
      completionRatio,
    },
  };
}

const AMRO_SEQUENTIAL_MILESTONE_DEPENDENCIES: Readonly<Record<AmroSequentialMilestoneId, ReadonlyArray<AmroSequentialMilestoneId>>> = {
  M1: [],
  M2: ['M1'],
  M3: ['M1', 'M2'],
  M4: ['M1', 'M2', 'M3'],
  M5: ['M1', 'M2', 'M3', 'M4'],
  M6: ['M1', 'M2', 'M3', 'M4', 'M5'],
  M7: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'],
  M8: ['M2', 'M3', 'M5', 'M7'],
  M9: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'],
  M10: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9'],
} as const;

const AMRO_SEQUENTIAL_STRICT_ORDER = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10'] as const;

const AMRO_SEQUENTIAL_COMPONENT_SCOPE: Readonly<Record<AmroSequentialMilestoneId, string>> = {
  M1: 'Schema foundation, RLS, scoped auth, audit primitives',
  M2: 'Work package core (list/create/detail/transitions)',
  M3: 'Scheduling board and constraint engine',
  M4: 'Task execution mobile path, evidence, offline queue',
  M5: 'Parts and materials reservation and shortage workflow',
  M6: 'Compliance gates and certification release controls',
  M7: 'Integration hub adapters, idempotency, replay controls',
  M8: 'KPI intelligence and forecast recommendation embedding',
  M9: 'Audit replay hardening and export controls',
  M10: 'Performance hardening, DR validation, and GA readiness',
} as const;

const AMRO_WORK_PACKAGE_INTERFACE_MILESTONES: Readonly<Record<string, AmroSequentialMilestoneId>> = {
  'create-work-package': 'M2',
  'transition-work-package': 'M2',
  'clone-template': 'M2',
  'assign-maintenance-slot': 'M3',
  'run-replan-simulation': 'M3',
  'confirm-replan': 'M3',
  'reserve-parts': 'M5',
  'process-shortage-response': 'M5',
  'sync-supplier-eta': 'M5',
} as const;

const AMRO_TASK_INTERFACE_MILESTONES: Readonly<Record<string, AmroSequentialMilestoneId>> = {
  'update-task-step': 'M4',
  'upload-evidence': 'M4',
  'submit-signature': 'M4',
} as const;

const AMRO_COMPLIANCE_INTERFACE_MILESTONES: Readonly<Record<string, AmroSequentialMilestoneId>> = {
  'evaluate-compliance-gate': 'M6',
  'register-exception-request': 'M6',
  'generate-compliance-dossier': 'M6',
} as const;

const AMRO_CERTIFICATION_INTERFACE_MILESTONES: Readonly<Record<string, AmroSequentialMilestoneId>> = {
  'validate-certifying-authority': 'M6',
  'submit-certification-decision': 'M6',
  'escalate-blocked-certification': 'M6',
} as const;

const AMRO_INTEGRATION_HUB_INTERFACE_MILESTONES: Readonly<Record<string, AmroSequentialMilestoneId>> = {
  'ingest-partner-payload': 'M7',
  'replay-failed-integration-job': 'M7',
  'publish-outbound-callback': 'M7',
} as const;

const AMRO_FORECAST_RELIABILITY_INTERFACE_MILESTONES: Readonly<Record<string, AmroSequentialMilestoneId>> = {
  'score-maintenance-risk': 'M8',
  'generate-intervention-recommendations': 'M8',
  'capture-recommendation-outcome': 'M8',
} as const;

const AMRO_OVERVIEW_KPI_INTERFACE_MILESTONES: Readonly<Record<string, AmroSequentialMilestoneId>> = {
  'load-kpi-dashboard': 'M8',
  'load-operational-trends': 'M8',
  'export-kpi-snapshot': 'M9',
} as const;

export function resolveAmroSequentialMilestoneStatuses(): Record<AmroSequentialMilestoneId, AmroSequentialMilestoneStatus> {
  return {
    M1: parseSequentialStatus(process.env.AMRO_SEQ_M1_STATUS),
    M2: parseSequentialStatus(process.env.AMRO_SEQ_M2_STATUS),
    M3: parseSequentialStatus(process.env.AMRO_SEQ_M3_STATUS),
    M4: parseSequentialStatus(process.env.AMRO_SEQ_M4_STATUS),
    M5: parseSequentialStatus(process.env.AMRO_SEQ_M5_STATUS),
    M6: parseSequentialStatus(process.env.AMRO_SEQ_M6_STATUS),
    M7: parseSequentialStatus(process.env.AMRO_SEQ_M7_STATUS),
    M8: parseSequentialStatus(process.env.AMRO_SEQ_M8_STATUS),
    M9: parseSequentialStatus(process.env.AMRO_SEQ_M9_STATUS),
    M10: parseSequentialStatus(process.env.AMRO_SEQ_M10_STATUS),
  };
}

export function resolveAmroSequentialPrerequisiteGates(): ReadonlyArray<AmroSequentialPrerequisiteGate> {
  return [
    {
      id: 'architecture-security-scope-approved',
      label: 'Architecture and security scope approved for Platform -> Admin -> Multi-Tenant -> Multi-Franchisee',
      satisfied: parseBoolean(process.env.AMRO_SEQ_PREREQ_ARCH_SECURITY_APPROVED, false),
    },
    {
      id: 'tenant-franchise-isolation-defined',
      label: 'Tenant/franchise data isolation controls are defined and testable',
      satisfied: parseBoolean(process.env.AMRO_SEQ_PREREQ_ISOLATION_CONTROLS_DEFINED, false),
    },
    {
      id: 'backward-compatibility-assessment-completed',
      label: 'API/schema backward-compatibility impact assessment completed',
      satisfied: parseBoolean(process.env.AMRO_SEQ_PREREQ_BACKWARD_COMPAT_COMPLETED, false),
    },
    {
      id: 'test-plan-prepared',
      label: 'Test plan prepared for unit/integration/contract/security/performance',
      satisfied: parseBoolean(process.env.AMRO_SEQ_PREREQ_TEST_PLAN_READY, false),
    },
    {
      id: 'observability-baseline-available',
      label: 'Observability baseline available with trace IDs, audit events, and telemetry',
      satisfied: parseBoolean(process.env.AMRO_SEQ_PREREQ_OBSERVABILITY_BASELINE_READY, false),
    },
  ] as const;
}

function buildSequentialMilestoneCriteria(): Readonly<Record<AmroSequentialMilestoneId, ReadonlyArray<AmroSequentialMilestoneCriteria>>> {
  return {
    M1: [
      { key: 'core_schema_and_indexes', label: 'Required core tables and indexes migrated', satisfied: parseBoolean(process.env.AMRO_SEQ_M1_CORE_SCHEMA_MIGRATED, false) },
      { key: 'rls_enabled', label: 'RLS enabled on all AMRO scoped tables', satisfied: parseBoolean(process.env.AMRO_SEQ_M1_RLS_ENABLED, false) },
      { key: 'tenant_leakage_tests', label: 'Tenant leakage tests pass at 100%', satisfied: parseBoolean(process.env.AMRO_SEQ_M1_TENANT_LEAKAGE_TESTS_100, false) },
      { key: 'jwt_signing_key_only', label: 'Auth token verification passes with JWT signing key only', satisfied: parseBoolean(process.env.AMRO_SEQ_M1_JWT_SIGNING_KEY_ONLY, false) },
    ],
    M2: [
      { key: 'api_contracts_001_002_003', label: 'API-AMRO-001/002/003 contract tests pass', satisfied: parseBoolean(process.env.AMRO_SEQ_M2_API_CONTRACT_TESTS_PASS, false) },
      { key: 'transition_negative_paths', label: 'Transition policy negative-path tests pass', satisfied: parseBoolean(process.env.AMRO_SEQ_M2_TRANSITION_NEGATIVE_PATH_TESTS_PASS, false) },
      { key: 'create_transition_e2e_staging', label: 'Create-to-transition staging flow passes at 100%', satisfied: parseBoolean(process.env.AMRO_SEQ_M2_E2E_CREATE_TRANSITION_100, false) },
    ],
    M3: [
      { key: 'no_overlap_capacity_validation', label: 'No-overlap and capacity validation tests pass', satisfied: parseBoolean(process.env.AMRO_SEQ_M3_CAPACITY_VALIDATION_TESTS_PASS, false) },
      { key: 'replan_simulation_suite', label: 'Replan simulation test suite passes at 100%', satisfied: parseBoolean(process.env.AMRO_SEQ_M3_REPLAN_SIMULATION_TESTS_100, false) },
      { key: 'scheduling_latency_p95', label: 'Scheduling p95 latency meets Section 19.3 targets', satisfied: parseBoolean(process.env.AMRO_SEQ_M3_SCHEDULING_P95_TARGET_MET, false) },
    ],
    M4: [
      { key: 'step_order_enforcement', label: 'Step-order enforcement tests pass', satisfied: parseBoolean(process.env.AMRO_SEQ_M4_STEP_ORDER_TESTS_PASS, false) },
      { key: 'evidence_checksum_integrity', label: 'Evidence checksum integrity validation passes at 100%', satisfied: parseBoolean(process.env.AMRO_SEQ_M4_EVIDENCE_CHECKSUM_100, false) },
      { key: 'offline_sync_conflict_suite', label: 'Offline sync conflict test suite passes at 100%', satisfied: parseBoolean(process.env.AMRO_SEQ_M4_OFFLINE_SYNC_TESTS_100, false) },
      { key: 'mobile_critical_flows', label: 'Mobile critical technician flows pass', satisfied: parseBoolean(process.env.AMRO_SEQ_M4_MOBILE_CRITICAL_FLOWS_PASS, false) },
    ],
    M5: [
      { key: 'reservation_shortage_negative_paths', label: 'Reservation and shortage negative-path tests pass', satisfied: parseBoolean(process.env.AMRO_SEQ_M5_NEGATIVE_PATH_TESTS_PASS, false) },
      { key: 'serialized_uniqueness_tests', label: 'Serialized uniqueness tests pass', satisfied: parseBoolean(process.env.AMRO_SEQ_M5_SERIALIZED_UNIQUENESS_TESTS_PASS, false) },
      { key: 'shortage_procurement_e2e_scope_safe', label: 'Shortage-to-procurement flow verified end-to-end with zero data-scope violations', satisfied: parseBoolean(process.env.AMRO_SEQ_M5_SHORTAGE_TO_PROCUREMENT_E2E_SCOPE_SAFE, false) },
    ],
    M6: [
      { key: 'gate_evaluation_blocker_handling', label: 'Gate evaluation and blocker handling tests pass', satisfied: parseBoolean(process.env.AMRO_SEQ_M6_GATE_EVALUATION_BLOCKER_TESTS_PASS, false) },
      { key: 'cert_authority_validity_checks', label: 'Certification authority validity checks pass', satisfied: parseBoolean(process.env.AMRO_SEQ_M6_CERT_AUTHORITY_VALIDITY_TESTS_PASS, false) },
      { key: 'zero_unresolved_blocker_rule', label: 'Zero unresolved blocker rule enforced in release tests', satisfied: parseBoolean(process.env.AMRO_SEQ_M6_ZERO_UNRESOLVED_BLOCKER_RULE_PASS, false) },
      { key: 'dossier_generation_tests', label: 'Compliance dossier generation tests pass', satisfied: parseBoolean(process.env.AMRO_SEQ_M6_DOSSIER_GENERATION_TESTS_PASS, false) },
    ],
    M7: [
      { key: 'adapter_contract_tests', label: 'Adapter contract tests pass for enabled integrations', satisfied: parseBoolean(process.env.AMRO_SEQ_M7_ADAPTER_CONTRACT_TESTS_PASS, false) },
      { key: 'idempotency_replay_tests', label: 'Idempotency replay tests pass', satisfied: parseBoolean(process.env.AMRO_SEQ_M7_IDEMPOTENCY_REPLAY_TESTS_PASS, false) },
      { key: 'dlq_replay_recovery_closure', label: 'Dead-letter replay recovery flow closes at 100%', satisfied: parseBoolean(process.env.AMRO_SEQ_M7_DLQ_REPLAY_CLOSURE_100, false) },
    ],
    M8: [
      { key: 'kpi_correctness_baseline', label: 'KPI correctness checks pass against baseline datasets', satisfied: parseBoolean(process.env.AMRO_SEQ_M8_KPI_CORRECTNESS_BASELINE_PASS, false) },
      { key: 'recommendation_contract_explainability', label: 'Recommendation API contract and explainability fields validated', satisfied: parseBoolean(process.env.AMRO_SEQ_M8_RECOMMENDATION_CONTRACT_EXPLAINABILITY_PASS, false) },
      { key: 'low_confidence_policy_behavior', label: 'Low-confidence flag behavior passes policy tests', satisfied: parseBoolean(process.env.AMRO_SEQ_M8_LOW_CONFIDENCE_POLICY_TESTS_PASS, false) },
    ],
    M9: [
      { key: 'hash_chain_validation', label: 'Hash-chain validation tests pass', satisfied: parseBoolean(process.env.AMRO_SEQ_M9_HASH_CHAIN_VALIDATION_TESTS_PASS, false) },
      { key: 'replay_timeline_determinism', label: 'Replay timeline determinism checks pass', satisfied: parseBoolean(process.env.AMRO_SEQ_M9_REPLAY_TIMELINE_DETERMINISM_PASS, false) },
      { key: 'replay_export_contract_auth', label: 'Replay and export APIs pass contract and authorization tests at 100%', satisfied: parseBoolean(process.env.AMRO_SEQ_M9_REPLAY_EXPORT_CONTRACT_AUTH_100, false) },
    ],
    M10: [
      { key: 'p95_p99_slo_targets', label: 'p95/p99 SLO targets meet Section 19.3 and 22', satisfied: parseBoolean(process.env.AMRO_SEQ_M10_P95_P99_SLO_TARGETS_MET, false) },
      { key: 'dr_rehearsal_recovery_evidence', label: 'DR rehearsal completed with documented recovery evidence', satisfied: parseBoolean(process.env.AMRO_SEQ_M10_DR_REHEARSAL_EVIDENCE_PASS, false) },
      { key: 'security_regression_zero_critical', label: 'Security and regression suites pass with zero critical defects', satisfied: parseBoolean(process.env.AMRO_SEQ_M10_SECURITY_REGRESSION_ZERO_CRITICAL, false) },
    ],
  } as const;
}

function listMissingCriteria(criteria: ReadonlyArray<AmroSequentialMilestoneCriteria>): string[] {
  return criteria.filter((item) => !item.satisfied).map((item) => item.label);
}

export function buildAmroSequentialImplementationEnvelope() {
  const statuses = resolveAmroSequentialMilestoneStatuses();
  const prerequisiteGates = resolveAmroSequentialPrerequisiteGates();
  const criteriaMap = buildSequentialMilestoneCriteria();
  const milestones = AMRO_SEQUENTIAL_STRICT_ORDER.map((id, index) => {
    const criteria = criteriaMap[id];
    return {
      id,
      executionOrder: index + 1,
      componentScope: AMRO_SEQUENTIAL_COMPONENT_SCOPE[id],
      requiredDependencies: AMRO_SEQUENTIAL_MILESTONE_DEPENDENCIES[id],
      criteria,
      status: statuses[id],
    };
  });

  return {
    strictOrder: AMRO_SEQUENTIAL_STRICT_ORDER,
    prerequisites: prerequisiteGates,
    milestones,
  };
}

export function enforceAmroSequentialMilestoneForWorkPackageInterface(interfaceName: string): void {
  const milestone = AMRO_WORK_PACKAGE_INTERFACE_MILESTONES[String(interfaceName || '').trim().toLowerCase()];
  if (!milestone) return;
  enforceAmroSequentialMilestone(milestone, interfaceName);
}

export function enforceAmroSequentialMilestoneForTaskInterface(interfaceName: string): void {
  const milestone = AMRO_TASK_INTERFACE_MILESTONES[String(interfaceName || '').trim().toLowerCase()];
  if (!milestone) return;
  enforceAmroSequentialMilestone(milestone, interfaceName);
}

export function enforceAmroSequentialMilestoneForComplianceInterface(interfaceName: string): void {
  const milestone = AMRO_COMPLIANCE_INTERFACE_MILESTONES[String(interfaceName || '').trim().toLowerCase()];
  if (!milestone) return;
  enforceAmroSequentialMilestone(milestone, interfaceName);
}

export function enforceAmroSequentialMilestoneForCertificationInterface(interfaceName: string): void {
  const milestone = AMRO_CERTIFICATION_INTERFACE_MILESTONES[String(interfaceName || '').trim().toLowerCase()];
  if (!milestone) return;
  enforceAmroSequentialMilestone(milestone, interfaceName);
}

export function enforceAmroSequentialMilestoneForIntegrationHubInterface(interfaceName: string): void {
  const milestone = AMRO_INTEGRATION_HUB_INTERFACE_MILESTONES[String(interfaceName || '').trim().toLowerCase()];
  if (!milestone) return;
  enforceAmroSequentialMilestone(milestone, interfaceName);
}

export function enforceAmroSequentialMilestoneForForecastReliabilityInterface(interfaceName: string): void {
  const milestone = AMRO_FORECAST_RELIABILITY_INTERFACE_MILESTONES[String(interfaceName || '').trim().toLowerCase()];
  if (!milestone) return;
  enforceAmroSequentialMilestone(milestone, interfaceName);
}

export function enforceAmroSequentialMilestoneForOverviewKpiInterface(interfaceName: string): void {
  const milestone = AMRO_OVERVIEW_KPI_INTERFACE_MILESTONES[String(interfaceName || '').trim().toLowerCase()];
  if (!milestone) return;
  enforceAmroSequentialMilestone(milestone, interfaceName);
}

export function enforceAmroSequentialMilestoneForAuditReplay(): void {
  enforceAmroSequentialMilestone('M9', 'audit-ledger-replay');
}

function enforceAmroSequentialMilestone(milestone: AmroSequentialMilestoneId, interfaceName: string): void {
  const prerequisiteGates = resolveAmroSequentialPrerequisiteGates();
  const unsatisfiedPrerequisites = prerequisiteGates.filter((gate) => !gate.satisfied).map((gate) => gate.label);
  if (unsatisfiedPrerequisites.length > 0) {
    throw new Error(`Sequential implementation prerequisites not satisfied for ${interfaceName}: ${unsatisfiedPrerequisites.join('; ')}`);
  }

  const statuses = resolveAmroSequentialMilestoneStatuses();
  const dependencyFailures = AMRO_SEQUENTIAL_MILESTONE_DEPENDENCIES[milestone].filter((dependency) => statuses[dependency] !== 'completed');
  if (dependencyFailures.length > 0) {
    throw new Error(`Sequential milestone dependency check failed for ${interfaceName}: ${dependencyFailures.join(', ')} must be completed before ${milestone}`);
  }
  const criteriaMap = buildSequentialMilestoneCriteria();
  const dependencyCriteriaFailures = AMRO_SEQUENTIAL_MILESTONE_DEPENDENCIES[milestone]
    .map((dependency) => {
      const missingCriteria = listMissingCriteria(criteriaMap[dependency]);
      if (missingCriteria.length === 0) return null;
      return `${dependency}: ${missingCriteria.join('; ')}`;
    })
    .filter((entry): entry is string => Boolean(entry));
  if (dependencyCriteriaFailures.length > 0) {
    throw new Error(
      `Sequential milestone dependency acceptance criteria check failed for ${interfaceName}: ${dependencyCriteriaFailures.join(' | ')}`
    );
  }

  if (statuses[milestone] === 'not-started') {
    throw new Error(`Sequential milestone ${milestone} is not started; ${interfaceName} cannot execute out of order`);
  }

  if (statuses[milestone] === 'completed') {
    const criteria = criteriaMap[milestone];
    const missingCriteria = listMissingCriteria(criteria);
    if (missingCriteria.length > 0) {
      throw new Error(`Sequential milestone ${milestone} acceptance criteria are incomplete for ${interfaceName}: ${missingCriteria.join('; ')}`);
    }
  }
}
