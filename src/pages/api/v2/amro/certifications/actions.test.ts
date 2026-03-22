import { describe, expect, it, vi } from 'vitest';
import handler from './actions';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import certificationHandler from '../certification';

vi.mock('../certification', () => ({
  default: vi.fn(),
}));

describe('/api/v2/amro/certifications/actions', () => {
  it('forwards request with submit-certification-decision interface', async () => {
    vi.mocked(certificationHandler).mockResolvedValue(undefined as never);
    const req: ApiRequest = {
      method: 'POST',
      query: {},
      body: { work_package_id: 'wp-1', decision: 'approve', signatures: [{ signer: 'qa' }] },
      headers: {},
    };
    const res = {} as ApiResponse;

    await handler(req, res);

    expect(certificationHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        query: expect.objectContaining({ interface: 'submit-certification-decision' }),
      }),
      res
    );
  });
});
