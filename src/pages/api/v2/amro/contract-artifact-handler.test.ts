import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import { applyCors, buildApiContext, enforceHttps, enforceRateLimit, handlePreflight } from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { serveAmroContractArtifact } from './contract-artifact-handler';

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

function createResponse(): ApiResponse & { statusCode?: number; jsonBody?: unknown; endBody?: string; headers: Record<string, any> } {
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
        end: (body?: string) => {
          res.endBody = body || '';
        },
      };
    }),
  };
  return res;
}

describe('serveAmroContractArtifact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handlePreflight).mockReturnValue(false);
    vi.mocked(buildApiContext).mockReturnValue({
      correlationId: 'corr-amro-contract',
      tenantId: '',
      franchiseId: '',
      userId: '',
      role: '',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    } as any);
  });

  it('serves contract file content for GET requests', async () => {
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await serveAmroContractArtifact(req, res, {
      fileName: 'openapi-3.1.yaml',
      contentType: 'application/yaml; charset=utf-8',
    });

    expect(applyCors).toHaveBeenCalled();
    expect(enforceHttps).toHaveBeenCalledWith(req);
    expect(enforceRateLimit).toHaveBeenCalledWith(req);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/yaml; charset=utf-8');
    expect(res.endBody).toContain('openapi: 3.1.0');
  });

  it('returns 405 for unsupported methods', async () => {
    const req: ApiRequest = { method: 'POST', query: {}, headers: {} };
    const res = createResponse();

    await serveAmroContractArtifact(req, res, {
      fileName: 'openapi-3.1.yaml',
      contentType: 'application/yaml; charset=utf-8',
    });

    expect(res.statusCode).toBe(405);
    expect((res.jsonBody as any)?.error).toContain('Method POST Not Allowed');
  });

  it('delegates errors to API error handler', async () => {
    const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
    const res = createResponse();

    await serveAmroContractArtifact(req, res, {
      fileName: 'missing.yaml',
      contentType: 'application/yaml; charset=utf-8',
    });

    expect(sendErrorResponse).toHaveBeenCalledWith(res, expect.any(Error), 'corr-amro-contract', { apiVersion: 'v2' });
  });
});
