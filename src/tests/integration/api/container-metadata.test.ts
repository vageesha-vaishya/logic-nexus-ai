import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/pages/api/_utils/supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(() => ({})),
}));

import containerTypesHandler from '@/pages/api/container-types';
import containerSizesHandler from '@/pages/api/container-sizes';
import { ContainerMetadataApiService } from '@/services/logistics/ContainerMetadataApiService';

function mockReqRes(input: { method?: string; query?: Record<string, unknown>; headers?: Record<string, string>; body?: any }) {
  const headers: Record<string, string> = input.headers || {};
  const req = {
    method: input.method,
    query: input.query || {},
    headers,
    body: input.body,
  } as any;

  let statusCode = 200;
  let payload: any;
  let endedText = '';

  const res = {
    setHeader: vi.fn(),
    status: vi.fn((code: number) => {
      statusCode = code;
      return {
        json: (data: unknown) => {
          payload = data;
        },
        end: (text?: string) => {
          endedText = text || '';
        },
      };
    }),
    _getStatusCode: () => statusCode,
    _getData: () => payload,
    _getEndText: () => endedText,
  } as any;

  return { req, res };
}

describe('Container metadata API contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/container-types returns DTO array', async () => {
    vi.spyOn(ContainerMetadataApiService.prototype, 'getContainerTypes').mockResolvedValue([
      { id: 101, sourceId: 'dry', name: 'Dry', description: 'Dry', isActive: true, code: 'DRY' },
    ]);

    const { req, res } = mockReqRes({
      method: 'GET',
      headers: { 'x-tenant-id': 'tenant-1', 'x-user-id': 'user-1' },
    });

    await containerTypesHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getData().data[0]).toEqual(
      expect.objectContaining({
        id: 101,
        sourceId: 'dry',
        name: 'Dry',
        description: 'Dry',
        isActive: true,
      })
    );
    expect(res._getData().version).toBe('v1');
  });

  it('GET /api/container-types returns 404 for empty data', async () => {
    vi.spyOn(ContainerMetadataApiService.prototype, 'getContainerTypes').mockResolvedValue([]);

    const { req, res } = mockReqRes({
      method: 'GET',
      headers: { 'x-tenant-id': 'tenant-1', 'x-user-id': 'user-1' },
    });

    await containerTypesHandler(req, res);

    expect(res._getStatusCode()).toBe(404);
    expect(res._getData().error).toContain('No container types found');
  });

  it('GET /api/container-sizes validates invalid typeId', async () => {
    const { req, res } = mockReqRes({
      method: 'GET',
      query: { typeId: 'invalid;drop table' },
      headers: { 'x-tenant-id': 'tenant-1', 'x-user-id': 'user-1' },
    });

    await containerSizesHandler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getData().code).toBe('INVALID_TYPE_ID');
  });

  it('GET /api/container-sizes returns DTO array', async () => {
    vi.spyOn(ContainerMetadataApiService.prototype, 'getContainerSizes').mockResolvedValue([
      { id: 202, sourceId: '20', containerTypeSourceId: 'dry', name: '20ft', description: '20ft', isActive: true, isoCode: '22G1' },
    ]);

    const { req, res } = mockReqRes({
      method: 'GET',
      query: { typeId: 'dry' },
      headers: { 'x-tenant-id': 'tenant-1', 'x-user-id': 'user-1' },
    });

    await containerSizesHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getData().data[0]).toEqual(
      expect.objectContaining({
        id: 202,
        sourceId: '20',
        containerTypeSourceId: 'dry',
        name: '20ft',
        isActive: true,
      })
    );
    expect(res._getData().version).toBe('v1');
  });
});
