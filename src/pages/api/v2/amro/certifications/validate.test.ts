import { describe, expect, it, vi } from 'vitest';
import handler from './validate';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import certificationHandler from '../certification';

vi.mock('../certification', () => ({
  default: vi.fn(),
}));

describe('/api/v2/amro/certifications/validate', () => {
  it('forwards request with validate-certifying-authority interface', async () => {
    vi.mocked(certificationHandler).mockResolvedValue(undefined as never);
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      body: { actor_id: 'actor-1', aircraft_scope: ['A320'], maintenance_scope: ['line'], timestamp: '2026-03-22T00:00:00Z' },
      headers: {},
    };
    const res = {} as ApiResponse;

    await handler(req, res);

    expect(certificationHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        query: expect.objectContaining({ interface: 'validate-certifying-authority' }),
      }),
      res
    );
  });
});
