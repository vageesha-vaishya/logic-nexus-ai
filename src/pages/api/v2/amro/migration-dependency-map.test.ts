import { beforeEach, describe, expect, it } from 'vitest';
import {
  AMRO_EXTERNAL_ADAPTERS,
  AMRO_FLOW_COMMAND_EVENT_MAP,
  AMRO_MIGRATION_DEPENDENCY_ORDER,
  AMRO_MIGRATION_TASKS,
  buildAmroMigrationDependencyEnvelope,
  evaluateAmroMigrationValidation,
} from './migration-dependency-map';

describe('AMRO 13.4 migration dependency map', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  it('defines dependency order, migration tasks, and mapped command paths', () => {
    expect(AMRO_MIGRATION_DEPENDENCY_ORDER.map((item) => item.id)).toEqual([
      'domain-access-governance',
      'schema-activation-rls-scoped-data-access',
      'work-order-task-command-paths',
      'compliance-gate-audit-ledger-cutover',
      'materials-predictive-integrations',
      'external-adapters-retry-dead-letter',
    ]);
    expect(AMRO_MIGRATION_TASKS.length).toBe(4);
    expect(AMRO_FLOW_COMMAND_EVENT_MAP).toEqual([
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
    ]);
  });

  it('provides retry and dead-letter protection for external adapters', () => {
    expect(AMRO_EXTERNAL_ADAPTERS.map((item) => item.name)).toEqual(['sap-pm', 'maximo', 'oracle-eam']);
    expect(AMRO_EXTERNAL_ADAPTERS.every((item) => item.retry.maxAttempts > 1)).toBe(true);
    expect(AMRO_EXTERNAL_ADAPTERS.every((item) => item.deadLetter.queue.includes('dlq'))).toBe(true);
  });

  it('evaluates success criteria against 13.4 thresholds', () => {
    const passing = evaluateAmroMigrationValidation({
      crossTenantLeakageCount: 0,
      replayCompared: 10_000,
      replayMatched: 9_999,
      complianceCompared: 20_000,
      complianceMatched: 19_999,
      switchbackSeconds: 300,
    });
    const failing = evaluateAmroMigrationValidation({
      crossTenantLeakageCount: 1,
      replayCompared: 10_000,
      replayMatched: 9_000,
      complianceCompared: 20_000,
      complianceMatched: 19_000,
      switchbackSeconds: 301,
    });

    expect(passing.overallPassed).toBe(true);
    expect(passing.historicalReplayParity.passed).toBe(true);
    expect(passing.complianceGateDecisionAccuracy.passed).toBe(true);
    expect(passing.rollbackReadiness.passed).toBe(true);
    expect(failing.overallPassed).toBe(false);
    expect(failing.noCrossTenantFranchiseLeakage.passed).toBe(false);
  });

  it('builds dependency envelope with rollout phase sequence', () => {
    process.env.AMRO_MIGRATION_ROLLOUT_PHASE = 'regional-cohorts';
    const envelope = buildAmroMigrationDependencyEnvelope({
      capability: 'work-orders',
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      subscriptionStatus: 'active',
      validatedAt: '2026-03-21T00:00:00.000Z',
      endpointRollout: {
        enabled: true,
        canaryEnforced: true,
        tenantInCanary: true,
        franchiseInCanary: true,
        capabilityInCanary: true,
        capability: 'work-orders',
      },
      auditLedgerCutover: {
        enabled: true,
        canaryEnforced: true,
        tenantInCanary: true,
        franchiseInCanary: true,
        capabilityInCanary: true,
        capability: 'work-orders',
      },
      validation: evaluateAmroMigrationValidation({
        crossTenantLeakageCount: 0,
        replayCompared: 1,
        replayMatched: 1,
        complianceCompared: 1,
        complianceMatched: 1,
        switchbackSeconds: 60,
      }),
    });

    expect(envelope.rollout.phase).toBe('regional-cohorts');
    expect(envelope.rollout.sequence).toEqual(['low-risk-tenants', 'regional-cohorts', 'global-rollout']);
    expect(envelope.successCriteria.validation.overallPassed).toBe(true);
  });
});
