import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import masterDataEntityIdHandler from '../master-data/[entity]/[id]';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  req.query = {
    ...req.query,
    entity: 'work_package_templates',
    id: req.query.id,
  };
  return masterDataEntityIdHandler(req, res);
}
