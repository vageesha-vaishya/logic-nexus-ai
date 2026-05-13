import type { ApiRequest, ApiResponse } from '../../_utils/types';
import masterDataEntityHandler from './master-data/[entity]';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  req.query = {
    ...req.query,
    entity: 'work_order_templates',
  };
  return masterDataEntityHandler(req, res);
}
