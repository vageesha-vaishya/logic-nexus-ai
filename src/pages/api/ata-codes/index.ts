import type { ApiRequest, ApiResponse } from '../_utils/types';
import masterDataEntityHandler from '../v2/amro/master-data/[entity]';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const delegatedRequest = {
    ...req,
    query: {
      ...req.query,
      entity: 'ata_codes',
    },
  } as ApiRequest;
  await masterDataEntityHandler(delegatedRequest, res);
}
