import { describe, expect, it, vi } from 'vitest';
import {
  AMRO_PHASE_1_DELIVERABLES,
  AMRO_PHASE_1_SCOPE,
  buildAmroPhase1ReadinessEnvelope,
  resolveAmroPhase1DeliverableStatuses,
} from './phase-1-core-workflows';

describe('phase-1-core-workflows', () => {
  it('matches the phase 1 scope, goals, and success metrics', () => {
    expect(AMRO_PHASE_1_SCOPE.phase).toBe('Phase 1');
    expect(AMRO_PHASE_1_SCOPE.duration).toBe('Weeks 1-6');
    expect(AMRO_PHASE_1_SCOPE.goals.length).toBe(5);
    expect(AMRO_PHASE_1_SCOPE.successMetrics).toContain('Zero data leakage across tenants');
  });

  it('resolves deliverable statuses from env and computes readiness summary', () => {
    vi.stubEnv('AMRO_PHASE_1_UX_AMRO_001_STATUS', 'completed');
    vi.stubEnv('AMRO_PHASE_1_UX_AMRO_002_STATUS', 'in-progress');
    vi.stubEnv('AMRO_PHASE_1_QA_AMRO_UNIT_TESTS_STATUS', 'completed');

    const statuses = resolveAmroPhase1DeliverableStatuses();
    expect(statuses['UX-AMRO-001']).toBe('completed');
    expect(statuses['UX-AMRO-002']).toBe('in-progress');
    expect(statuses['QA-AMRO-UNIT-TESTS']).toBe('completed');

    const readiness = buildAmroPhase1ReadinessEnvelope();
    expect(readiness.deliverables.length).toBe(AMRO_PHASE_1_DELIVERABLES.length);
    expect(readiness.summary.total).toBe(13);
    expect(readiness.summary.completed).toBe(2);
    expect(readiness.summary.inProgress).toBe(1);
    expect(readiness.summary.notStarted).toBe(10);
    expect(readiness.summary.progressRatio).toBe(0.15);

    vi.unstubAllEnvs();
  });
});
