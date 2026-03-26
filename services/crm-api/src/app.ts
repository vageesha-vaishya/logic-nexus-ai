import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { authMiddleware, getAuthHeaderMonitoringSnapshot } from './middleware/auth.middleware';
import leadsRoutes from './routes/leads.routes';
import invoicesRoutes from './routes/invoices.routes';
import taxRoutes from './routes/tax.routes';
import { ErrorResponse } from './types/crm.types';
import { logger } from './utils/logger';

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
      'X-Correlation-Id'
    ],
    exposedHeaders: ['x-correlation-id', 'x-request-id', 'x-api-version', 'x-compat-mode']
  })
);

app.use((req: Request, _res: Response, next: NextFunction) => {
  const request = req as RequestWithCorrelation;
  const correlationIdHeader = req.header('x-correlation-id')?.trim();
  request.correlationId = correlationIdHeader || randomUUID();
  _res.setHeader('x-correlation-id', request.correlationId);
  logger.info(`${req.method} ${req.path}`, {
    correlationId: request.correlationId,
    authorizationHeaderPresent: Boolean(String(req.headers.authorization || '').trim()),
    authorizationScheme: String(req.headers.authorization || '').trim().split(/\s+/)[0]?.toLowerCase() || null,
  });
  next();
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'crm-api',
    timestamp: new Date().toISOString(),
    authHeaderMonitoring: getAuthHeaderMonitoringSnapshot(),
  });
});

app.use('/api', authMiddleware, leadsRoutes, invoicesRoutes, taxRoutes);

app.use((_req: Request, res: Response) => {
  const req = _req as RequestWithCorrelation;
  res.status(404).json({
    error: 'Route not found',
    code: 'NOT_FOUND',
    statusCode: 404,
    requestId: req.correlationId || null
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
    requestId: (req as RequestWithCorrelation).correlationId || null
  };
  res.status(statusCode).json(response);
});

export default app;
