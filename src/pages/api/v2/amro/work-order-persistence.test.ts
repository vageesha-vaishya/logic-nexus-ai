import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';
import {
  checkAmroOpsPersistenceHealth,
  persistCloneTemplateWorkOrder,
  persistCreateWorkOrder,
  persistTransitionWorkOrder,
} from './work-order-persistence';

vi.mock('../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

describe('work-order-persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists create work package through amro_ops rpc', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        work_order_id: 'tenant-1-fr-1-wp-100',
        status: 'planning',
        version: 1,
        generated_tasks_count: 3,
        created_at: '2026-03-24T00:00:00.000Z',
        created_by: 'user-1',
        updated_at: '2026-03-24T00:00:00.000Z',
        updated_by: 'user-1',
      }],
      error: null,
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      schema: vi.fn(() => ({ rpc })),
    } as any);

    const record = await persistCreateWorkOrder({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      userId: 'user-1',
      workOrderTemplateId: '11111111-1111-4111-8111-111111111111',
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

    expect(record.work_order_id).toBe('tenant-1-fr-1-wp-100');
    expect(record.version).toBe(1);
    expect(record.generated_tasks_count).toBe(3);
    expect(rpc).toHaveBeenCalledWith('amro_ops_create_work_order', expect.objectContaining({
      p_tenant_id: 'tenant-1',
      p_station: 'tenant-1:station-a',
      p_work_order_template_id: '11111111-1111-4111-8111-111111111111',
    }));
  });

  it('returns optimistic lock conflict when transition rpc reports version mismatch', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'optimistic lock conflict: version mismatch' },
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      schema: vi.fn(() => ({ rpc })),
    } as any);

    await expect(persistTransitionWorkOrder({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      userId: 'user-1',
      workOrderId: 'wp-001',
      currentStatus: 'scheduled',
      targetStatus: 'in_progress',
      reasonCode: 'ready',
      actorSignature: 'sig-001',
      expectedVersion: 4,
      actorRole: 'engineer',
      transitionId: 'tr-001',
      gateName: 'work-order-transition',
      workflowInputPayload: {},
      workflowUserContext: {},
    })).rejects.toThrow('optimistic_lock_conflict');
  });

  it('surfaces task generation validation failures from persistence rpc', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'WPT.tasks_json must be an array' },
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      schema: vi.fn(() => ({ rpc })),
    } as any);

    await expect(persistCreateWorkOrder({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      userId: 'user-1',
      workOrderTemplateId: '11111111-1111-4111-8111-111111111111',
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
    })).rejects.toThrow('WPT.tasks_json must be an array');
  });

  it('supports concurrency control by allowing one transition and rejecting stale version', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: [{
          work_order_id: 'wp-001',
          status: 'in_progress',
          version: 5,
          created_at: '2026-03-24T00:00:00.000Z',
          created_by: 'user-1',
          updated_at: '2026-03-24T00:01:00.000Z',
          updated_by: 'user-1',
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'optimistic lock conflict: version mismatch' },
      });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      schema: vi.fn(() => ({ rpc })),
    } as any);

    const input = {
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      userId: 'user-1',
      workOrderId: 'wp-001',
      currentStatus: 'scheduled',
      targetStatus: 'in_progress',
      reasonCode: 'ready',
      actorSignature: 'sig-001',
      expectedVersion: 4,
      actorRole: 'engineer',
      transitionId: 'tr-001',
      gateName: 'work-order-transition',
      workflowInputPayload: {},
      workflowUserContext: {},
    };

    const [first, second] = await Promise.allSettled([
      persistTransitionWorkOrder(input),
      persistTransitionWorkOrder(input),
    ]);

    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');
  });

  it('propagates clone-template persistence failures for rollback-safe handling', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'template lifecycle state is not active' },
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      schema: vi.fn(() => ({ rpc })),
    } as any);

    await expect(persistCloneTemplateWorkOrder({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      userId: 'user-1',
      templateId: 'tenant-1:template-001',
      templateVersion: '1.0.0',
      templateName: 'Template 001',
      aircraftId: 'ac-001',
      overrideFields: {},
    })).rejects.toThrow('template lifecycle state is not active');
  });

  it('passes persistence healthcheck when rpc responds before timeout', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ ok: true }], error: null });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      schema: vi.fn(() => ({ rpc })),
    } as any);

    const result = await checkAmroOpsPersistenceHealth(500);

    expect(result.ok).toBe(true);
    expect(result.elapsedMs).toBeLessThanOrEqual(500);
  });
});
