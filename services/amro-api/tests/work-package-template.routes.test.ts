import express from 'express';
import request from 'supertest';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

type SupabaseResult = { data?: unknown; error?: { message?: string } | null };

function createThenable(result: SupabaseResult) {
  return {
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    single: jest.fn(async () => ({ data: result.data ?? null, error: result.error ?? null })),
    then: (resolve: (value: SupabaseResult) => unknown) => Promise.resolve(resolve({ data: result.data ?? null, error: result.error ?? null })),
  };
}

function createInsert(result: SupabaseResult) {
  return {
    insert: jest.fn(async () => ({ data: result.data ?? null, error: result.error ?? null })),
  };
}

async function createTestApp(fromMock: jest.Mock) {
  jest.resetModules();
  const supabaseModule = await import('@supabase/supabase-js');
  (supabaseModule.createClient as unknown as jest.Mock).mockReturnValue({ from: fromMock });
  const { default: router } = await import('../src/routes/work-package-template.routes');
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).tenantId = '11111111-1111-4111-8111-111111111111';
    (req as any).userId = '22222222-2222-4222-8222-222222222222';
    (req as any).user = { franchise_id: '33333333-3333-4333-8333-333333333333' };
    next();
  });
  app.use('/api/v2', router);
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: error.message });
  });
  return app;
}

