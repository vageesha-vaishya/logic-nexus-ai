import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import certificationHandler from '../certification';

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') {
    return body as Record<string, unknown>;
  }
  return {};
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const forwardedReq = {
    ...req,
    method: 'POST',
    query: {
      ...req.query,
      interface: 'submit-certification-decision',
    },
    body: parseBody(req.body),
  } as ApiRequest;
  return certificationHandler(forwardedReq, res);
}
