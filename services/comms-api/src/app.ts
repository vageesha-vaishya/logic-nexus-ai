// Phase 6 comms-api — Express app.
//
// Mirrors finance-api / compliance-api shape: cors + correlation-id +
// /health + /api auth + audit hook. The two skeletal read routes mount
// under /api/v1/comms/*; the vite proxy directs /api/comms/* +
// /api/v1/comms/* to this service.
//
// The real work happens inside the notification dispatcher (started from
// index.ts) — the HTTP service is mostly the read surface for tracking
// delivery state.

import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

import { authMiddleware, getAuthHeaderMonitoringSnapshot } from './middleware/auth.middleware.js';
import adminWhatsappRoutes from './routes/admin-whatsapp.routes.js';
import deliveriesRoutes from './routes/deliveries.routes.js';
import unsubscribeRoutes from './routes/unsubscribe.routes.js';
import webhooksRoutes from './routes/webhooks.routes.js';
import type { ErrorResponse } from './types/comms.types.js';
import { logger } from './utils/logger.js';

const app: Express = express();
type RequestWithCorrelation = Request & { correlationId?: string };
type RequestWithScope = RequestWithCorrelation & {
  userId?: string;
  tenantId?: string;
  franchiseId?: string | null;
};

// Capture the raw body string on every parsed JSON request so the
// webhook receiver can verify Svix HMAC signatures (which sign the
// pre-parse bytes). Cheap — one Buffer.toString per request.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: string }).rawBody = buf.toString('utf8');
    },
  }),
);

// RFC 8058 unsubscribe-post sends application/x-www-form-urlencoded.
// Tiny limit — the body is decorative; the trust comes from the URL.
app.use(express.urlencoded({ extended: false, limit: '1kb' }));

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
    service: 'comms-api',
    timestamp: new Date().toISOString(),
    authHeaderMonitoring: getAuthHeaderMonitoringSnapshot(),
  });
});

app.get('/comms/v1/_status', (_req: Request, res: Response) => {
  res.json({
    service: 'comms-api',
    schema: 'comms',
    tables: [
      'comms.deliveries',
      'comms.delivery_events',
      'comms.suppressions',
      'comms.emails',
      'comms.email_accounts',
      'comms.messages',
      'comms.scheduled_emails',
      'comms.webhook_outbox',
    ],
    routes: [
      'GET  /api/v1/comms/deliveries',
      'GET  /api/v1/comms/notifications/:id/deliveries',
      'POST /api/comms/webhooks/resend  (Svix-signed, no auth)',
      'POST  /api/v1/admin/phones/whatsapp-bulk-enable  (platform_admin)',
      'GET   /api/v1/admin/phones?tenant_id=&capable=    (platform_admin)',
      'PATCH /api/v1/admin/phones/:id                    (platform_admin)',
    ],
    consumers: [
      'notification-dispatcher (polls core.notifications, fans out into comms.deliveries via UNIQUE intent dedup index)',
      'delivery-worker (picks up status=pending deliveries on the active channels, suppression-checks, sends via the per-channel provider, writes status back)',
    ],
    active_channels: ['email', 'sms', 'whatsapp', 'push'],
    providers: {
      email: process.env.COMMS_EMAIL_PROVIDER || 'null',
      sms: process.env.COMMS_SMS_PROVIDER || 'null',
      whatsapp: process.env.COMMS_WHATSAPP_PROVIDER || 'null',
      push: process.env.FCM_SERVICE_ACCOUNT_JSON ? 'fcm' : 'null',
    },
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
        resource_type: 'comms-api',
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

// Webhook + unsubscribe routes (no auth — mail clients have no JWT)
// must mount BEFORE the auth-gated /api stack. Resend webhook trusts
// the Svix HMAC; unsubscribe trusts the unguessable delivery_id UUID.
app.use('/api', webhooksRoutes);
app.use('/api', unsubscribeRoutes);

app.use('/api', authMiddleware, auditApiRequest, deliveriesRoutes);
app.use('/api', authMiddleware, auditApiRequest, adminWhatsappRoutes);

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
