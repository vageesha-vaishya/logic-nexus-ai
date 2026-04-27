import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import forecastReliabilityHandler from '../forecast-reliability';

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') {
    return body as Record<string, unknown>;
  }
  return {};
}

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const baseBody = parseBody(req.body);
  const fromQuery = {
    work_order_id: firstQueryValue(req.query.work_order_id),
    planning_horizon_days: firstQueryValue(req.query.planning_horizon_days),
    scenario: firstQueryValue(req.query.scenario),
  };
  const normalizedBody = {
    ...baseBody,
    work_order_id: baseBody.work_order_id || fromQuery.work_order_id || 'wp-default',
    planning_horizon_days: Number(baseBody.planning_horizon_days || fromQuery.planning_horizon_days || 30),
    scenario: baseBody.scenario || fromQuery.scenario || 'base',
  };
  const forwardedReq = {
    ...req,
    method: 'POST',
    query: {
      ...req.query,
      interface: 'generate-intervention-recommendations',
    },
    body: normalizedBody,
  } as ApiRequest;
  return forecastReliabilityHandler(forwardedReq, res);
}
