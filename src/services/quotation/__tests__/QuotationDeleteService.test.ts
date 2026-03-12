import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuotationDeleteService } from '../QuotationDeleteService';

describe('QuotationDeleteService', () => {
  type RpcClient = ConstructorParameters<typeof QuotationDeleteService>[0];
  let service: QuotationDeleteService;
  let mockRpc: RpcClient['rpc'];
  let mockRpcFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRpcFn = vi.fn();
    mockRpc = mockRpcFn as unknown as RpcClient['rpc'];
    service = new QuotationDeleteService({
      rpc: mockRpc,
    });
  });

  it('calls delete_quotes_cascade_detailed RPC with normalized IDs', async () => {
    const report = {
      ok: true,
      message: 'Quotes processed successfully',
      atomic_rolled_back: false,
      summary: {
        requested: 2,
        processed: 2,
        hard_deleted: 1,
        soft_deleted: 1,
        failed: 0,
        inventory_released: 3,
        approvals_cancelled: 1,
        cache_cleaned: true,
      },
      results: [],
      stats: [],
    };

    mockRpcFn.mockResolvedValue({ data: report, error: null });

    const result = await service.deleteQuotes(
      ['q-1', 'q-2', 'q-1'],
      'cleanup',
      { forceHardDelete: false, atomic: true },
    );

    expect(mockRpcFn).toHaveBeenCalledWith('delete_quotes_cascade_detailed', {
      p_quote_ids: ['q-1', 'q-2'],
      p_reason: 'cleanup',
      p_force_hard_delete: false,
      p_atomic: true,
    });
    expect(result).toEqual(report);
  });

  it('returns empty successful report when no IDs are provided', async () => {
    const result = await service.deleteQuotes([]);

    expect(mockRpcFn).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.summary.requested).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it('throws when RPC returns database error', async () => {
    const dbError = new Error('permission denied');
    mockRpcFn.mockResolvedValue({ data: null, error: dbError });

    await expect(service.deleteQuotes(['q-1'])).rejects.toThrow('permission denied');
  });

  it('throws when RPC returns empty response', async () => {
    mockRpcFn.mockResolvedValue({ data: null, error: null });

    await expect(service.deleteQuotes(['q-1'])).rejects.toThrow('empty response');
  });

  it('handles large bulk input by de-duplicating and sending one RPC request', async () => {
    const ids = Array.from({ length: 10_000 }, (_, index) => `q-${index}`);
    const report = {
      ok: true,
      message: 'Quotes processed successfully',
      atomic_rolled_back: false,
      summary: {
        requested: 10_000,
        processed: 10_000,
        hard_deleted: 8_000,
        soft_deleted: 2_000,
        failed: 0,
        inventory_released: 10_000,
        approvals_cancelled: 0,
        cache_cleaned: true,
      },
      results: [],
      stats: [],
    };
    mockRpcFn.mockResolvedValue({ data: report, error: null });

    const result = await service.deleteQuotes([...ids, ...ids], 'load test', {
      forceHardDelete: false,
      atomic: true,
    });

    expect(mockRpcFn).toHaveBeenCalledTimes(1);
    const callPayload = mockRpcFn.mock.calls[0][1];
    expect(Array.isArray(callPayload.p_quote_ids)).toBe(true);
    expect(callPayload.p_quote_ids).toHaveLength(10_000);
    expect(result.summary.processed).toBe(10_000);
  });

  it('returns rollback report unchanged for atomic partial failures', async () => {
    const rollbackReport = {
      ok: false,
      message: 'Deletion aborted due to pre-validation failures',
      atomic_rolled_back: true,
      summary: {
        requested: 2,
        processed: 0,
        hard_deleted: 0,
        soft_deleted: 0,
        failed: 1,
        inventory_released: 0,
        approvals_cancelled: 0,
        cache_cleaned: false,
      },
      results: [
        {
          quote_id: 'q-1',
          success: false,
          action: 'none',
          error: 'Quote is outside user tenant scope',
        },
      ],
      stats: [],
    };
    mockRpcFn.mockResolvedValue({ data: rollbackReport, error: null });

    const result = await service.deleteQuotes(['q-1', 'q-2'], 'atomic rollback', {
      atomic: true,
      forceHardDelete: false,
    });

    expect(result.ok).toBe(false);
    expect(result.atomic_rolled_back).toBe(true);
    expect(result.summary.processed).toBe(0);
    expect(result.summary.failed).toBe(1);
  });

  it('falls back to legacy RPC when detailed RPC is missing from schema cache', async () => {
    mockRpcFn
      .mockResolvedValueOnce({
        data: null,
        error: {
          message:
            'Could not find the function public.delete_quotes_cascade_detailed(p_atomic, p_force_hard_delete, p_quote_ids, p_reason) in the schema cache',
          code: 'PGRST202',
        },
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const result = await service.deleteQuotes(['q-1', 'q-2'], 'fallback test', {
      atomic: true,
      forceHardDelete: false,
    });

    expect(mockRpcFn).toHaveBeenNthCalledWith(1, 'delete_quotes_cascade_detailed', {
      p_quote_ids: ['q-1', 'q-2'],
      p_reason: 'fallback test',
      p_force_hard_delete: false,
      p_atomic: true,
    });
    expect(mockRpcFn).toHaveBeenNthCalledWith(2, 'delete_quotes_cascade', {
      quote_ids: ['q-1', 'q-2'],
    });
    expect(result.ok).toBe(true);
    expect(result.summary.hard_deleted).toBe(2);
    expect(result.summary.failed).toBe(0);
  });

  it('throws when fallback legacy RPC fails', async () => {
    const missingDetailedRpcError = {
      message:
        'Could not find the function public.delete_quotes_cascade_detailed(p_atomic, p_force_hard_delete, p_quote_ids, p_reason) in the schema cache',
      code: 'PGRST202',
    };
    const legacyError = new Error('legacy cascade failed');

    mockRpcFn
      .mockResolvedValueOnce({ data: null, error: missingDetailedRpcError })
      .mockResolvedValueOnce({ data: null, error: legacyError });

    await expect(service.deleteQuotes(['q-1'])).rejects.toThrow('legacy cascade failed');
  });
});
