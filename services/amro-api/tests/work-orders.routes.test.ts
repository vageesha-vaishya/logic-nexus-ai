import express from 'express';
import request from 'supertest';
import { EventEmitter } from 'events';
import { WorkOrdersService } from '../src/services/work-orders.service';
import router from '../src/routes/work-orders.routes';
import { workPackagesStream } from '../src/realtime/work-packages-stream';

jest.mock('../src/services/work-orders.service', () => ({
  WorkOrdersService: jest.fn(() => ({
    getWorkPackages: jest.fn(),
    getWorkPackage: jest.fn(),
    createWorkPackage: jest.fn(),
    updateWorkPackage: jest.fn(),
    deleteWorkPackage: jest.fn(),
    getTasks: jest.fn(),
    getTask: jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
    getMaterials: jest.fn(),
    getMaterial: jest.fn(),
    recordMaintenanceEvent: jest.fn(),
    getAssetSummaries: jest.fn(),
    getQualificationSummaries: jest.fn(),
    getComplianceSummary: jest.fn(),
    getEvidenceSummaries: jest.fn(),
    getForecastRecommendations: jest.fn(),
    getSchedulingSummary: jest.fn(),
    getIntegrationSummary: jest.fn(),
  })),
}));

jest.mock('../src/realtime/work-packages-stream', () => ({
  workPackagesStream: {
    subscribe: jest.fn(),
    publish: jest.fn(),
  },
}));

function createTestApp(withContext = true) {
  const app = express();
  app.use(express.json());
  if (withContext) {
    app.use((req, _res, next) => {
      (req as any).tenantId = 'tenant-1';
      (req as any).userId = 'user-1';
      next();
    });
  }
  app.use('/api/v1', router);
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: error.message });
  });
  return app;
}

const mockService = (WorkOrdersService as unknown as jest.Mock).mock.results[0]?.value as {
  getWorkPackages: jest.Mock;
  getWorkPackage: jest.Mock;
  createWorkPackage: jest.Mock;
  updateWorkPackage: jest.Mock;
  deleteWorkPackage: jest.Mock;
  getTasks: jest.Mock;
  getTask: jest.Mock;
  createTask: jest.Mock;
  updateTask: jest.Mock;
  deleteTask: jest.Mock;
  getMaterials: jest.Mock;
  getMaterial: jest.Mock;
  recordMaintenanceEvent: jest.Mock;
  getAssetSummaries: jest.Mock;
  getQualificationSummaries: jest.Mock;
  getComplianceSummary: jest.Mock;
  getEvidenceSummaries: jest.Mock;
  getForecastRecommendations: jest.Mock;
  getSchedulingSummary: jest.Mock;
  getIntegrationSummary: jest.Mock;
};

