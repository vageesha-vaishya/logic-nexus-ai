import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './availability';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../_utils/http';
import { resolveGatewayCompatibility } from '../../../_utils/compatibility-facade';

vi.mock('../../../_utils/http', () => ({
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

vi.mock('../../../_utils/compatibility-facade', () => ({
  applyCompatibilityResponseHeaders: vi.fn(),
  resolveGatewayCompatibility: vi.fn(),
}));

function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown } {
  const res: any = {
    setHeader: vi.fn(),
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

describe('/api/v2/amro/inventory/availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AMRO_INVENTORY_V2_ENABLED = 'true';
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-1', tenantId: '', franchiseId: '' } as any);
    vi.mocked(resolveGatewayCompatibility).mockReturnValue({ compatMode: 'v2-shadow' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'u1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active', source: 'db', validatedAt: '2026-03-22' } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
  });

  it('returns inventory availability for requested part numbers', async () => {
    const req: ApiRequest = {
      method: 'GET',
      query: { station_code: 'DXB', part_numbers: 'PN-1,PN-2' },
      headers: {},
      body: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.output?.items?.length).toBe(2);
  });
});
