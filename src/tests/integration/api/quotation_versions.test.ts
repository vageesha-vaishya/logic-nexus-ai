import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { createMocks } from 'node-mocks-http';

const {
  mockMaybeSingle,
  mockEq,
  mockOr,
  mockLimit,
  mockFrom
} = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockEq = vi.fn();
  const mockOr = vi.fn();
  const mockLimit = vi.fn();
  const mockQueryBuilder = {} as {
    select: Mock;
    eq: Mock;
    or: Mock;
    limit: Mock;
    maybeSingle: Mock;
  };
  Object.assign(mockQueryBuilder, {
    select: vi.fn(),
    eq: mockEq,
    or: mockOr,
    limit: mockLimit,
    maybeSingle: mockMaybeSingle,
  });

  mockQueryBuilder.select.mockImplementation(() => mockQueryBuilder);
  mockEq.mockImplementation(() => mockQueryBuilder);
  mockOr.mockImplementation(() => mockQueryBuilder);
  mockLimit.mockImplementation(() => mockQueryBuilder);
  const mockFrom = vi.fn().mockImplementation(() => mockQueryBuilder);

  return { mockMaybeSingle, mockEq, mockOr, mockLimit, mockFrom };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import handler from '../../../pages/api/v1/quotations/[id]/versions';
import { QuotationVersionService } from '@/services/quotation/QuotationVersionService';

// Mock the service
vi.mock('@/services/quotation/QuotationVersionService');

describe('API: /quotations/[id]/versions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockReset();
    mockEq.mockClear();
    mockOr.mockClear();
    mockLimit.mockClear();
    mockFrom.mockClear();
  });

  it('GET should return list of versions', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { id: 'q1', page: '1', limit: '10' },
    });

    const mockVersions = [{ id: 'v1', version_number: 1 }];
    (QuotationVersionService.prototype.listVersions as Mock).mockResolvedValue({ data: mockVersions, count: 1 });
    mockMaybeSingle.mockResolvedValue({ data: { id: 'q-resolved' }, error: null });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ data: mockVersions, count: 1 });
    expect(QuotationVersionService.prototype.listVersions).toHaveBeenCalledWith('q-resolved', 1, 10);
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
    (QuotationVersionService.prototype.saveVersion as Mock).mockResolvedValue(mockVersion);
    mockMaybeSingle.mockResolvedValue({ data: { id: 'q-resolved' }, error: null });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(201);
    expect(JSON.parse(res._getData())).toEqual(mockVersion);
    expect(QuotationVersionService.prototype.saveVersion).toHaveBeenCalledWith(
      'q-resolved', 't1', { some: 'payload' }, 'minor', 'u1', 'update'
    );
  });

  it('DELETE should delete a version if ID provided', async () => {
    const { req, res } = createMocks({
      method: 'DELETE',
      query: { id: 'q1' },
      body: { versionId: 'v1' },
      headers: { 'x-user-id': 'u1' }
    });
    
    // @ts-ignore: Mocking method on prototype for testing purposes
    (QuotationVersionService.prototype.deleteVersion as Mock).mockResolvedValue(true);
    mockMaybeSingle.mockResolvedValue({ data: { id: 'q-resolved' }, error: null });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(204);
    expect(QuotationVersionService.prototype.deleteVersion).toHaveBeenCalledWith('v1', 'u1');
  });

  it('GET resolves non-UUID route id via fallback quote id lookup', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { id: 'legacy-quote-001', page: '1', limit: '10' },
      headers: { 'x-tenant-id': 't1' }
    });

    const mockVersions = [{ id: 'v-legacy', version_number: 4 }];
    (QuotationVersionService.prototype.listVersions as Mock).mockResolvedValue({ data: mockVersions, count: 1 });
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: 'q-legacy' }, error: null });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(QuotationVersionService.prototype.listVersions).toHaveBeenCalledWith('q-legacy', 1, 10);
    expect(mockEq).toHaveBeenCalledWith('quote_number', 'legacy-quote-001');
    expect(mockEq).toHaveBeenCalledWith('id', 'legacy-quote-001');
  });
});
