import type { ApiRequest, ApiResponse } from '@/pages/api/_utils/types';
import { serveAmroContractArtifact } from '../contract-artifact-handler';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return serveAmroContractArtifact(req, res, {
    fileName: 'amro-v1.proto',
    contentType: 'application/protobuf; charset=utf-8',
  });
}
