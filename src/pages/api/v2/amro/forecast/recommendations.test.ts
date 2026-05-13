import { describe, expect, it, vi } from 'vitest';
import handler from './recommendations';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import forecastReliabilityHandler from '../forecast-reliability';

vi.mock('../forecast-reliability', () => ({
  default: vi.fn(),
}));

describe('/api/v2/amro/forecast/recommendations', () => {
  it('forwards GET request as forecast recommendation generation interface', async () => {
    vi.mocked(forecastReliabilityHandler).mockResolvedValue(undefined as never);
    const req: ApiRequest = {
      method: 'GET',
      query: { work_order_id: 'wp-1', planning_horizon_days: '14', scenario: 'base' },
      headers: {},
      body: {},
    };
    const res = {} as ApiResponse;

    await handler(req, res);

    expect(forecastReliabilityHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        query: expect.objectContaining({ interface: 'generate-intervention-recommendations' }),
        body: expect.objectContaining({
          work_order_id: 'wp-1',
          planning_horizon_days: 14,
          scenario: 'base',
        }),
      }),
      res
    );
  });
});
