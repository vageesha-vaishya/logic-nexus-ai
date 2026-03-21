import { authMiddleware, AuthRequest } from '../src/middleware/auth.middleware';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
};

function createMockResponse(): MockResponse {
  const res: Partial<MockResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as MockResponse;
}

describe('authMiddleware tenant-aware scope resolution', () => {
  const getUser = jest.fn();
  const eq = jest.fn();
  const select = jest.fn();
  const from = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    select.mockReturnValue({ eq });
    from.mockReturnValue({ select });
    (createClient as jest.Mock).mockReturnValue({
      auth: { getUser },
      from
    });
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.SUPABASE_SERVICE_KEY = '';
    getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null
    });
  });

  it('uses requested tenant and franchise when user is assigned to that scope', async () => {
    eq.mockResolvedValue({
      data: [
        { role: 'franchise_admin', tenant_id: 'tenant-1', franchise_id: 'franchise-1' }
      ],
      error: null
    });

    const req = {
      headers: {
        authorization: 'Bearer token-1',
        'x-tenant-id': 'tenant-1',
        'x-franchise-id': 'franchise-1'
      }
    } as unknown as AuthRequest;
    const res = createMockResponse();
    const next = jest.fn();

    await authMiddleware(req, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.tenantId).toBe('tenant-1');
    expect(req.franchiseId).toBe('franchise-1');
  });

  it('rejects requested tenant scope when user is not assigned to it', async () => {
    eq.mockResolvedValue({
      data: [
        { role: 'franchise_admin', tenant_id: 'tenant-1', franchise_id: 'franchise-1' }
      ],
      error: null
    });

    const req = {
      headers: {
        authorization: 'Bearer token-1',
        'x-tenant-id': 'tenant-2'
      }
    } as unknown as AuthRequest;
    const res = createMockResponse();
    const next = jest.fn();

    await authMiddleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'FORBIDDEN_SCOPE' })
    );
  });

  it('allows platform admin to use requested tenant scope', async () => {
    eq.mockResolvedValue({
      data: [
        { role: 'platform_admin', tenant_id: null, franchise_id: null }
      ],
      error: null
    });

    const req = {
      headers: {
        authorization: 'Bearer token-1',
        'x-tenant-id': 'tenant-9',
        'x-franchise-id': 'franchise-9'
      }
    } as unknown as AuthRequest;
    const res = createMockResponse();
    const next = jest.fn();

    await authMiddleware(req, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.tenantId).toBe('tenant-9');
    expect(req.franchiseId).toBe('franchise-9');
  });

  it('falls back to assigned tenant/franchise when no scope header is provided', async () => {
    eq.mockResolvedValue({
      data: [
        { role: 'tenant_admin', tenant_id: 'tenant-1', franchise_id: null },
        { role: 'franchise_admin', tenant_id: 'tenant-1', franchise_id: 'franchise-7' }
      ],
      error: null
    });

    const req = {
      headers: {
        authorization: 'Bearer token-1'
      }
    } as unknown as AuthRequest;
    const res = createMockResponse();
    const next = jest.fn();

    await authMiddleware(req, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.tenantId).toBe('tenant-1');
    expect(req.franchiseId).toBe('franchise-7');
  });

  it('accepts SUPABASE_SERVICE_KEY when SUPABASE_SERVICE_ROLE_KEY is absent', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    process.env.SUPABASE_SERVICE_KEY = 'fallback-service-key';
    eq.mockResolvedValue({
      data: [
        { role: 'franchise_admin', tenant_id: 'tenant-1', franchise_id: 'franchise-1' }
      ],
      error: null
    });

    const req = {
      headers: {
        authorization: 'Bearer token-1',
        'x-tenant-id': 'tenant-1',
        'x-franchise-id': 'franchise-1'
      }
    } as unknown as AuthRequest;
    const res = createMockResponse();
    const next = jest.fn();

    await authMiddleware(req, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith('http://localhost:54321', 'fallback-service-key');
  });
});
