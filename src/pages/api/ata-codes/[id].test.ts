import { describe, expect, it, vi } from 'vitest';
import handler from './[id]';
import masterDataEntityByIdHandler from '../v2/amro/master-data/[entity]/[id]';
import type { ApiRequest, ApiResponse } from '../_utils/types';

vi.mock('../v2/amro/master-data/[entity]/[id]', () => ({
  default: vi.fn(async () => undefined),
}));

describe('/api/ata-codes/[id]', () => {
  it('delegates to AMRO master-data id handler and normalizes PUT to PATCH', async () => {
    const req = {
      method: 'PUT',
      query: {
        id: 'ata-1',
      },
      headers: {},
    } as unknown as ApiRequest;
    const res = {} as ApiResponse;

    await handler(req, res);

    expect(masterDataEntityByIdHandler).toHaveBeenCalledTimes(1);
    const delegatedReq = vi.mocked(masterDataEntityByIdHandler).mock.calls[0]?.[0] as ApiRequest;
    expect(String(delegatedReq.query.entity || '')).toBe('ata_codes');
    expect(String(delegatedReq.query.id || '')).toBe('ata-1');
    expect(String(delegatedReq.method || '')).toBe('PATCH');
  });
});
