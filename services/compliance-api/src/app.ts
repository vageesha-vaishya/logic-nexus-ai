// Phase 6 compliance-api — Express app.
//
// Mirrors finance-api shape: cors + correlation-id + /health + /api auth +
// audit hook. Routes (read-only screening + records lookup) mount under
// /api/v1/compliance/*; the vite proxy directs /api/compliance/* + the
// /api/v1/compliance/* prefix to this service.

import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

import { authMiddleware, getAuthHeaderMonitoringSnapshot } from './middleware/auth.middleware.js';
import screeningsRoutes from './routes/screenings.routes.js';
import type { ErrorResponse } from './types/compliance.types.js';
import { logger } from './utils/logger.js';

const app: Express = express();
type RequestWithCorrelation = Request & { correlationId?: string };
type RequestWithScope = RequestWithCorrelation & {
  userId?: string;
  tenantId?: string;
  franchiseId?: string | null;
};

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
    service: 'compliance-api',
    timestamp: new Date().toISOString(),
    authHeaderMonitoring: getAuthHeaderMonitoringSnapshot(),
  });
});

app.get('/compliance/v1/_status', (_req: Request, res: Response) => {
  res.json({
    service: 'compliance-api',
    schema: 'compliance',
    tables: [
      'compliance.records',
      'compliance.obligations',
      'compliance.screenings',
      'compliance.rules',
      'compliance.legal_holds',
      'compliance.retention_policies',
      'compliance.domain_verifications',
      'compliance.restricted_party_lists',
    ],
    routes: [
      'GET /api/v1/compliance/screenings',
      'GET /api/v1/compliance/records/:subject_type/:subject_id',
    ],
    consumers: [
      'gating-consumer (polls core.v_cross_module_pending_events for sales.lead.created, quotation.quote.send_requested, logistics.booking.created, finance.payment.created)',
    ],
  });
});

function auditApiRequest(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();
  const request = req as RequestWithScope;
  res.on('finish', () => {
    try {
      const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
      const supabaseServiceKey = String(
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '',
      ).trim();
      if (!supabaseUrl || !supabaseServiceKey) return;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const payload: Record<string, unknown> = {
        user_id: request.userId || null,
        tenant_id: request.tenantId || null,
        franchise_id: request.franchiseId || null,
        action: 'API_REQUEST',
        resource_type: 'compliance-api',
        details: {
          correlationId: request.correlationId || null,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          latencyMs: Date.now() - startedAt,
        },
        ip_address: req.ip,
      };
      void Promise.resolve(supabase.from('audit_logs').insert(payload) as any).catch(() => undefined);
    } catch {
      return;
    }
  });
  next();
}

app.use('/api', authMiddleware, auditApiRequest, screeningsRoutes);

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