describe('work-package-template.routes task-template relationship endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates relationship rows for a template and returns 201', async () => {
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(createThenable({ data: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, error: null }))
      .mockReturnValueOnce(createThenable({ data: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }], error: null }))
      .mockReturnValueOnce(createThenable({ data: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', assembly_models: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }], error: null }))
      .mockReturnValueOnce(createInsert({ error: null }))
      .mockReturnValueOnce(createThenable({
        data: [{
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          tenant_id: '11111111-1111-4111-8111-111111111111',
          franchise_id: '33333333-3333-4333-8333-333333333333',
          template_code: 'WP-100',
          version: 1,
          active: true,
          template_name: 'A Check',
          maintenance_type: 'line',
          scope_json: [],
          tasks_json: [],
          policy_snapshot_id: null,
          created_at: '2026-04-04T00:00:00.000Z',
          updated_at: '2026-04-04T00:00:00.000Z',
        }],
        error: null,
      }))
      .mockReturnValueOnce(createThenable({ data: [], error: null }));
    const app = await createTestApp(fromMock);
    const response = await request(app)
      .post('/api/v2/work-package-templates/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/task-templates')
      .send({ selected_task_template_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'] })
      .expect(201);

    expect(response.body.added_task_template_ids).toEqual(['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']);
    expect(fromMock).toHaveBeenCalledWith('work_package_template_task_templates');
  });

  it('returns 400 when task template ids are missing', async () => {
    const app = await createTestApp(jest.fn());
    const response = await request(app)
      .post('/api/v2/work-package-templates/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/task-templates')
      .send({})
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 on duplicate relationship constraint errors', async () => {
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(createThenable({ data: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, error: null }))
      .mockReturnValueOnce(createThenable({ data: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }], error: null }))
      .mockReturnValueOnce(createThenable({ data: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', assembly_models: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }], error: null }))
      .mockReturnValueOnce(createInsert({ error: { message: 'duplicate key value violates unique constraint' } }));
    const app = await createTestApp(fromMock);
    const response = await request(app)
      .post('/api/v2/work-package-templates/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/task-templates')
      .send({ selected_task_template_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'] })
      .expect(409);

    expect(response.body.code).toBe('CREATE_FAILED');
  });
});

describe('work-package-template.routes create endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates template + relationships and returns created template id with relationship_count', async () => {
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(createThenable({ data: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }], error: null }))
      .mockReturnValueOnce(createThenable({ data: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', assembly_models: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }], error: null }))
      .mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn(async () => ({
              data: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
              error: null,
            })),
          }),
        }),
      })
      .mockReturnValueOnce(createInsert({ error: null }))
      .mockReturnValueOnce(createThenable({
        data: [{
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          tenant_id: '11111111-1111-4111-8111-111111111111',
          franchise_id: '33333333-3333-4333-8333-333333333333',
          template_code: 'WP-LINE-001',
          version: 1,
          active: true,
          template_name: 'Line Check Package',
          maintenance_type: 'line',
          scope_json: [],
          tasks_json: [{ task_template_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }],
          policy_snapshot_id: null,
          created_at: '2026-04-04T00:00:00.000Z',
          updated_at: '2026-04-04T00:00:00.000Z',
        }],
        error: null,
      }))
      .mockReturnValueOnce(createThenable({
        data: [{
          id: 'rel-1',
          work_package_template_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          task_template_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          model_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        }],
        error: null,
      }))
      .mockReturnValueOnce(createThenable({
        data: [{
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          tt_sequence: 'TT-1',
          code_form_no: 'F-1',
          ata_code: '21',
          reference_amp: 'AMP-1',
          description: 'Task',
          assembly_models: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        }],
        error: null,
      }));
    const app = await createTestApp(fromMock);
    const response = await request(app)
      .post('/api/v2/work-package-templates')
      .send({
        template_code: 'WP-LINE-001',
        template_name: 'Line Check Package',
        maintenance_type: 'line',
        aircraft_model: 'A320',
        selected_task_template_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      })
      .expect(201);

    expect(response.body.work_package_template_id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(response.body.relationship_count).toBe(1);
  });

  it('creates relationships when selected ids are provided via tasks_json fallback', async () => {
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(createThenable({ data: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }], error: null }))
      .mockReturnValueOnce(createThenable({ data: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', assembly_models: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }], error: null }))
      .mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn(async () => ({
              data: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
              error: null,
            })),
          }),
        }),
      })
      .mockReturnValueOnce(createInsert({ error: null }))
      .mockReturnValueOnce(createThenable({
        data: [{
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          tenant_id: '11111111-1111-4111-8111-111111111111',
          franchise_id: '33333333-3333-4333-8333-333333333333',
          template_code: 'WP-LINE-001',
          version: 1,
          active: true,
          template_name: 'Line Check Package',
          maintenance_type: 'line',
          scope_json: [],
          tasks_json: [{ task_template_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }],
          policy_snapshot_id: null,
          created_at: '2026-04-04T00:00:00.000Z',
          updated_at: '2026-04-04T00:00:00.000Z',
        }],
        error: null,
      }))
      .mockReturnValueOnce(createThenable({
        data: [{
          id: 'rel-1',
          work_package_template_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          task_template_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          model_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        }],
        error: null,
      }))
      .mockReturnValueOnce(createThenable({
        data: [{
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          tt_sequence: 'TT-1',
          code_form_no: 'F-1',
          ata_code: '21',
          reference_amp: 'AMP-1',
          description: 'Task',
          assembly_models: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        }],
        error: null,
      }));
    const app = await createTestApp(fromMock);
    const response = await request(app)
      .post('/api/v2/work-package-templates')
      .send({
        template_code: 'WP-LINE-001',
        template_name: 'Line Check Package',
        maintenance_type: 'line',
        aircraft_model: 'A320',
        tasks_json: [{ task_template_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }],
      })
      .expect(201);

    expect(response.body.relationship_count).toBe(1);
  });

  it('rolls back template insert when relationship insert fails', async () => {
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(createThenable({ data: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }], error: null }))
      .mockReturnValueOnce(createThenable({ data: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', assembly_models: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }], error: null }))
      .mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn(async () => ({
              data: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
              error: null,
            })),
          }),
        }),
      })
      .mockReturnValueOnce(createInsert({ error: { message: 'duplicate key value violates unique constraint' } }))
      .mockReturnValueOnce(createThenable({ data: null, error: null }));
    const app = await createTestApp(fromMock);
    const response = await request(app)
      .post('/api/v2/work-package-templates')
      .send({
        template_code: 'WP-LINE-001',
        template_name: 'Line Check Package',
        maintenance_type: 'line',
        aircraft_model: 'A320',
        selected_task_template_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      })
      .expect(409);

    expect(response.body.code).toBe('CREATE_FAILED');
    expect(fromMock).toHaveBeenCalledWith('work_package_templates');
  });
});
