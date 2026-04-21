import { describe, expect, it, vi } from 'vitest';
import handler from './index';
import masterDataEntityHandler from '../v2/amro/master-data/[entity]';
import type { ApiRequest, ApiResponse } from '../_utils/types';

vi.mock('../v2/amro/master-data/[entity]', () => ({
  default: vi.fn(async () => undefined),
}));

describe('/api/ata-codes', () => {
  it('delegates to AMRO master-data handler with ata_codes entity', async () => {
    const req = {
      method: 'GET',
      query: {
        page: '1',
        page_size: '25',
      },
      headers: {},
    } as unknown as ApiRequest;
    const res = {} as ApiResponse;

    await handler(req, res);

    expect(masterDataEntityHandler).toHaveBeenCalledTimes(1);
    const delegatedReq = vi.mocked(masterDataEntityHandler).mock.calls[0]?.[0] as ApiRequest;
    expect(String(delegatedReq.query.entity || '')).toBe('ata_codes');
    expect(String(delegatedReq.query.page || '')).toBe('1');
  });
});
