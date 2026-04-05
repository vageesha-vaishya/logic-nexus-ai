import { afterEach, describe, expect, it } from 'vitest';
import {
  enqueueUimEtlRun,
  getUimEtlQueueStats,
  getUimEtlTelemetrySummary,
  listUimEtlRuns,
  processUimEtlQueue,
  resetUimEtlSchedulerState,
  setUimEtlExecutor,
} from './etlScheduler';

describe('etlScheduler', () => {
  afterEach(() => {
    resetUimEtlSchedulerState();
  });

  it('retries failed runs and captures telemetry on completion', async () => {
    let attempt = 0;
    setUimEtlExecutor(async () => {
      attempt += 1;
      if (attempt < 3) throw new Error(`transient-${attempt}`);
      return {
        extracted: 25,
        transformed: 23,
        loaded: 23,
      };
    });

    await enqueueUimEtlRun({
      tenant_id: 'tenant-1',
      source: 'uim-ledger',
      max_attempts: 4,
    });

    const base = Date.now();
    await processUimEtlQueue(base);
    await processUimEtlQueue(base + 1500);
    await processUimEtlQueue(base + 5000);

    const runs = listUimEtlRuns({ tenantId: 'tenant-1' });
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe('completed');
    expect(runs[0]?.attempts).toBe(3);
    expect(runs[0]?.records_loaded).toBe(23);

    const stats = getUimEtlQueueStats({ tenantId: 'tenant-1' });
    expect(stats.completed).toBe(1);
    expect(stats.failed).toBe(0);

    const telemetry = getUimEtlTelemetrySummary({ tenantId: 'tenant-1' });
    expect(telemetry.retry_events).toBe(2);
    expect(telemetry.completed_runs).toBe(1);
    expect(telemetry.success_rate).toBe(1);
  });
});
