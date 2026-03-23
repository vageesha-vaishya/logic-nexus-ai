import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import handler from './screen-inventory';
import {
  applyCors,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';

vi.mock('../../_utils/http', () => ({
  applyCors: vi.fn(),
  buildApiContext: vi.fn(),
  enforceHttps: vi.fn(),
  enforceRateLimit: vi.fn(),
  handlePreflight: vi.fn(),
}));

vi.mock('../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../../_utils/compatibility-facade', () => ({
  applyCompatibilityResponseHeaders: vi.fn(),
  resolveGatewayCompatibility: vi.fn(),
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

describe('/api/v2/amro/screen-inventory', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-screen-inventory',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
    vi.mocked(resolveGatewayCompatibility).mockReturnValue({ apiVersion: 'v2', compatMode: 'v2-shadow' });
  });

  it('returns screen inventory rows and UI/UX mapping matrix for AMRO sections 16.1 and 26.2', async () => {
    process.env.AMRO_SCREEN_INVENTORY_V2_ENABLED = 'true';
    const req: ApiRequest = {
      method: 'GET',
      query: {},
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.mode).toBe('screen-inventory');
    expect((res.jsonBody as any)?.data?.screenInventory?.summary?.totalScreens).toBe(12);
    expect((res.jsonBody as any)?.data?.screenInventory?.summary?.layoutContractScreens).toBe(11);
    expect((res.jsonBody as any)?.data?.screenInventory?.summary?.mappingMatrixModules).toBe(10);
    expect((res.jsonBody as any)?.data?.screenInventory?.summary?.accessibilityAreas).toBe(5);
    expect((res.jsonBody as any)?.data?.screenInventory?.screens?.[0]?.screenId).toBe('SCR-AMRO-001');
    expect((res.jsonBody as any)?.data?.screenInventory?.screens?.[11]?.screenName).toBe('Forecast Recommendation Hub');
    expect((res.jsonBody as any)?.data?.screenInventory?.screens?.map((screen: any) => screen.screenId)).toEqual(
      expect.arrayContaining([
        'SCR-AMRO-002',
        'SCR-AMRO-003',
        'SCR-AMRO-004',
        'SCR-AMRO-005',
        'SCR-AMRO-006',
        'SCR-AMRO-007',
        'SCR-AMRO-008',
        'SCR-AMRO-009',
      ])
    );
    expect((res.jsonBody as any)?.data?.screenInventory?.layoutContracts?.[0]?.screenId).toBe('SCR-AMRO-001');
    expect((res.jsonBody as any)?.data?.screenInventory?.layoutContracts?.[10]?.screenId).toBe('SCR-AMRO-011');
    expect((res.jsonBody as any)?.data?.screenInventory?.uiUxMappingMatrix?.[0]).toEqual({
      moduleId: 'MOD-AMRO-01',
      primaryScreens: ['SCR-AMRO-001 Overview Dashboard'],
      wireframeReferences: ['5.3.1'],
      userFlowReferences: ['5.4.1', '17.1'],
      interfaceSpecifications: ['16.2 dashboard layout contract', '16.3 behavior rules'],
    });
    expect((res.jsonBody as any)?.data?.screenInventory?.uiUxMappingMatrix?.[9]).toEqual({
      moduleId: 'MOD-AMRO-10',
      primaryScreens: ['SCR-AMRO-010 Audit Replay Timeline'],
      wireframeReferences: ['5.3.3 activity/audit context'],
      userFlowReferences: ['17.3 gate rationale path'],
      interfaceSpecifications: ['19.2 API-AMRO-014 replay interface requirements'],
    });
    expect((res.jsonBody as any)?.data?.screenInventory?.behaviorRules?.stableActionOrder).toEqual([
      'search',
      'filter',
      'view',
      'create',
      'refresh',
      'import-export',
      'theme',
    ]);
    expect((res.jsonBody as any)?.data?.screenInventory?.accessibilityAndI18n?.[0]?.area).toBe('Keyboard navigation');
    expect((res.jsonBody as any)?.domainAccess?.subscriptionStatus).toBe('public');
    expect((res.jsonBody as any)?.serviceBoundaries?.scopedAccess?.tenant_id).toBe('public');
    expect(applyCompatibilityResponseHeaders).toHaveBeenCalled();
  });

  it('handles unsupported methods', async () => {
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      headers: {},
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect((res.jsonBody as any)?.error).toContain('Method POST Not Allowed');
    expect(sendErrorResponse).not.toHaveBeenCalled();
  });
});
