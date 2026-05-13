import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import masterDataEntityIdHandler from '../master-data/[entity]/[id]';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'PUT') {
    req.method = 'PATCH';
  }
  req.query = {
    ...req.query,
    entity: 'work_order_templates',
    id: req.query.id,
  };
  return masterDataEntityIdHandler(req, res);
}
