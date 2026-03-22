import { describe, expect, it, vi } from 'vitest';
import handler from './evaluate';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import complianceGatesHandler from '../../compliance-gates';

vi.mock('../../compliance-gates', () => ({
  default: vi.fn(),
}));

describe('/api/v2/amro/compliance/gates/evaluate', () => {
  it('forwards request with evaluate-compliance-gate interface', async () => {
    vi.mocked(complianceGatesHandler).mockResolvedValue(undefined as never);
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      body: {
        context: { type: 'work_package', id: 'wp-1' },
        regulator_profile: 'FAA',
        required_obligations: [{ id: 'obl-1' }],
      },
      headers: {},
    };
    const res = {} as ApiResponse;

    await handler(req, res);

    expect(complianceGatesHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        query: expect.objectContaining({ interface: 'evaluate-compliance-gate' }),
      }),
      res
    );
  });
});
