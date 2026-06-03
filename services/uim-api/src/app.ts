// Phase 7 UIM Step 3 — uim-api Express app.
//
// Replaces the legacy raw-Node-HTTP dev mock with the Express
// conformance shape shared by finance-api / sales-api / comms-api /
// compliance-api: cors + correlation-id + /health + /api auth + audit
// hook. Routes mount under /api/v1/uim/*.
//
// Today's read routes source from uim.* (the canonical schema, Step 1
// mirror live since 2026-06-03 commit 8c0f701c). Once Step 4 carves
// the write paths out of src/pages/api/v2/uim/*, they land here too.

import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

import { authMiddleware, getAuthHeaderMonitoringSnapshot } from './middleware/auth.middleware.js';
import integrationsRoutes from './routes/integrations.routes.js';
import dlqRoutes from './routes/dlq.routes.js';
import outboxRoutes from './routes/outbox.routes.js';
import inventoryItemsRoutes from './routes/inventory-items.routes.js';
import connectorManifestsRoutes from './routes/connector-manifests.routes.js';
import projectionsRoutes from './routes/projections.routes.js';
import contractsRoutes from './routes/contracts.routes.js';
import webhooksRoutes from './routes/webhooks.routes.js';
import seedingRoutes from './routes/seeding.routes.js';
import reservationsRoutes from './routes/reservations.routes.js';
import commandsRoutes from './routes/commands.routes.js';
import formsRoutes from './routes/forms.routes.js';
import graphqlRoutes from './routes/graphql.routes.js';
import inboundRoutes from './routes/inbound.routes.js';
import integrationsRestRoutes from './routes/integrations-rest.routes.js';
import externalMroPipelineRoutes from './routes/external-mro-pipeline.routes.js';
import analyticsKpisRoutes from './routes/analytics-kpis.routes.js';
import analyticsEtlRoutes from './routes/analytics-etl.routes.js';
import analyticsTailRoutes from './routes/analytics-tail.routes.js';
import type { ErrorResponse } from './types/uim.types.js';
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
    service: 'uim-api',
    timestamp: new Date().toISOString(),
    authHeaderMonitoring: getAuthHeaderMonitoringSnapshot(),
  });
});

