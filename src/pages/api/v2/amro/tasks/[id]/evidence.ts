import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import { sanitizeQueryId } from '../../../../_utils/http';
import tasksHandler from '../../tasks';

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') {
    return body as Record<string, unknown>;
  }
  return {};
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const taskId = sanitizeQueryId(req.query.id, 'id');
  if (!taskId) {
    return res.status(400).json({
      error: 'id is required',
      version: 'v2',
    });
  }
  const forwardedBody = {
    ...parseBody(req.body),
    task_id: taskId,
  };
  const forwardedQuery = {
    ...req.query,
    interface: 'upload-evidence',
  };
  const forwardedReq = {
    ...req,
    query: forwardedQuery,
    body: forwardedBody,
  } as ApiRequest;
  return tasksHandler(forwardedReq, res);
}
