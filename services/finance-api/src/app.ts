// Phase 5 finance-api — Express app.
// Mounts the lifted invoices.routes.ts + tax.routes.ts under /api with
// the same auth middleware shape as crm-api so callers don't observe a
// behavioural difference. The vite proxy directs /api/v1/invoices and
// /api/v1/tax to this service (more-specific prefix wins over the
// /api/v1 → amro-api catch-all).

import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware, getAuthHeaderMonitoringSnapshot } from './middleware/auth.middleware.js';
import invoicesRoutes from './routes/invoices.routes.js';
import taxRoutes from './routes/tax.routes.js';
import { ErrorResponse } from './types/finance.types.js';
import { logger } from './utils/logger.js';

const app: Express = express();
type RequestWithCorrelation = Request & { correlationId?: string };
type RequestWithScope = RequestWithCorrelation & { userId?: string; tenantId?: string; franchiseId?: string | null };

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
    service: 'finance-api',
    timestamp: new Date().toISOString(),
    authHeaderMonitoring: getAuthHeaderMonitoringSnapshot(),
  });
});

app.get('/finance/v1/_status', (_req: Request, res: Response) => {
  res.json({
    service: 'finance-api',
    schema: 'finance',
    tables: [
      'finance.invoices',
      'finance.invoice_lines',
      'finance.payments',
      'finance.subscriptions',
      'finance.subscription_plans',
      'finance.subscription_invoices',
      'finance.subscription_features',
      'finance.gl_accounts',
      'finance.journal_entries',
      'finance.tax_codes',
      'finance.tax_jurisdictions',
      'finance.tax_rules',
      'finance.tenant_nexus',
    ],
    routes: [
      'POST /api/v1/invoices/:id/finalize (lifted from crm-api 2026-05-29)',
      'POST /api/v1/tax/calculate         (lifted from crm-api 2026-05-29)',
      'POST /api/v1/tax/exemptions/certificates (lifted from crm-api 2026-05-29)',
    ],
  });
});

function auditApiRequest(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();
  const request = req as RequestWithScope;
  res.on('finish', () => {
    try {
      const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
      const supabaseServiceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();
      if (!supabaseUrl || !supabaseServiceKey) return;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const payload: Record<string, unknown> = {
        user_id: request.userId || null,
        tenant_id: request.tenantId || null,
        franchise_id: request.franchiseId || null,
        action: 'API_REQUEST',
        resource_type: 'finance-api',
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

app.use('/api', authMiddleware, auditApiRequest, invoicesRoutes, taxRoutes);

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
