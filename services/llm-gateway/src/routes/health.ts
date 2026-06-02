import type { Request, Response } from 'express';
import { Router } from 'express';
import { availableProviders } from '../providers/index.js';

export const healthRouter = Router();

healthRouter.get('/healthz', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'llm-gateway',
    phase: 'P0',
    providers_available: availableProviders(),
  });
});

healthRouter.get('/readyz', (_req: Request, res: Response) => {
  // P0: no external deps, so ready === live.
  res.json({ status: 'ready' });
});
