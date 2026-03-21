import type { ApiRequest, ApiResponse } from '@/pages/api/_utils/types';
import { serveAmroContractArtifact } from '../contract-artifact-handler';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return serveAmroContractArtifact(req, res, {
    fileName: 'openapi-3.1.yaml',
    contentType: 'application/yaml; charset=utf-8',
  });
}
