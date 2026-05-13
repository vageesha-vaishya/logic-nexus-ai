import request from 'supertest';

const mockWorkOrdersService = {
  getWorkOrders: jest.fn(),
  getWorkOrder: jest.fn(),
  createWorkOrder: jest.fn(),
  updateWorkOrder: jest.fn(),
  deleteWorkOrder: jest.fn(),
  getTasks: jest.fn(),
  getTask: jest.fn(),
  createTask: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
  getMaterials: jest.fn(),
  getMaterial: jest.fn(),
  recordMaintenanceEvent: jest.fn(),
};

jest.mock('../src/middleware/auth.middleware', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.tenantId = 'tenant-1';
    req.userId = 'user-1';
    next();
  },
}));

jest.mock('../src/services/work-orders.service', () => ({
  WorkOrdersService: jest.fn().mockImplementation(() => mockWorkOrdersService),
}));

import app from '../src/app';

describe('Work Orders Routes Field Contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps route workOrderId and keeps legacy sequence_number', async () => {
    mockWorkOrdersService.createTask.mockResolvedValue({
      id: 'task-1',
      tenant_id: 'tenant-1',
      work_order_id: 'wp-1',
      task_number: 'TASK-1',
      title: 'Task',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const response = await request(app).post('/api/v1/work-orders/wp-1/tasks').send({
      title: 'Task',
      sequence_number: 5,
    });

    expect(response.status).toBe(201);
    expect(mockWorkOrdersService.createTask).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      expect.objectContaining({
        work_order_id: 'wp-1',
        sequence_number: 5,
      }),
    );
  });

  it('accepts corrected sequence_order field', async () => {
    mockWorkOrdersService.createTask.mockResolvedValue({
      id: 'task-2',
      tenant_id: 'tenant-1',
      work_order_id: 'wp-1',
      task_number: 'TASK-2',
      title: 'Task 2',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const response = await request(app).post('/api/v1/work-orders/wp-1/tasks').send({
      title: 'Task 2',
      sequence_order: 7,
    });

    expect(response.status).toBe(201);
    expect(mockWorkOrdersService.createTask).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      expect.objectContaining({
        work_order_id: 'wp-1',
        sequence_order: 7,
      }),
    );
  });

  it('forwards tenant scope to materials endpoint', async () => {
    mockWorkOrdersService.getMaterials.mockResolvedValue([]);

    const response = await request(app).get('/api/v1/work-orders/wp-42/materials');

    expect(response.status).toBe(200);
    expect(mockWorkOrdersService.getMaterials).toHaveBeenCalledWith('tenant-1', 'wp-42');
  });

  it('forwards maintenance event payload to service', async () => {
    mockWorkOrdersService.recordMaintenanceEvent.mockResolvedValue(undefined);

    const response = await request(app)
      .post('/api/v1/tasks/task-99/maintenance-events')
      .send({
        executed_by: 'tech-1',
        evidence_captured: true,
        event_type: 'execution',
      });

    expect(response.status).toBe(201);
    expect(mockWorkOrdersService.recordMaintenanceEvent).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'task-99',
      expect.objectContaining({
        executed_by: 'tech-1',
        evidence_captured: true,
        event_type: 'execution',
      }),
    );
  });
});