app.get('/uim/v1/_status', (_req: Request, res: Response) => {
  res.json({
    service: 'uim-api',
    schema: 'uim',
    tables: [
      // Phase 7 Step 1 mirror tables (commit 8c0f701c)
      'uim.integrations',
      'uim.integration_credentials',
      'uim.integration_log',
      'uim.integration_dlq',
      'uim.webhook_subscriptions',
      // Pre-existing inventory + stock subsystem
      'uim.item_master',
      'uim.item_uom_conversions',
      'uim.item_cross_references',
      'uim.part_interchangeability',
      'uim.stock_ledger_transactions',
      'uim.stock_valuation_layers',
      'uim.stock_valuation_consumptions',
      'uim.stock_period_closes',
      'uim.stock_reconciliation_runs',
      'uim.stock_reconciliation_items',
      'uim.stock_audit_timeline',
      'uim.stock_approval_queue',
      'uim.inventory_reorder_queue',
      'uim.inventory_scan_events',
    ],
    routes: [
      'GET    /api/v1/uim/integrations',
      'GET    /api/v1/uim/integrations/:id',
      'POST   /api/v1/uim/integrations',
      'PATCH  /api/v1/uim/integrations/:id',
      'DELETE /api/v1/uim/integrations/:id',
      'POST   /api/v1/uim/dlq/process  (platform_admin)',
      'POST   /api/v1/uim/outbox/dispatch  (platform_admin)',
      'GET    /api/v1/uim/inventory-items',
      'GET    /api/v1/uim/inventory-items/:id',
      'GET    /api/v1/uim/connectors/manifests',
      'GET    /api/v1/uim/projections/items',
      'GET    /api/v1/uim/integration-contracts',
      'GET    /api/v1/uim/webhooks',
      'POST   /api/v1/uim/webhooks  (action=register|deactivate|set-status|dispatch-event)',
      'GET    /api/v1/uim/seeding/mro',
      'POST   /api/v1/uim/seeding/mro  (platform_admin)',
      'POST   /api/v1/uim/reservations/soft',
      'POST   /api/v1/uim/commands  (command_type=RECEIVE|MOVE|RESERVE|CONSUME, idempotency_key?)',
      'GET    /api/v1/uim/forms/:node',
      'POST   /api/v1/uim/forms/:node',
      'GET    /api/v1/uim/forms/:node/:id',
      'PATCH  /api/v1/uim/forms/:node/:id',
      'DELETE /api/v1/uim/forms/:node/:id',
      'POST   /api/v1/uim/graphql  (yoga + Pothos schema)',
      'GET    /api/v1/uim/graphql  (introspection + GraphiQL in dev)',
      'POST   /api/v1/uim/inbound/:integrationId  (HMAC-auth, no JWT)',
      'POST   /api/v1/uim/integrations/rest',
      'GET    /api/v1/uim/integrations/external-mro-pipeline',
      'POST   /api/v1/uim/integrations/external-mro-pipeline',
      'GET    /api/v1/uim/analytics/kpis',
      'GET    /api/v1/uim/analytics/etl',
      'POST   /api/v1/uim/analytics/etl',
      'GET    /api/v1/uim/analytics/reconciliation',
      'GET    /api/v1/uim/analytics/bi-cube',
      'GET    /api/v1/uim/analytics/qa-signoff',
      'POST   /api/v1/uim/analytics/qa-signoff',
      'GET    /api/v1/uim/analytics/sla-evidence',
    ],
    dual_writes: [
      'platform.integrations            → uim.integrations',
      'platform.integration_credentials → uim.integration_credentials',
      'platform.integration_log         → uim.integration_log',
      'platform.integration_dlq         → uim.integration_dlq',
      'platform.webhook_subscriptions   → uim.webhook_subscriptions',
    ],
    drift_check: 'SELECT * FROM uim.integrations_drift_check();  -- all rows delta=0 when in sync',
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
        resource_type: 'uim-api',
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

app.use('/api', authMiddleware, auditApiRequest, integrationsRoutes);
app.use('/api', authMiddleware, auditApiRequest, dlqRoutes);
app.use('/api', authMiddleware, auditApiRequest, outboxRoutes);
app.use('/api', authMiddleware, auditApiRequest, inventoryItemsRoutes);
app.use('/api', authMiddleware, auditApiRequest, connectorManifestsRoutes);
app.use('/api', authMiddleware, auditApiRequest, projectionsRoutes);
app.use('/api', authMiddleware, auditApiRequest, contractsRoutes);
app.use('/api', authMiddleware, auditApiRequest, webhooksRoutes);
app.use('/api', authMiddleware, auditApiRequest, seedingRoutes);
app.use('/api', authMiddleware, auditApiRequest, reservationsRoutes);
app.use('/api', authMiddleware, auditApiRequest, commandsRoutes);
app.use('/api', authMiddleware, auditApiRequest, formsRoutes);
app.use('/api', authMiddleware, auditApiRequest, graphqlRoutes);

// Inbound webhook receiver — auth is by HMAC verify + integration_id
// binding, NOT by user JWT. Mounted outside the authMiddleware chain.
app.use('/api', auditApiRequest, inboundRoutes);
app.use('/api', authMiddleware, auditApiRequest, integrationsRestRoutes);
app.use('/api', authMiddleware, auditApiRequest, externalMroPipelineRoutes);
app.use('/api', authMiddleware, auditApiRequest, analyticsKpisRoutes);
app.use('/api', authMiddleware, auditApiRequest, analyticsEtlRoutes);
app.use('/api', authMiddleware, auditApiRequest, analyticsTailRoutes);

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
