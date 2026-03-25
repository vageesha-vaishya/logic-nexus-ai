import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './templates';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { listTemplateRegistryEntries } from './template-registry-client';

vi.mock('../../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAmroDomainAccess: vi.fn(),
  enforceAnyPermission: vi.fn(),
  enforceHttps: vi.fn(),
  handlePreflight: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
}));

vi.mock('./template-registry-client', () => ({
  listTemplateRegistryEntries: vi.fn(),
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

describe('/api/v2/amro/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-templates' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'user-1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active', source: 'database', validatedAt: '2026-03-24T00:00:00.000Z' } as any);
  });

  it('returns template list using registryVersion query parameter', async () => {
    vi.mocked(listTemplateRegistryEntries).mockResolvedValue([
      {
        id: 'template-001',
        name: 'Base Template',
        version: '2.1.0',
        lifecycleState: 'ACTIVE',
        validFrom: '2026-01-01T00:00:00.000Z',
        validTo: null,
        permissions: ['READ', 'INSTANTIATE'],
      } as any,
    ]);
    const req: ApiRequest = { method: 'GET', query: { registryVersion: '2026.03' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.source).toBe('template-registry');
    expect((res.jsonBody as any)?.registryVersion).toBe('2026.03');
    expect((res.jsonBody as any)?.templates?.length).toBe(1);
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(applyCors).toHaveBeenCalled();
    expect(enforceAnyPermission).toHaveBeenCalled();
  });
});
