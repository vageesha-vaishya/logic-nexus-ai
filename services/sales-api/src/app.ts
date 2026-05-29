// Phase 4 Sales Step 4 — sales-api Express app.
// Mounts the lifted leads.routes.ts under /api with the same auth middleware
// shape as crm-api so callers don't observe a behavioural difference. The
// vite proxy routes /api/crm/v1/leads to this service (more-specific prefix
// wins over /api/crm → crm-api).

import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { authMiddleware, getAuthHeaderMonitoringSnapshot } from './middleware/auth.middleware.js';
import leadsRoutes from './routes/leads.routes.js';
import { ErrorResponse } from './types/sales.types.js';
import { logger } from './utils/logger.js';

const app: Express = express();
type RequestWithCorrelation = Request & { correlationId?: string };

app.use(express.json());

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Tenant-Id',
      'X-Franchise-Id',
      'X-User-Id',
      'X-Correlation-Id',
    ],
    exposedHeaders: ['x-correlation-id', 'x-request-id', 'x-api-version', 'x-compat-mode'],
  }),
);

app.use((req: Request, res: Response, next: NextFunction) => {
  const request = req as RequestWithCorrelation;
  const correlationIdHeader = req.header('x-correlation-id')?.trim();
  request.correlationId = correlationIdHeader || randomUUID();
  res.setHeader('x-correlation-id', request.correlationId);
  logger.info(`${req.method} ${req.path}`, {
    correlationId: request.correlationId,
    authorizationHeaderPresent: Boolean(String(req.headers.authorization || '').trim()),
  });
  next();
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'sales-api',
    timestamp: new Date().toISOString(),
    authHeaderMonitoring: getAuthHeaderMonitoringSnapshot(),
  });
});

app.get('/sales/v1/_status', (_req: Request, res: Response) => {
  res.json({
    service: 'sales-api',
    schema: 'sales',
    tables: [
      'sales.leads',
      'sales.opportunities',
      'sales.pipelines',
      'sales.pipeline_stages',
      'sales.forecasts',
      'sales.forecast_lines',
      'sales.scoring_configs',
      'sales.scoring_rules',
      'sales.scoring_logs',
    ],
    routes: ['/api/crm/v1/leads (lifted from crm-api 2026-05-29)'],
  });
});

app.use('/api', authMiddleware, leadsRoutes);

app.use((_req: Request, res: Response) => {
  const req = _req as RequestWithCorrelation;
  res.status(404).json({
    error: 'Route not found',
    code: 'NOT_FOUND',
    statusCode: 404,
    requestId: req.correlationId || null,
  } as ErrorResponse);
});

app.use((error: Error & { statusCode?: number; code?: string }, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_SERVER_ERROR';
  const response: ErrorResponse = {
    error: error.message || 'Internal server error',
    code,
    statusCode,
    path: req.path,
    requestId: (req as RequestWithCorrelation).correlationId || null,
  };
  res.status(statusCode).json(response);
});

export default app;
