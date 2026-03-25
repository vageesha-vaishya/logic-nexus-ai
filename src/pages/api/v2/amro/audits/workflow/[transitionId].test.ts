import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './[transitionId]';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../../_utils/http';
import { fetchWorkflowTransactionLogByTransitionId } from '../../workflow-transaction-logger';

vi.mock('../../../../_utils/http', () => ({
  applyCors: vi.fn(),
  authenticateRequest: vi.fn(),
  buildApiContext: vi.fn(),
  enforceAmroDomainAccess: vi.fn(),
  enforceAnyPermission: vi.fn(),
  enforceHttps: vi.fn(),
  handlePreflight: vi.fn(),
  resolveAndApplyAccessContext: vi.fn(),
}));

vi.mock('../../workflow-transaction-logger', () => ({
  fetchWorkflowTransactionLogByTransitionId: vi.fn(),
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

describe('/api/v2/amro/audits/workflow/{transitionId}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({ correlationId: 'corr-audit' } as any);
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'user-1', role: 'tenant_admin', permissions: ['dashboards.view'] } as any);
    vi.mocked(resolveAndApplyAccessContext).mockResolvedValue({ tenantId: 'tenant-1', franchiseId: 'fr-1' } as any);
    vi.mocked(enforceAmroDomainAccess).mockResolvedValue({ subscriptionStatus: 'active', source: 'database', validatedAt: '2026-03-24T00:00:00.000Z' } as any);
  });

  it('returns workflow audit payload when transition log exists', async () => {
    vi.mocked(fetchWorkflowTransactionLogByTransitionId).mockResolvedValue({
      tx_id: 'wf-tx-1',
      transition_id: 'tx-100',
      gate_name: 'work-package-transition',
      input_payload: { work_package_id: 'wp-1' },
      output_payload: { updated_status: 'completed' },
      tx_timestamp: '2026-03-24T00:00:00.000Z',
      user_ctx: { user_id: 'user-1' },
      tx_status: 'SUCCESS',
    } as any);
    const req: ApiRequest = { method: 'GET', query: { transitionId: 'tx-100' }, headers: {} };
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any)?.transition_id).toBe('tx-100');
    expect((res.jsonBody as any)?.log?.tx_status).toBe('SUCCESS');
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(applyCors).toHaveBeenCalled();
  });
});
