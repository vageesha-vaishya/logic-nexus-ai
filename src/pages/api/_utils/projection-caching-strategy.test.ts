import { beforeEach, describe, expect, it } from 'vitest';
import {
  evaluateProjectionRead,
  getProjectionCachingStatus,
  invalidateProjectionCache,
  putProjectionCache,
  resetProjectionCachingStrategyState,
  setProjectionRollbackProfile,
  upsertProjectionPipelineState,
} from './projection-caching-strategy';

describe('projection caching strategy', () => {
  beforeEach(() => {
    resetProjectionCachingStrategyState();
  });

  it('uses projection cache when lag and latency are within budget', () => {
    putProjectionCache({
      moduleKey: 'module-crm',
      projectionKey: 'pipeline-board',
      keyPrefix: 'tenant',
      entityKey: 'tenant-1',
      valueChecksum: 'abc123',
      ttlSeconds: 120,
    });
    const decision = evaluateProjectionRead({
      moduleKey: 'module-crm',
      projectionKey: 'pipeline-board',
      keyPrefix: 'tenant',
      entityKey: 'tenant-1',
      observedReadLatencyMs: 120,
    });
    expect(decision.mode).toBe('projection_cache');
    expect(decision.reason).toBe('projection_healthy');
  });

  it('routes to authoritative reads when stale projections are disabled', () => {
    setProjectionRollbackProfile({ disableStaleProjections: true, reason: 'lag alert' });
    upsertProjectionPipelineState({
      moduleKey: 'module-crm',
      projectionKey: 'pipeline-board',
      lagMs: 9000,
      status: 'degraded',
    });
    const decision = evaluateProjectionRead({
      moduleKey: 'module-crm',
      projectionKey: 'pipeline-board',
      keyPrefix: 'tenant',
      entityKey: 'tenant-1',
      observedReadLatencyMs: 350,
    });
    expect(decision.mode).toBe('authoritative_read');
    expect(decision.reason).toBe('rollback_profile');
  });

  it('invalidates cache by contract event and reports slo status', () => {
    putProjectionCache({
      moduleKey: 'module-crm',
      projectionKey: 'pipeline-board',
      keyPrefix: 'tenant',
      entityKey: 'tenant-1',
      valueChecksum: 'abc123',
      ttlSeconds: 120,
    });
    const invalidation = invalidateProjectionCache({
      moduleKey: 'module-crm',
      projectionKey: 'pipeline-board',
      eventName: 'pipeline-board.updated',
    });
    expect(invalidation.eventMatched).toBe(true);
    expect(invalidation.invalidated).toBeGreaterThan(0);
    const status = getProjectionCachingStatus();
    expect(status.pipelineCount).toBeGreaterThan(0);
  });
});
