import { createClient } from '@supabase/supabase-js';
import { WorkOrdersService } from '../src/services/work-orders.service';
import { amroEventsProducer } from '../src/events/amro-events.producer';
import { workPackagesStream } from '../src/realtime/work-packages-stream';
import { logger } from '../src/utils/logger';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('../src/instrumentation/amro-tracing', () => ({
  withSpan: jest.fn(async (_name: string, callback: () => Promise<unknown>) => callback()),
}));

jest.mock('../src/events/amro-events.producer', () => ({
  amroEventsProducer: {
    publishWorkOrderEvent: jest.fn(),
    publishTaskEvent: jest.fn(),
    publishMaintenanceEvent: jest.fn(),
  },
}));

jest.mock('../src/realtime/work-packages-stream', () => ({
  workPackagesStream: {
    publish: jest.fn(),
    subscribe: jest.fn(),
  },
}));

jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

type QueryResult = { data: unknown; error: { message: string } | null };

function createThenableBuilder(result: QueryResult) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    single: jest.fn(),
    then: (
      onFulfilled: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.single.mockResolvedValue(result);

  return builder;
}

describe('WorkOrdersService', () => {
  const queuedResults: QueryResult[] = [];
  const mockFrom = jest.fn((table: string) => {
    void table;
    const next = queuedResults.shift() ?? { data: null, error: null };
    return createThenableBuilder(next);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    queuedResults.length = 0;
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    (createClient as jest.Mock).mockReturnValue({ from: mockFrom });
  });

  it('returns work packages for tenant', async () => {
    const service = new WorkOrdersService();
    queuedResults.push({
      data: [{ id: 'wp-1', title: 'WP 1', tenant_id: 'tenant-1' }],
      error: null,
    });

    const result = await service.getWorkPackages('tenant-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('wp-1');
  });

  it('creates work package and publishes events', async () => {
    const service = new WorkOrdersService();
    queuedResults.push({
      data: {
        id: 'wp-9',
        aircraft_id: 'ac-1',
        title: 'Line Check',
        description: 'A-check',
        maintenance_type: 'line',
        status: 'planning',
        estimated_cost: 3000,
        estimated_labor_hours: 12,
        work_order_number: 'WP-9',
      },
      error: null,
    });

    const created = await service.createWorkPackage('tenant-1', 'user-1', {
      aircraft_id: 'ac-1',
      title: 'Line Check',
      maintenance_type: 'line',
    });

    expect(created.id).toBe('wp-9');
    expect(amroEventsProducer.publishWorkOrderEvent).toHaveBeenCalledTimes(1);
    expect(workPackagesStream.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'created' }));
  });

  it('updates and deletes work packages with tenant checks', async () => {
    const service = new WorkOrdersService();
    queuedResults.push(
      {
        data: { id: 'wp-1', title: 'Old', status: 'planning', maintenance_type: 'line' },
        error: null,
      },
      {
        data: { id: 'wp-1', title: 'New', status: 'in_progress', maintenance_type: 'line' },
        error: null,
      },
      {
        data: { id: 'wp-1', title: 'New', status: 'in_progress', maintenance_type: 'line' },
        error: null,
      },
      { data: null, error: null },
    );

    const updated = await service.updateWorkPackage('tenant-1', 'wp-1', 'user-1', {
      title: 'New',
      status: 'in_progress',
    });
    await service.deleteWorkPackage('tenant-1', 'wp-1', 'user-1');

    expect(updated.title).toBe('New');
    expect(amroEventsProducer.publishWorkOrderEvent).toHaveBeenCalledTimes(2);
    expect(workPackagesStream.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'updated' }));
    expect(workPackagesStream.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'deleted' }));
  });

  it('creates, updates and deletes tasks with lifecycle events', async () => {
    const service = new WorkOrdersService();
    queuedResults.push(
      {
        data: {
          id: 'task-1',
          task_number: 'TASK-1',
          work_package_id: 'wp-1',
          title: 'Inspect',
          status: 'pending',
        },
        error: null,
      },
      {
        data: { id: 'task-1', task_number: 'TASK-1', work_package_id: 'wp-1', status: 'pending' },
        error: null,
      },
      {
        data: { id: 'task-1', task_number: 'TASK-1', work_package_id: 'wp-1', status: 'in_progress' },
        error: null,
      },
      {
        data: { id: 'task-1', task_number: 'TASK-1', work_package_id: 'wp-1', status: 'in_progress' },
        error: null,
      },
      { data: null, error: null },
    );

    await service.createTask('tenant-1', 'user-1', {
      work_package_id: 'wp-1',
      title: 'Inspect',
    });
    await service.updateTask('tenant-1', 'task-1', 'user-1', { status: 'in_progress' });
    await service.deleteTask('tenant-1', 'task-1', 'user-1');

    expect(amroEventsProducer.publishTaskEvent).toHaveBeenCalled();
    expect(amroEventsProducer.publishTaskEvent).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      expect.any(String),
      expect.objectContaining({ task_id: 'task-1' }),
    );
  });

  it('throws on createTask without work_package_id', async () => {
    const service = new WorkOrdersService();

    await expect(service.createTask('tenant-1', 'user-1', { title: 'No WP' }))
      .rejects.toThrow('work_package_id is required');
  });

  it('records maintenance event and logs publish failures', async () => {
    const service = new WorkOrdersService();
    queuedResults.push({
      data: {
        id: 'task-2',
        task_number: 'TASK-2',
        work_package_id: 'wp-2',
        status: 'completed',
      },
      error: null,
    });
    (amroEventsProducer.publishMaintenanceEvent as jest.Mock).mockImplementationOnce(() => {
      throw new Error('publish failed');
    });

    await service.recordMaintenanceEvent('tenant-1', 'user-1', 'task-2', {
      executed_by: 'tech-9',
      evidence_captured: true,
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to publish maintenance event',
      expect.objectContaining({ taskId: 'task-2' }),
    );
  });

  it('returns materials and material details', async () => {
    const service = new WorkOrdersService();
    queuedResults.push(
      {
        data: [{ id: 'mat-1', work_package_id: 'wp-1', tenant_id: 'tenant-1' }],
        error: null,
      },
      {
        data: { id: 'mat-2', work_package_id: 'wp-1', tenant_id: 'tenant-1' },
        error: null,
      },
    );

    const list = await service.getMaterials('tenant-1', 'wp-1');
    const one = await service.getMaterial('tenant-1', 'mat-2');

    expect(list).toHaveLength(1);
    expect(one.id).toBe('mat-2');
  });
});
