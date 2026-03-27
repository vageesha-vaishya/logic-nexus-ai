import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import handler from './aircraft-leads';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';

vi.mock('../../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAmroDomainAccess: vi.fn(),
  enforceAnyPermission: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
}));

vi.mock('../../_utils/compatibility-facade', () => ({
  applyCompatibilityResponseHeaders: vi.fn(),
  resolveGatewayCompatibility: vi.fn(),
}));

vi.mock('../../_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown; headers: Record<string, unknown> } {
  const res: any = {
    headers: {},
    setHeader: vi.fn((name: string, value: string | string[]) => {
      res.headers[name] = value;
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return {
        json: (body: unknown) => {
          res.jsonBody = body;
        },
      };
    }),
  };
  return res;
}

function createSupabaseMock(config: {
  aircraftRows?: Array<Record<string, unknown>>;
  leadRows?: Array<Record<string, unknown>>;
}) {
  const aircraftRows = config.aircraftRows || [];
  const leadRows = config.leadRows || [];
  const createChain = (tableName: string) => {
    const chain: any = {
      _action: 'select',
      select: vi.fn(() => {
        chain._action = 'select';
        return chain;
      }),
      insert: vi.fn(() => {
        chain._action = 'insert';
        return chain;
      }),
      update: vi.fn(() => {
        chain._action = 'update';
        return chain;
      }),
      delete: vi.fn(() => {
        chain._action = 'delete';
        return chain;
      }),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      single: vi.fn(async () => {
        if (tableName === 'aircraft_leads' && chain._action === 'insert') {
          return {
            data: {
              id: 'lead-new',
              aircraft_id: 'ac-1',
              aircraft_registration: 'A6-ABC',
              aircraft_type: 'A320',
              title: 'Hydraulic inspection',
              status: 'new',
              priority: 'high',
              source: 'manual',
              score: 80,
              compliance_state: 'monitoring',
              regulatory_authority: 'DGCA',
              tags: ['hydraulic'],
              created_at: '2026-03-27T10:00:00.000Z',
              updated_at: '2026-03-27T10:00:00.000Z',
              tenant_id: 'tenant-1',
              franchise_id: 'fr-1',
            },
            error: null,
          };
        }
        return { data: null, error: null };
      }),
      then: (resolve: (value: { data: unknown; error: null }) => unknown) => {
        if (tableName === 'aircraft') {
          return Promise.resolve(resolve({ data: aircraftRows, error: null }));
        }
        if (tableName === 'aircraft_leads') {
          if (chain._action === 'update' || chain._action === 'delete') {
            return Promise.resolve(resolve({ data: [], error: null }));
          }
          return Promise.resolve(resolve({ data: leadRows, error: null }));
        }
        if (tableName === 'maintenance_events') {
          return Promise.resolve(resolve({ data: [], error: null }));
        }
        return Promise.resolve(resolve({ data: [], error: null }));
      },
    };
    return chain;
  };
  return {
    from: vi.fn((table: string) => createChain(table)),
  };
}

describe('/api/v2/amro/aircraft-leads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-aircraft-leads', tenantId: '', franchiseId: '' } as any);
    vi.mocked(resolveGatewayCompatibility).mockReturnValue({ compatMode: 'v2-shadow' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'tenant_admin',
      permissions: ['view_amro_dashboard', 'edit_aircraft_records', 'create_maintenance_request', 'approve_work_orders'],
    } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active', source: 'database', validatedAt: '2026-03-27T00:00:00.000Z' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
  });

  it('returns paginated aircraft leads with metadata', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      createSupabaseMock({
        aircraftRows: [{ id: 'ac-1', registration: 'A6-ABC', aircraft_type: 'A320' }],
        leadRows: [{
          id: 'lead-1',
          tenant_id: 'tenant-1',
          franchise_id: 'fr-1',
          aircraft_id: 'ac-1',
          title: 'Hydraulic inspection',
          status: 'new',
          priority: 'high',
          source: 'manual',
          score: 85,
          compliance_state: 'review',
          regulatory_authority: 'DGCA',
          tags: ['hydraulic'],
          created_at: '2026-03-27T10:00:00.000Z',
          updated_at: '2026-03-27T10:00:00.000Z',
        }],
      }) as any,
    );

    const req: ApiRequest = {
      method: 'GET',
      query: { page: '1', page_size: '25', sort_by: 'updated_at', sort_dir: 'desc', search: 'hydraulic' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.records?.length).toBe(1);
    expect((res.jsonBody as any)?.output?.total_count).toBe(1);
    expect((res.jsonBody as any)?.output?.metadata?.cache).toBe('miss');
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(applyCors).toHaveBeenCalled();
  });

  it('returns autocomplete suggestions', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      createSupabaseMock({
        aircraftRows: [{ id: 'ac-1', registration: 'A6-ABC', aircraft_type: 'A320' }],
        leadRows: [{
          id: 'lead-1',
          tenant_id: 'tenant-1',
          franchise_id: 'fr-1',
          aircraft_id: 'ac-1',
          title: 'Hydraulic inspection',
          status: 'new',
          priority: 'high',
          source: 'manual',
          score: 85,
          compliance_state: 'review',
          regulatory_authority: 'DGCA',
          tags: ['hydraulic'],
          created_at: '2026-03-27T10:00:00.000Z',
          updated_at: '2026-03-27T10:00:00.000Z',
        }],
      }) as any,
    );

    const req: ApiRequest = {
      method: 'GET',
      query: { autocomplete: '1', search: 'hyd' },
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.suggestions?.length).toBeGreaterThan(0);
  });

  it('creates lead record through POST', async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      createSupabaseMock({
        aircraftRows: [{ id: 'ac-1', registration: 'A6-ABC', aircraft_type: 'A320' }],
        leadRows: [{ id: 'seed' }],
      }) as any,
    );

    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
      body: {
        title: 'Hydraulic inspection',
        aircraft_id: 'ac-1',
        aircraft_registration: 'A6-ABC',
        aircraft_type: 'A320',
        status: 'new',
        priority: 'high',
        source: 'manual',
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect((res.jsonBody as any)?.output?.record?.id).toBe('lead-new');
  });
});
