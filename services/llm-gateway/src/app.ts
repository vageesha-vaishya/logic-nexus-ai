import express, { type Express } from 'express';
import cors from 'cors';

import { correlationMiddleware } from './middleware/correlation.js';
import { errorMiddleware } from './middleware/error.js';
import { healthRouter } from './routes/health.js';
import { invokeRouter, getAuthLookupForApp } from './routes/invoke.js';
import { mountPromptRoutes } from './routes/prompts.js';
import { mountOutcomeRoutes } from './routes/outcomes.js';
import { mountExperimentRoutes } from './routes/experiments.js';
import { mountEmbedRoutes } from './routes/embed.js';
import { mountRtbfRoutes } from './routes/rtbf.js';
import { mountFineTuneRoutes } from './routes/finetune.js';

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
        'traceparent',
        'tracestate',
      ],
      exposedHeaders: ['x-correlation-id', 'x-request-id', 'x-trace-id'],
    }),
  );

  app.use(correlationMiddleware);

  // P0 health surface (no /v1 prefix — k8s/coolify probes hit root)
  app.use('/', healthRouter);

  // Versioned API surface
  app.use('/v1', invokeRouter);
  app.use('/v1', mountPromptRoutes(getAuthLookupForApp));
  app.use('/v1', mountOutcomeRoutes(getAuthLookupForApp));
  app.use('/v1', mountExperimentRoutes(getAuthLookupForApp));
  app.use('/v1', mountEmbedRoutes(getAuthLookupForApp));
  app.use('/v1', mountRtbfRoutes(getAuthLookupForApp));
  app.use('/v1', mountFineTuneRoutes(getAuthLookupForApp));

  app.use(errorMiddleware);

  return app;
}

export default createApp();
