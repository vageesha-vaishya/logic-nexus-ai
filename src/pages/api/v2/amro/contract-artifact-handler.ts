import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ApiRequest, ApiResponse } from '../../_utils/types';
import { applyCors, buildApiContext, enforceHttps, enforceRateLimit, handlePreflight } from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';

type ContractArtifactConfig = {
  fileName: string;
  contentType: string;
};

export async function serveAmroContractArtifact(req: ApiRequest, res: ApiResponse, config: ContractArtifactConfig) {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);

  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId, version: 'v2' });
    }

    enforceHttps(req);
    enforceRateLimit(req);

    const filePath = path.join(process.cwd(), 'src/pages/api/v2/amro/contracts', config.fileName);
    const content = readFileSync(filePath, 'utf8');
    const response = res.status(200);
    res.setHeader('Content-Type', config.contentType);
    res.setHeader('Cache-Control', 'public, max-age=300');
    response.end(content);
    return;
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
