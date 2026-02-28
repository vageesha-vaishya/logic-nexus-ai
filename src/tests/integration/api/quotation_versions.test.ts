import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMocks } from 'node-mocks-http';
import handler from '../../../pages/api/v1/quotations/[id]/versions';
import { QuotationVersionService } from '@/services/quotation/QuotationVersionService';

// Mock the service
vi.mock('@/services/quotation/QuotationVersionService');

describe('API: /quotations/[id]/versions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET should return list of versions', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { id: 'q1', page: '1', limit: '10' },
    });

    const mockVersions = [{ id: 'v1', version_number: 1 }];
    // @ts-ignore
    QuotationVersionService.prototype.listVersions.mockResolvedValue({ data: mockVersions, count: 1 });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ data: mockVersions, count: 1 });
  });

  it('POST should create a new version', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'q1' },
      body: {
        data: { some: 'payload' },
        type: 'minor',
        reason: 'update'
      },
      headers: {
        'x-tenant-id': 't1',
        'x-user-id': 'u1'
      }
    });

    const mockVersion = { id: 'v2', version_number: 2 };
    // @ts-ignore
    QuotationVersionService.prototype.saveVersion.mockResolvedValue(mockVersion);

    await handler(req, res);

    expect(res._getStatusCode()).toBe(201);
    expect(JSON.parse(res._getData())).toEqual(mockVersion);
    expect(QuotationVersionService.prototype.saveVersion).toHaveBeenCalledWith(
      'q1', 't1', { some: 'payload' }, 'minor', 'u1', 'update'
    );
  });

  it('DELETE should delete a version if ID provided', async () => {
    const { req, res } = createMocks({
      method: 'DELETE',
      query: { id: 'q1' },
      body: { versionId: 'v1' },
      headers: { 'x-user-id': 'u1' }
    });

    // @ts-ignore
    QuotationVersionService.prototype.deleteVersion.mockResolvedValue(true);

    await handler(req, res);

    expect(res._getStatusCode()).toBe(204);
    expect(QuotationVersionService.prototype.deleteVersion).toHaveBeenCalledWith('v1', 'u1');
  });
});
