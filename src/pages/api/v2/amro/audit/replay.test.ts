import { describe, expect, it, vi } from 'vitest';
import handler from './replay';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import auditLedgerReplayHandler from '../audit-ledger-replay';

vi.mock('../audit-ledger-replay', () => ({
  default: vi.fn(),
}));

describe('/api/v2/amro/audit/replay', () => {
  it('forwards request to audit-ledger replay handler as GET', async () => {
    vi.mocked(auditLedgerReplayHandler).mockResolvedValue(undefined as never);
    const req: ApiRequest = {
      method: 'GET',
      query: { capability: 'work-packages', limit: '50' },
      headers: {},
      body: {},
    };
    const res = {} as ApiResponse;

    await handler(req, res);

    expect(auditLedgerReplayHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({ capability: 'work-packages', limit: '50' }),
      }),
      res
    );
  });
});
