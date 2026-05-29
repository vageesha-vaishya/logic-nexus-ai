// Phase 5 logistics-api — Express app. The vite proxy routes
// /api/logistics → logistics-api (port 3401 default).

import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware, getAuthHeaderMonitoringSnapshot } from './middleware/auth.middleware.js';
import shipmentsRoutes from './routes/shipments.routes.js';
import { ErrorResponse } from './types/logistics.types.js';
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
      'Content-Type', 'Authorization', 'Idempotency-Key',
      'X-Tenant-Id', 'X-Franchise-Id', 'X-User-Id', 'X-Correlation-Id',
    ],
    exposedHeaders: ['x-correlation-id', 'x-request-id', 'x-api-version'],
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
    service: 'logistics-api',
    timestamp: new Date().toISOString(),
    authHeaderMonitoring: getAuthHeaderMonitoringSnapshot(),
  });
});

app.get('/logistics/v1/_status', (_req: Request, res: Response) => {
  res.json({
    service: 'logistics-api',
    schema: 'logistics',
    tables: [
      'logistics.shipments', 'logistics.shipment_items', 'logistics.shipment_cargo_configurations',
      'logistics.shipment_attachments', 'logistics.shipment_containers', 'logistics.shipment_delays',
      'logistics.bookings', 'logistics.booking_agents', 'logistics.booking_executions',
      'logistics.carriers', 'logistics.carrier_rates', 'logistics.carrier_alliances',
      'logistics.carrier_rate_attachments', 'logistics.carrier_rate_charges', 'logistics.carrier_service_types',
      'logistics.vendors', 'logistics.container_sizes', 'logistics.container_types',
      'logistics.routes', 'logistics.warehouses', 'logistics.vehicles',
      'logistics.customs_documents', 'logistics.tracking_events',
      'logistics.quote_items_extension',
    ],
    routes: [
      'GET    /api/logistics/v1/shipments',
      'GET    /api/logistics/v1/shipments/:id',
      'POST   /api/logistics/v1/shipments',
      'PATCH  /api/logistics/v1/shipments/:id',
      'DELETE /api/logistics/v1/shipments/:id',
    ],
    notes: 'Bookings / carriers / vendors / tracking routes pending. Cross-module logistics.shipment.delivered emission still happens via core.emit_shipment_delivered() DB trigger (Phase 5 commit 5276a577).',
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
        resource_type: 'logistics-api',
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

app.use('/api', authMiddleware, auditApiRequest, shipmentsRoutes);

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
