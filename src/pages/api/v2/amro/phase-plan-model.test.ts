import { describe, expect, it, vi } from 'vitest';
import { AMRO_PHASE_PLAN_MATRIX, buildAmroPhasePlanProgressEnvelope, resolveAmroPhasePlanStatuses } from './phase-plan-model';

describe('phase-plan-model', () => {
  it('returns the expected four phases from the implementation matrix', () => {
    expect(AMRO_PHASE_PLAN_MATRIX.length).toBe(4);
    expect(AMRO_PHASE_PLAN_MATRIX[0]).toMatchObject({
      label: 'Phase 1',
      duration: 'Weeks 1-6',
      primaryFocus: 'Core UI & APIs',
    });
    expect(AMRO_PHASE_PLAN_MATRIX[3]).toMatchObject({
      label: 'Phase 4',
      duration: 'Weeks 21-26',
      primaryFocus: 'Integration & scale',
    });
  });

  it('resolves status from environment and builds progress summary', () => {
    vi.stubEnv('AMRO_PHASE_1_STATUS', 'completed');
    vi.stubEnv('AMRO_PHASE_2_STATUS', 'in-progress');
    vi.stubEnv('AMRO_PHASE_3_STATUS', 'not-started');
    vi.stubEnv('AMRO_PHASE_4_STATUS', 'not-started');

    const statuses = resolveAmroPhasePlanStatuses();
    expect(statuses['phase-1']).toBe('completed');
    expect(statuses['phase-2']).toBe('in-progress');

    const envelope = buildAmroPhasePlanProgressEnvelope();
    expect(envelope.summary.totalPhases).toBe(4);
    expect(envelope.summary.completedPhases).toBe(1);
    expect(envelope.summary.inProgressPhases).toBe(1);
    expect(envelope.summary.notStartedPhases).toBe(2);
    expect(envelope.summary.completionRatio).toBe(0.25);
    expect(envelope.rows.map((row) => row.status)).toEqual(['completed', 'in-progress', 'not-started', 'not-started']);

    vi.unstubAllEnvs();
  });
});
