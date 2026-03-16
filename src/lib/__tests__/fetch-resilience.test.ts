import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  classifyFetchFailure,
  describeFetchFailure,
  runWithRetry,
} from '@/lib/fetch-resilience';

describe('fetch-resilience', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('classifies network and auth failures', () => {
    const network = classifyFetchFailure(new Error('Failed to fetch'));
    const auth = classifyFetchFailure({ status: 401, message: 'JWT expired' });
    expect(network.kind).toBe('network');
    expect(auth.kind).toBe('auth');
    expect(describeFetchFailure(auth)).toContain('Authentication expired');
  });

  it('retries transient failures and resolves on success', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true });
    const onRetry = vi.fn();

    const promise = runWithRetry(operation, { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 1000 }, onRetry);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(operation).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('does not retry client failures', async () => {
    const operation = vi.fn().mockRejectedValue({ status: 400, message: 'Bad request' });
    await expect(runWithRetry(operation, { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 1000 })).rejects.toMatchObject({ status: 400 });
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
