import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './vertical-extraction';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  logApiEvent,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import {
  getAclCompatibilityAdapter,
  resolveAclWritePlan,
  setAclModuleExtractionConfig,
  translateLegacySchemaRecord,
} from '../../_utils/vertical-extraction-acl';
import { resolveGatewayFeatureFlag } from '../../_utils/gateway-feature-flags';

vi.mock('../../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAnyPermission: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
  logApiEvent: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
}));

vi.mock('../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../../_utils/compatibility-facade', () => ({
  applyCompatibilityResponseHeaders: vi.fn(),
  resolveGatewayCompatibility: vi.fn(),
}));

vi.mock('../../_utils/vertical-extraction-acl', () => ({
  getAclCompatibilityAdapter: vi.fn(),
  resolveAclWritePlan: vi.fn(),
  setAclModuleExtractionConfig: vi.fn(),
  translateLegacySchemaRecord: vi.fn(),
}));

vi.mock('../../_utils/gateway-feature-flags', () => ({
  resolveGatewayFeatureFlag: vi.fn(),
}));

function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown; headers: Record<string, any> } {
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
        end: vi.fn(),
      };
    }),
  };
  return res;
}

describe('/api/v1/gateway/vertical-extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-vertical-extraction',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(resolveGatewayCompatibility).mockReturnValue({ apiVersion: 'v1', compatMode: 'v1-pass' });
    vi.mocked(authenticateRequest).mockResolvedValue({
      userId: 'user-1',
      role: 'tenant_admin',
      permissions: ['dashboards.view'],
    } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(resolveGatewayFeatureFlag).mockReturnValue({
      moduleKey: 'gateway.vertical-extraction',
      enabled: true,
      reason: 'enabled',
      configVersion: 5,
      checksum: 'checksum-5',
      cohortMatched: true,
      rolloutBucket: 2,
      rolloutPercent: 100,
    } as any);
    vi.mocked(getAclCompatibilityAdapter).mockReturnValue({
      moduleKey: 'module-crm',
      extractionEnabled: true,
      aclLegacyPathEnabled: true,
      routePath: 'extracted',
      reason: 'extracted_enabled',
    } as any);
    vi.mocked(resolveAclWritePlan).mockReturnValue({
      allowed: true,
      directWrite: false,
      writePath: 'acl-legacy-proxy',
      sourceModule: 'module-crm',
      targetModule: 'module-quotation',
      tableName: 'quotations',
      reason: 'cross_module_acl_proxy',
      translatedPayload: {},
    } as any);
    vi.mocked(setAclModuleExtractionConfig).mockReturnValue({
      moduleKey: 'module-crm',
      extractionEnabled: true,
      aclLegacyPathEnabled: true,
      routePath: 'acl-legacy',
      reason: 'rollback_toggle',
    } as any);
    vi.mocked(translateLegacySchemaRecord).mockReturnValue({
      leadId: 'lead-1',
    } as any);
  });

  it('returns acl module controls and write plan on GET', async () => {
    const req: ApiRequest = { method: 'GET', query: { moduleKey: 'module-crm' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalledWith(req, res, { methods: ['GET', 'PATCH', 'OPTIONS'] });
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceAnyPermission).toHaveBeenCalled();
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.data?.moduleConfig?.moduleKey).toBe('module-crm');
    expect((res.jsonBody as any)?.data?.writePlan?.writePath).toBe('acl-legacy-proxy');
  });

  it('updates acl module config and schema translation on PATCH', async () => {
    const req: ApiRequest = {
      method: 'PATCH',
      query: { moduleKey: 'module-crm' },
      headers: {},
      body: {
        moduleConfig: {
          moduleKey: 'module-crm',
          rollbackToLegacy: true,
        },
        writePlan: {
          sourceModule: 'module-crm',
          tableName: 'quotations',
          payload: { quote_id: 'q-1' },
        },
        translation: {
          entityKey: 'crm.lead',
          direction: 'legacy_to_canonical',
          payload: { id: 'lead-1' },
        },
      },
    };
    const res = createResponse();

    await handler(req, res);

    expect(setAclModuleExtractionConfig).toHaveBeenCalled();
    expect(resolveAclWritePlan).toHaveBeenCalled();
    expect(translateLegacySchemaRecord).toHaveBeenCalled();
    expect(logApiEvent).toHaveBeenCalledWith(
      'info',
      '[VerticalExtractionACL] config updated',
      expect.objectContaining({ moduleKey: 'module-crm' })
    );
    expect(res.statusCode).toBe(200);
  });

  it('delegates failures to shared error handler', async () => {
    vi.mocked(getAclCompatibilityAdapter).mockImplementation(() => {
      throw new Error('acl unavailable');
    });
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(sendErrorResponse).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'corr-vertical-extraction'
    );
  });
});