describe('work-orders.routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serves work package and task CRUD endpoints', async () => {
    const app = createTestApp(true);
    mockService.getWorkPackages.mockResolvedValue([{ id: 'wp-1' }]);
    mockService.getWorkPackage.mockResolvedValue({ id: 'wp-1' });
    mockService.createWorkPackage.mockResolvedValue({ id: 'wp-2' });
    mockService.updateWorkPackage.mockResolvedValue({ id: 'wp-1', title: 'Updated' });
    mockService.deleteWorkPackage.mockResolvedValue(undefined);
    mockService.getTasks.mockResolvedValue([{ id: 'task-1' }]);
    mockService.getTask.mockResolvedValue({ id: 'task-1' });
    mockService.createTask.mockResolvedValue({ id: 'task-2' });
    mockService.updateTask.mockResolvedValue({ id: 'task-1', status: 'completed' });
    mockService.deleteTask.mockResolvedValue(undefined);
    mockService.getMaterials.mockResolvedValue([{ id: 'mat-1' }]);
    mockService.getMaterial.mockResolvedValue({ id: 'mat-1' });
    mockService.recordMaintenanceEvent.mockResolvedValue(undefined);
    mockService.getAssetSummaries.mockResolvedValue([{ id: 'asset-1' }]);
    mockService.getQualificationSummaries.mockResolvedValue([{ id: 'qual-1' }]);
    mockService.getComplianceSummary.mockResolvedValue({ totalEvents: 2 });
    mockService.getEvidenceSummaries.mockResolvedValue([{ id: 'evidence-1' }]);
    mockService.getForecastRecommendations.mockResolvedValue([{ id: 'rec-1' }]);
    mockService.getSchedulingSummary.mockResolvedValue({ scheduled: 1 });
    mockService.getIntegrationSummary.mockResolvedValue({ adapter_health: 'healthy' });

    await request(app).get('/api/v1/work-packages').expect(200);
    await request(app).get('/api/v1/work-packages/wp-1').expect(200);
    await request(app).post('/api/v1/work-packages').send({
      aircraft_id: 'ac-1',
      title: 'T',
      maintenance_type: 'line',
    }).expect(201);
    await request(app).patch('/api/v1/work-packages/wp-1').send({ title: 'Updated' }).expect(200);
    await request(app).delete('/api/v1/work-packages/wp-1').expect(204);

    await request(app).get('/api/v1/work-packages/wp-1/tasks').expect(200);
    await request(app).get('/api/v1/tasks/task-1').expect(200);
    await request(app).post('/api/v1/work-packages/wp-1/tasks').send({
      title: 'Task',
      sequence_order: 1,
    }).expect(201);
    await request(app).patch('/api/v1/tasks/task-1').send({ status: 'completed' }).expect(200);
    await request(app).delete('/api/v1/tasks/task-1').expect(204);

    await request(app).get('/api/v1/work-packages/wp-1/materials').expect(200);
    await request(app).get('/api/v1/materials/mat-1').expect(200);
    await request(app).get('/api/v1/assets').expect(200);
    await request(app).get('/api/v1/qualifications').expect(200);
    await request(app).get('/api/v1/compliance/summary').expect(200);
    await request(app).get('/api/v1/evidence').expect(200);
    await request(app).get('/api/v1/forecast/recommendations').expect(200);
    await request(app).get('/api/v1/scheduling/summary').expect(200);
    await request(app).get('/api/v1/integration/summary').expect(200);
    await request(app).post('/api/v1/tasks/task-1/maintenance-events').send({
      executed_by: 'tech-1',
      evidence_captured: true,
    }).expect(201);
  });

  it('validates payloads and tenant context', async () => {
    const app = createTestApp(true);
    const appWithoutContext = createTestApp(false);

    await request(app).post('/api/v1/work-packages').send({ title: 'Missing' }).expect(400);
    await request(app).post('/api/v1/work-packages/wp-1/tasks').send({ title: 'No sequence' }).expect(400);
    await request(app).post('/api/v1/tasks/task-1/maintenance-events').send({ executed_by: 'tech' }).expect(400);
    await request(appWithoutContext).get('/api/v1/work-packages').expect(401);
  });

  it('streams SSE updates and filters by tenant', () => {
    let callback: ((event: any) => void) | undefined;
    const unsubscribe = jest.fn();
    (workPackagesStream.subscribe as jest.Mock).mockImplementation((fn: (event: any) => void) => {
      callback = fn;
      return unsubscribe;
    });

    const sseLayer = (router as any).stack.find((layer: any) => layer.route?.path === '/work-packages/stream');
    const handler = sseLayer.route.stack[0].handle;
    const req = new EventEmitter() as any;
    req.tenantId = 'tenant-1';
    const writes: string[] = [];
    const res = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn((chunk: string) => {
        writes.push(chunk);
      }),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    handler(req, res);
    callback?.({ tenantId: 'tenant-1', type: 'updated', workPackage: { id: 'wp-1' } });
    callback?.({ tenantId: 'tenant-2', type: 'updated', workPackage: { id: 'wp-2' } });
    req.emit('close');

    expect(writes.join('')).toContain('event: connected');
    expect(writes.join('')).toContain('work-package-change');
    expect(workPackagesStream.subscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
