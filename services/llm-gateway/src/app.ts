import express, { type Express } from 'express';
import cors from 'cors';

import { correlationMiddleware } from './middleware/correlation.js';
import { errorMiddleware } from './middleware/error.js';
import { healthRouter } from './routes/health.js';
import { invokeRouter, getAuthLookupForApp } from './routes/invoke.js';
import { mountPromptRoutes } from './routes/prompts.js';

export function createApp(): Express {
  const app: Express = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(
    cors({
      origin: process.env.LLM_GATEWAY_CORS_ORIGIN || '*',
      credentials: false,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Platform-Id',
        'X-Tenant-Id',
        'X-Correlation-Id',
        'Idempotency-Key',
      ],
      exposedHeaders: ['x-correlation-id', 'x-request-id'],
    }),
  );

  app.use(correlationMiddleware);

  // P0 health surface (no /v1 prefix — k8s/coolify probes hit root)
  app.use('/', healthRouter);

  // Versioned API surface
  app.use('/v1', invokeRouter);
  app.use('/v1', mountPromptRoutes(getAuthLookupForApp));

  app.use(errorMiddleware);

  return app;
}

export default createApp();
