import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import handler from './bootstrap';
import {
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../../_utils/http';
import { resetMobileSecurityTestState } from './shared';

vi.mock('../../../../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAmroDomainAccess: vi.fn(),
  enforceAnyPermission: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
  parseHeaderValue: (value: string | string[] | undefined) => (Array.isArray(value) ? (value[0] || '') : (value || '')),
  resolveAndApplyAccessContext: vi.fn(),
}));

vi.mock('../../../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
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
        end: vi.fn(),
      };
    }),
  };
  return res;
}

describe('/api/v2/amro/security/mobile/bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMobileSecurityTestState();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-mobile-bootstrap' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'user-1', role: 'tenant_admin', permissions: ['inventory.read'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: null } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ isAuthorized: true } as any);
    vi.mocked(enforceAnyPermission).mockImplementation(() => undefined);
  });

  it('issues mobile session binding on bootstrap request', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {
        'x-amro-mobile-platform': 'ios',
        'x-tls-version': '1.3',
        'x-amro-cert-pinning': 'strict',
        'x-amro-app-version': '2.4.1',
        'x-amro-app-build': '24101',
        'x-amro-device-id': 'device-1',
        'x-amro-attestation-provider': 'app_attest',
        'x-amro-attestation-token': 'abcdefghijklmnopqrstuvwxyz1234',
      },
      body: {
        action: 'bootstrap',
        device_id: 'device-1',
        biometric_strength: 'strong',
      },
    };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.interface).toBe('amro-mobile-security-bootstrap');
    expect((res.jsonBody as any)?.output?.binding_id).toBeTruthy();
  });
});
