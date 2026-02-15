import { describe, it, expect, vi } from 'vitest';
import { getLatestVersionIdWithRetry } from '../QuoteNew';

function makeScopedDbMock(sequence: Array<{ data?: any; error?: any }>) {
  let call = 0;
  const single = vi.fn().mockImplementation(() => {
    const res = sequence[Math.min(call, sequence.length - 1)];
    call++;
    return Promise.resolve(res);
  });
  const limit = vi.fn().mockReturnValue({ single });
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from, select, eq, order, limit, single };
}

describe('QuoteNew version initialization retry', () => {
  it('uses bypass mode and retries until success', async () => {
    const mock = makeScopedDbMock([
      { error: { message: 'RLS denied' } },
      { data: { id: 'ver-1' }, error: null }
    ]) as any;

    const id = await getLatestVersionIdWithRetry(mock, 'quote-123', 3);
    expect(id).toBe('ver-1');
    expect(mock.from).toHaveBeenCalledWith('quotation_versions', true);
  });

  it('returns null after exhausting retries', async () => {
    const mock = makeScopedDbMock([
      { error: { message: 'Network' } },
      { error: { message: 'RLS denied' } },
      { error: { message: 'Timeout' } }
    ]) as any;

    const id = await getLatestVersionIdWithRetry(mock, 'quote-123', 3);
    expect(id).toBeNull();
  });
});
