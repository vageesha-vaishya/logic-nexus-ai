import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performance } from 'node:perf_hooks';
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';
import {
  persistCloneTemplateWorkPackage,
  persistCreateWorkPackage,
  persistTransitionWorkPackage,
} from './work-package-persistence';

vi.mock('../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

async function benchmarkOperation(operation: () => Promise<void>, iterations: number): Promise<number> {
  const durations: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    await operation();
    durations.push(performance.now() - start);
  }
  return median(durations);
}

describe('work package operation latency benchmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      schema: vi.fn(() => ({
        rpc: vi.fn(async (name: string) => {
          if (name === 'amro_ops_clone_template_work_package') {
            return {
              data: [{
                work_package_id: 'tenant-1-fr-1-wp-clone-100',
                status: 'planning',
                version: 1,
                created_at: '2026-03-24T00:00:00.000Z',
                created_by: 'user-1',
                updated_at: '2026-03-24T00:00:00.000Z',
                updated_by: 'user-1',
                inherited_tasks_count: 14,
              }],
              error: null,
            };
          }
          return {
            data: [{
              work_package_id: 'tenant-1-fr-1-wp-100',
              status: name === 'amro_ops_transition_work_package' ? 'in_progress' : 'planning',
              version: 2,
              created_at: '2026-03-24T00:00:00.000Z',
              created_by: 'user-1',
              updated_at: '2026-03-24T00:00:01.000Z',
              updated_by: 'user-1',
            }],
            error: null,
          };
        }),
      })),
    } as any);
  });

  it('keeps create-work-package median write latency below 100ms', async () => {
    const sample = await benchmarkOperation(async () => {
      await persistCreateWorkPackage({
        tenantId: 'tenant-1',
        franchiseId: 'fr-1',
        userId: 'user-1',
        aircraftId: 'ac-001',
        maintenanceType: 'line',
        plannedWindowFrom: '2026-03-24T00:00:00.000Z',
        plannedWindowTo: '2026-03-24T02:00:00.000Z',
        station: 'tenant-1:station-a',
        priority: 'high',
        scopeItems: ['task-1'],
        creationTriggerSource: 'schedule',
        creationTriggerReferenceId: 'sched-001',
        creationTriggeredAt: '2026-03-24T00:00:00.000Z',
        engineerPlan: {},
      });
    }, 200);
    expect(sample).toBeLessThan(100);
  });

  it('keeps transition-work-package median write latency below 100ms', async () => {
    const sample = await benchmarkOperation(async () => {
      await persistTransitionWorkPackage({
        tenantId: 'tenant-1',
        franchiseId: 'fr-1',
        userId: 'user-1',
        workPackageId: 'wp-001',
        currentStatus: 'scheduled',
        targetStatus: 'in_progress',
        reasonCode: 'ready',
        actorSignature: 'sig-001',
        expectedVersion: 1,
        actorRole: 'engineer',
        transitionId: 'tr-001',
        gateName: 'work-package-transition',
        workflowInputPayload: {},
        workflowUserContext: {},
      });
    }, 200);
    expect(sample).toBeLessThan(100);
  });

  it('keeps clone-template median write latency below 100ms', async () => {
    const sample = await benchmarkOperation(async () => {
      await persistCloneTemplateWorkPackage({
        tenantId: 'tenant-1',
        franchiseId: 'fr-1',
        userId: 'user-1',
        templateId: 'tenant-1:template-001',
        templateVersion: '1.0.0',
        templateName: 'Template 001',
        aircraftId: 'ac-001',
        overrideFields: { priority: 'critical' },
      });
    }, 200);
    expect(sample).toBeLessThan(100);
  });
});
