import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './etl';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import { resolveUimAccess } from '../_shared';
import { resetUimEtlSchedulerState, setUimEtlExecutor } from '@/modules/uim/analytics/etlScheduler';

vi.mock('../../../_utils/http', async () => {
  const actual = await vi.importActual<object>('../../../_utils/http');
  return {
    ...actual,
    applyCors: vi.fn(),
    buildApiContext: vi.fn(() => ({ correlationId: 'corr-uim-analytics-etl' })),
    enforceHttps: vi.fn(),
    enforceRateLimit: vi.fn(),
    handlePreflight: vi.fn(() => false),
  };
});

vi.mock('../../../_utils/errorHandler', () => ({
  sendErrorResponse: vi.fn(),
}));

vi.mock('../_shared', async () => {
  const actual = await vi.importActual<object>('../_shared');
  return {
    ...actual,
    resolveUimAccess: vi.fn(),
  };
});

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

describe('/api/v2/uim/analytics/etl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetUimEtlSchedulerState();
    vi.mocked(resolveUimAccess).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      franchiseId: '',
    });
    setUimEtlExecutor(async () => ({
      extracted: 12,
      transformed: 10,
      loaded: 10,
    }));
  });

  it('schedules and processes ETL run with telemetry response', async () => {
    const scheduleReq: ApiRequest = {
      method: 'POST',
      headers: {},
      query: {},
      body: {
        action: 'schedule-run',
        source: 'uim-ledger',
        max_attempts: 3,
      },
    };
    const scheduleRes = createResponse();
    await handler(scheduleReq, scheduleRes);
    expect(scheduleRes.statusCode).toBe(200);

    const processReq: ApiRequest = {
      method: 'POST',
      headers: {},
      query: {},
      body: {
        action: 'process-now',
      },
    };
    const processRes = createResponse();
    await handler(processReq, processRes);
    expect(processRes.statusCode).toBe(200);
    expect((processRes.jsonBody as any)?.output?.queue?.completed).toBe(1);
    expect((processRes.jsonBody as any)?.output?.telemetry?.completed_runs).toBe(1);
  });
});
