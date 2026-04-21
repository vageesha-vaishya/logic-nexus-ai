import type { ApiRequest, ApiResponse } from '../_utils/types';
import masterDataEntityByIdHandler from '../v2/amro/master-data/[entity]/[id]';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const normalizedMethod = String(req.method || 'GET').toUpperCase() === 'PUT' ? 'PATCH' : req.method;
  const delegatedRequest = {
    ...req,
    method: normalizedMethod,
    query: {
      ...req.query,
      entity: 'ata_codes',
      id: req.query.id,
    },
  } as ApiRequest;
  await masterDataEntityByIdHandler(delegatedRequest, res);
}
