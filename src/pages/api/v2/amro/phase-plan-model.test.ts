import { describe, expect, it, vi } from 'vitest';
import {
  AMRO_DEVELOPMENT_DELIVERY_SEQUENCE,
  AMRO_PHASE_PLAN_MATRIX,
  buildAmroDevelopmentBlueprintEnvelope,
  buildAmroGaReadinessEnvelope,
  buildAmroPhasePlanProgressEnvelope,
  buildAmroSequentialImplementationEnvelope,
  enforceAmroSequentialMilestoneForAuditReplay,
  enforceAmroSequentialMilestoneForForecastReliabilityInterface,
  enforceAmroSequentialMilestoneForTaskInterface,
  enforceAmroSequentialMilestoneForWorkPackageInterface,
  resolveAmroPhasePlanStatuses,
} from './phase-plan-model';

describe('phase-plan-model', () => {
  it('returns the expected five phases from the implementation matrix', () => {
    expect(AMRO_PHASE_PLAN_MATRIX.length).toBe(5);
    expect(AMRO_PHASE_PLAN_MATRIX[0]).toMatchObject({
      label: 'P0 Foundation',
      backendBuildScope: expect.stringContaining('v2 API skeletons'),
    });
    expect(AMRO_PHASE_PLAN_MATRIX[4]).toMatchObject({
      label: 'P4 Integration and Scale',
      testScope: expect.stringContaining('DR validation tests'),
    });
  });

  it('builds the section 24 development blueprint delivery sequence and checklist summary', () => {
    vi.stubEnv('AMRO_MODCHECK_IO_CONTRACTS_PASS', 'true');
    vi.stubEnv('AMRO_MODCHECK_SCREEN_ROLE_PERMISSIONS_VALIDATED', 'true');
    vi.stubEnv('AMRO_MODCHECK_WORKFLOW_ERROR_PATH_TESTS_PASS', 'true');
    vi.stubEnv('AMRO_MODCHECK_API_ERROR_IDEMPOTENCY_VALIDATED', 'true');
    vi.stubEnv('AMRO_MODCHECK_SCHEMA_INDEX_RLS_TESTS_PASS', 'false');
    vi.stubEnv('AMRO_MODCHECK_SECURITY_AUDIT_EVIDENCE_VERIFIED', 'false');
    vi.stubEnv('AMRO_MODCHECK_PERFORMANCE_BENCHMARKS_MET', 'false');

    const blueprint = buildAmroDevelopmentBlueprintEnvelope();
    expect(AMRO_DEVELOPMENT_DELIVERY_SEQUENCE.length).toBe(7);
    expect(blueprint.deliverySequence[0]).toMatchObject({
      id: 'S1',
      sequence: 1,
      dependencyGate: 'Security and architecture sign-off',
    });
    expect(blueprint.deliverySequence[6]).toMatchObject({
      id: 'S7',
      dependencyGate: 'End-to-end integration certification pass',
    });
    expect(blueprint.moduleCompletionChecklist.summary).toMatchObject({
      totalChecks: 7,
      satisfiedChecks: 4,
      pendingChecks: 3,
      completionRatio: 0.57,
    });

    vi.unstubAllEnvs();
  });

  it('resolves status from environment and builds progress summary', () => {
    vi.stubEnv('AMRO_PHASE_P0_STATUS', 'completed');
    vi.stubEnv('AMRO_PHASE_P1_STATUS', 'in-progress');
    vi.stubEnv('AMRO_PHASE_P2_STATUS', 'not-started');
    vi.stubEnv('AMRO_PHASE_P3_STATUS', 'not-started');
    vi.stubEnv('AMRO_PHASE_P4_STATUS', 'not-started');

    const statuses = resolveAmroPhasePlanStatuses();
    expect(statuses['p0-foundation']).toBe('completed');
    expect(statuses['p1-core-workflows']).toBe('in-progress');

    const envelope = buildAmroPhasePlanProgressEnvelope();
    expect(envelope.summary.totalPhases).toBe(5);
    expect(envelope.summary.completedPhases).toBe(1);
    expect(envelope.summary.inProgressPhases).toBe(1);
    expect(envelope.summary.notStartedPhases).toBe(3);
    expect(envelope.summary.completionRatio).toBe(0.2);
    expect(envelope.rows.map((row) => row.status)).toEqual(['completed', 'in-progress', 'not-started', 'not-started', 'not-started']);

    vi.unstubAllEnvs();
  });

  it('builds sequential implementation envelope with prerequisites and milestones', () => {
    vi.stubEnv('AMRO_SEQ_PREREQ_ARCH_SECURITY_APPROVED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_ISOLATION_CONTROLS_DEFINED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_BACKWARD_COMPAT_COMPLETED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_TEST_PLAN_READY', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_OBSERVABILITY_BASELINE_READY', 'true');
    vi.stubEnv('AMRO_SEQ_M1_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M2_STATUS', 'in-progress');
    vi.stubEnv('AMRO_SEQ_M3_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M4_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M5_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M6_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M7_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M8_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M9_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M10_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M1_CORE_SCHEMA_MIGRATED', 'true');
    vi.stubEnv('AMRO_SEQ_M1_RLS_ENABLED', 'true');
    vi.stubEnv('AMRO_SEQ_M1_TENANT_LEAKAGE_TESTS_100', 'true');
    vi.stubEnv('AMRO_SEQ_M1_JWT_SIGNING_KEY_ONLY', 'true');

    const envelope = buildAmroSequentialImplementationEnvelope();
    expect(envelope.strictOrder).toEqual(['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10']);
    expect(envelope.prerequisites.every((item) => item.satisfied)).toBe(true);
    expect(envelope.milestones[0]).toMatchObject({
      id: 'M1',
      executionOrder: 1,
      status: 'completed',
    });
    expect(envelope.milestones[7]).toMatchObject({
      id: 'M8',
      requiredDependencies: ['M2', 'M3', 'M5', 'M7'],
    });

    vi.unstubAllEnvs();
  });

  it('builds GA readiness envelope with DR, rollback, and runbook evidence checks', () => {
    vi.stubEnv('AMRO_SEQ_PREREQ_ARCH_SECURITY_APPROVED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_ISOLATION_CONTROLS_DEFINED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_BACKWARD_COMPAT_COMPLETED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_TEST_PLAN_READY', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_OBSERVABILITY_BASELINE_READY', 'true');
    vi.stubEnv('AMRO_SEQ_M1_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M2_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M3_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M4_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M5_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M6_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M7_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M8_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M9_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M10_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M10_P95_P99_SLO_TARGETS_MET', 'true');
    vi.stubEnv('AMRO_SEQ_M10_MULTI_REGION_FAILOVER_PASS', 'true');
    vi.stubEnv('AMRO_SEQ_M10_DR_REHEARSAL_EVIDENCE_PASS', 'true');
    vi.stubEnv('AMRO_SEQ_M10_ROLLBACK_REHEARSAL_PASS', 'true');
    vi.stubEnv('AMRO_SEQ_M10_RUNBOOK_EVIDENCE_APPROVED', 'true');
    vi.stubEnv('AMRO_SEQ_M10_SECURITY_REGRESSION_ZERO_CRITICAL', 'true');

    const readiness = buildAmroGaReadinessEnvelope();
    expect(readiness.status).toBe('completed');
    expect(readiness.readyForGa).toBe(true);
    expect(readiness.criteria.some((item) => item.key === 'rollback_rehearsal_evidence')).toBe(true);
    expect(readiness.criteria.some((item) => item.key === 'runbook_operational_readiness')).toBe(true);

    vi.unstubAllEnvs();
  });

  it('blocks work package interface when dependencies are incomplete', () => {
    vi.stubEnv('AMRO_SEQ_PREREQ_ARCH_SECURITY_APPROVED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_ISOLATION_CONTROLS_DEFINED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_BACKWARD_COMPAT_COMPLETED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_TEST_PLAN_READY', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_OBSERVABILITY_BASELINE_READY', 'true');
    vi.stubEnv('AMRO_SEQ_M1_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M2_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M3_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M4_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M5_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M6_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M7_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M8_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M9_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M10_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M1_CORE_SCHEMA_MIGRATED', 'true');
    vi.stubEnv('AMRO_SEQ_M1_RLS_ENABLED', 'true');
    vi.stubEnv('AMRO_SEQ_M1_TENANT_LEAKAGE_TESTS_100', 'true');
    vi.stubEnv('AMRO_SEQ_M1_JWT_SIGNING_KEY_ONLY', 'true');
    vi.stubEnv('AMRO_SEQ_M2_API_CONTRACT_TESTS_PASS', 'true');
    vi.stubEnv('AMRO_SEQ_M2_TRANSITION_NEGATIVE_PATH_TESTS_PASS', 'true');
    vi.stubEnv('AMRO_SEQ_M2_E2E_CREATE_TRANSITION_100', 'true');

    expect(() => enforceAmroSequentialMilestoneForWorkPackageInterface('run-replan-simulation')).toThrow(
      /Sequential milestone M3 is not started/
    );

    vi.unstubAllEnvs();
  });

  it('blocks task interface when prerequisite gates are not satisfied', () => {
    vi.stubEnv('AMRO_SEQ_PREREQ_ARCH_SECURITY_APPROVED', 'false');
    vi.stubEnv('AMRO_SEQ_PREREQ_ISOLATION_CONTROLS_DEFINED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_BACKWARD_COMPAT_COMPLETED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_TEST_PLAN_READY', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_OBSERVABILITY_BASELINE_READY', 'true');
    vi.stubEnv('AMRO_SEQ_M1_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M2_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M3_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M4_STATUS', 'in-progress');
    vi.stubEnv('AMRO_SEQ_M5_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M6_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M7_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M8_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M9_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M10_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M1_CORE_SCHEMA_MIGRATED', 'true');
    vi.stubEnv('AMRO_SEQ_M1_RLS_ENABLED', 'true');
    vi.stubEnv('AMRO_SEQ_M1_TENANT_LEAKAGE_TESTS_100', 'true');
    vi.stubEnv('AMRO_SEQ_M1_JWT_SIGNING_KEY_ONLY', 'true');
    vi.stubEnv('AMRO_SEQ_M2_API_CONTRACT_TESTS_PASS', 'true');
    vi.stubEnv('AMRO_SEQ_M2_TRANSITION_NEGATIVE_PATH_TESTS_PASS', 'true');
    vi.stubEnv('AMRO_SEQ_M2_E2E_CREATE_TRANSITION_100', 'true');
    vi.stubEnv('AMRO_SEQ_M3_CAPACITY_VALIDATION_TESTS_PASS', 'true');
    vi.stubEnv('AMRO_SEQ_M3_REPLAN_SIMULATION_TESTS_100', 'true');
    vi.stubEnv('AMRO_SEQ_M3_SCHEDULING_P95_TARGET_MET', 'true');

    expect(() => enforceAmroSequentialMilestoneForTaskInterface('upload-evidence')).toThrow(
      /Sequential implementation prerequisites not satisfied/
    );

    vi.unstubAllEnvs();
  });

  it('blocks M8 interface when dependencies are incomplete', () => {
    vi.stubEnv('AMRO_SEQ_PREREQ_ARCH_SECURITY_APPROVED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_ISOLATION_CONTROLS_DEFINED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_BACKWARD_COMPAT_COMPLETED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_TEST_PLAN_READY', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_OBSERVABILITY_BASELINE_READY', 'true');
    vi.stubEnv('AMRO_SEQ_M1_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M2_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M3_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M4_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M5_STATUS', 'in-progress');
    vi.stubEnv('AMRO_SEQ_M6_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M7_STATUS', 'in-progress');
    vi.stubEnv('AMRO_SEQ_M8_STATUS', 'in-progress');
    vi.stubEnv('AMRO_SEQ_M9_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M10_STATUS', 'not-started');

    expect(() => enforceAmroSequentialMilestoneForForecastReliabilityInterface('score-maintenance-risk')).toThrow(
      /M5, M7 must be completed before M8/
    );

    vi.unstubAllEnvs();
  });

  it('blocks M3 interfaces when dependency milestone acceptance criteria are incomplete', () => {
    vi.stubEnv('AMRO_SEQ_PREREQ_ARCH_SECURITY_APPROVED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_ISOLATION_CONTROLS_DEFINED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_BACKWARD_COMPAT_COMPLETED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_TEST_PLAN_READY', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_OBSERVABILITY_BASELINE_READY', 'true');
    vi.stubEnv('AMRO_SEQ_M1_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M2_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M3_STATUS', 'in-progress');
    vi.stubEnv('AMRO_SEQ_M4_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M5_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M6_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M7_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M8_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M9_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M10_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M1_CORE_SCHEMA_MIGRATED', 'true');
    vi.stubEnv('AMRO_SEQ_M1_RLS_ENABLED', 'true');
    vi.stubEnv('AMRO_SEQ_M1_TENANT_LEAKAGE_TESTS_100', 'true');
    vi.stubEnv('AMRO_SEQ_M1_JWT_SIGNING_KEY_ONLY', 'true');
    vi.stubEnv('AMRO_SEQ_M2_API_CONTRACT_TESTS_PASS', 'true');
    vi.stubEnv('AMRO_SEQ_M2_TRANSITION_NEGATIVE_PATH_TESTS_PASS', 'false');
    vi.stubEnv('AMRO_SEQ_M2_E2E_CREATE_TRANSITION_100', 'true');

    expect(() => enforceAmroSequentialMilestoneForWorkPackageInterface('run-replan-simulation')).toThrow(
      /dependency acceptance criteria check failed/
    );

    vi.unstubAllEnvs();
  });

  it('blocks M4 interfaces when M3 acceptance criteria are incomplete', () => {
    vi.stubEnv('AMRO_SEQ_PREREQ_ARCH_SECURITY_APPROVED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_ISOLATION_CONTROLS_DEFINED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_BACKWARD_COMPAT_COMPLETED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_TEST_PLAN_READY', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_OBSERVABILITY_BASELINE_READY', 'true');
    vi.stubEnv('AMRO_SEQ_M1_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M2_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M3_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M4_STATUS', 'in-progress');
    vi.stubEnv('AMRO_SEQ_M5_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M6_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M7_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M8_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M9_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M10_STATUS', 'not-started');
    vi.stubEnv('AMRO_SEQ_M1_CORE_SCHEMA_MIGRATED', 'true');
    vi.stubEnv('AMRO_SEQ_M1_RLS_ENABLED', 'true');
    vi.stubEnv('AMRO_SEQ_M1_TENANT_LEAKAGE_TESTS_100', 'true');
    vi.stubEnv('AMRO_SEQ_M1_JWT_SIGNING_KEY_ONLY', 'true');
    vi.stubEnv('AMRO_SEQ_M2_API_CONTRACT_TESTS_PASS', 'true');
    vi.stubEnv('AMRO_SEQ_M2_TRANSITION_NEGATIVE_PATH_TESTS_PASS', 'true');
    vi.stubEnv('AMRO_SEQ_M2_E2E_CREATE_TRANSITION_100', 'true');
    vi.stubEnv('AMRO_SEQ_M3_CAPACITY_VALIDATION_TESTS_PASS', 'true');
    vi.stubEnv('AMRO_SEQ_M3_REPLAN_SIMULATION_TESTS_100', 'false');
    vi.stubEnv('AMRO_SEQ_M3_SCHEDULING_P95_TARGET_MET', 'true');

    expect(() => enforceAmroSequentialMilestoneForTaskInterface('update-task-step')).toThrow(
      /dependency acceptance criteria check failed/
    );

    vi.unstubAllEnvs();
  });

  it('blocks M9 replay when M8 is not completed', () => {
    vi.stubEnv('AMRO_SEQ_PREREQ_ARCH_SECURITY_APPROVED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_ISOLATION_CONTROLS_DEFINED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_BACKWARD_COMPAT_COMPLETED', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_TEST_PLAN_READY', 'true');
    vi.stubEnv('AMRO_SEQ_PREREQ_OBSERVABILITY_BASELINE_READY', 'true');
    vi.stubEnv('AMRO_SEQ_M1_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M2_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M3_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M4_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M5_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M6_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M7_STATUS', 'completed');
    vi.stubEnv('AMRO_SEQ_M8_STATUS', 'in-progress');
    vi.stubEnv('AMRO_SEQ_M9_STATUS', 'in-progress');
    vi.stubEnv('AMRO_SEQ_M10_STATUS', 'not-started');

    expect(() => enforceAmroSequentialMilestoneForAuditReplay()).toThrow(
      /M8 must be completed before M9/
    );

    vi.unstubAllEnvs();
  });
});
