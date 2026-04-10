import express from 'express';
import request from 'supertest';

const mockExecuteWithResilience = jest.fn();
let lastQueryBuilder: any = null;
let lastFromTable = '';

function createQueryBuilder() {
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    then: function(resolve: any, reject: any) {
      return Promise.resolve({ data: [], count: 0, error: null }).then(resolve, reject);
    }
  };
  lastQueryBuilder = builder;
  return builder;
}

jest.mock('../src/utils/resilience', () => ({
  executeWithResilience: (context: unknown, operation: () => Promise<unknown>) => mockExecuteWithResilience(context, operation),
  getResilienceStatus: jest.fn(() => ({
    circuitState: 'closed',
    consecutiveFailures: 0,
    lastFailureAt: 0,
    timeoutMs: 4500,
    maxRetries: 2,
    baseBackoffMs: 150,
    circuitFailureThreshold: 5,
    circuitResetTimeoutMs: 30000,
    totalFailures: 0,
    totalSuccesses: 0,
    recentAlerts: [],
  })),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((tableName: string) => {
      lastFromTable = String(tableName || '');
      return createQueryBuilder();
    }),
  })),
}));

describe('master-data.routes', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.AMRO_MASTER_DATA_V2_ENABLED = 'true';
    mockExecuteWithResilience.mockImplementation(async (context: { operation?: string }) => {
      const operation = String(context.operation || '');
      if (operation.endsWith('.list')) {
        return {
          data: [{ id: 'aircraft-1', tail_number: 'N101AA', tenant_id: 'tenant-1', franchise_id: null }],
          count: 1,
          error: null,
        };
      }
      if (operation.endsWith('.create')) {
        return {
          data: { id: 'aircraft-2', tail_number: 'N202AA' },
          error: null,
        };
      }
      if (operation.endsWith('.update.load') || operation.endsWith('.delete.load')) {
        return {
          data: { id: 'aircraft-1', tail_number: 'N101AA', tenant_id: 'tenant-1', franchise_id: null },
          error: null,
        };
      }
      if (operation.endsWith('.update')) {
        return {
          data: { id: 'aircraft-1', tail_number: 'N303AA' },
          error: null,
        };
      }
      if (operation.endsWith('.delete')) {
        return { error: null };
      }
      if (operation.endsWith('.bulk_import')) {
        return {
          data: [{ id: 'template-1', template_code: 'TMP-1' }],
          error: null,
        };
      }
      if (operation.includes('.audit.')) {
        return { error: null };
      }
      return { data: null, error: null };
    });
    lastQueryBuilder = null;
    lastFromTable = '';
  });

  async function createTestApp() {
    const { default: router } = await import('../src/routes/master-data.routes');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).tenantId = 'tenant-1';
      (req as any).userId = 'user-1';
      next();
    });
    app.use('/api/v2', router);
    return app;
  }

  it('returns paginated master data records', async () => {
    const app = await createTestApp();
    const response = await request(app)
      .get('/api/v2/amro/master-data/aircraft?page=1&page_size=25&sort_by=updated_at&sort_dir=desc')
      .expect(200);
    expect(response.body.output.entity).toBe('aircraft');
    expect(Array.isArray(response.body.output.records)).toBe(true);
    expect(mockExecuteWithResilience).toHaveBeenCalled();
  });

  it('accepts hyphenated flight logs entity route', async () => {
    const app = await createTestApp();
    const response = await request(app)
      .get('/api/v2/amro/master-data/flight-logs?page=1&page_size=25')
      .expect(200);
    expect(response.body.output.entity).toBe('flight_logs');
    expect(Array.isArray(response.body.output.records)).toBe(true);
    expect(mockExecuteWithResilience).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'master-data.flight_logs.list' }),
      expect.any(Function),
    );
  });

  it('validates query parameters before database calls', async () => {
    const app = await createTestApp();
    const response = await request(app)
      .get('/api/v2/amro/master-data/aircraft?page=0&page_size=25')
      .expect(400);
    expect(typeof response.body.error).toBe('string');
    expect(mockExecuteWithResilience).not.toHaveBeenCalled();
  });

  it('maps resilience failures to dependency status codes', async () => {
    mockExecuteWithResilience.mockRejectedValueOnce({
      statusCode: 503,
      code: 'CIRCUIT_OPEN',
      message: 'supabase circuit breaker is open',
    });
    const app = await createTestApp();
    const response = await request(app)
      .get('/api/v2/amro/master-data/aircraft?page=1&page_size=25')
      .expect(503);
    expect(typeof response.body.error).toBe('string');
  });

  it('creates master data records', async () => {
    const app = await createTestApp();
    const response = await request(app)
      .post('/api/v2/amro/master-data/aircraft')
      .send({
        tail_number: 'N202AA',
        serial_number: 'SN-202',
        aircraft_type: 'A320',
        aircraft_model: 'A320-200',
        status: 'active',
      })
      .expect(201);
    expect(response.body.output.entity).toBe('aircraft');
    expect(response.body.output.record.id).toBe('aircraft-2');
    expect(mockExecuteWithResilience).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'master-data.aircraft.create' }),
      expect.any(Function),
    );
  });

  it('updates master data records', async () => {
    const app = await createTestApp();
    const response = await request(app)
      .patch('/api/v2/amro/master-data/aircraft/aircraft-1')
      .send({
        tail_number: 'N303AA',
        serial_number: 'SN-101',
        aircraft_type: 'B737',
        aircraft_model: 'B737-800',
        status: 'active',
      })
      .expect(200);
    expect(response.body.output.entity).toBe('aircraft');
    expect(response.body.output.record.tail_number).toBe('N303AA');
    expect(mockExecuteWithResilience).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'master-data.aircraft.update.load' }),
      expect.any(Function),
    );
    expect(mockExecuteWithResilience).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'master-data.aircraft.update' }),
      expect.any(Function),
    );
  });

  it('deletes master data records', async () => {
    const app = await createTestApp();
    const response = await request(app).delete('/api/v2/amro/master-data/aircraft/aircraft-1').expect(200);
    expect(response.body.output.entity).toBe('aircraft');
    expect(response.body.output.deleted_id).toBe('aircraft-1');
    expect(mockExecuteWithResilience).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'master-data.aircraft.delete.load' }),
      expect.any(Function),
    );
    expect(mockExecuteWithResilience).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'master-data.aircraft.delete' }),
      expect.any(Function),
    );
  });

  it('bulk imports master data records', async () => {
    const app = await createTestApp();
    const response = await request(app)
      .post('/api/v2/amro/master-data/work_package_templates')
      .send({
        operation: 'bulk_import',
        records: [{ template_code: 'TMP-1', template_name: 'Template 1', maintenance_type: 'line', version: 1 }],
      })
      .expect(200);
    expect(response.body.output.entity).toBe('work_package_templates');
    expect(response.body.output.imported_count).toBe(1);
    expect(Array.isArray(response.body.output.records)).toBe(true);
  });

  it('keeps manufacturers list tenant-scoped and independent of franchise filter', async () => {
    mockExecuteWithResilience.mockImplementationOnce(async (_context, operation) => await operation());
    const app = await createTestApp();
    await request(app)
      .get('/api/v2/amro/master-data/manufacturers?tenant_id=tenant-1')
      .set('x-franchise-id', 'franchise-1')
      .expect(200);
    expect(lastFromTable).toBe('manufacturers');
    expect(lastQueryBuilder?.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(lastQueryBuilder?.or).not.toHaveBeenCalled();
  });

  it('rejects tenant_id filter mismatch to prevent cross-tenant leakage', async () => {
    const app = await createTestApp();
    await request(app)
      .get('/api/v2/amro/master-data/manufacturers?tenant_id=tenant-2')
      .expect(403);
  });
});
