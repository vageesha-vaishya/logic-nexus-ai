// Phase 4 Sales Step 4 — sales-api service skeleton.
//
// The route extraction from services/crm-api/src/routes/leads.routes.ts
// happens in a follow-up slice because leads.routes.ts shares the crm-api
// event-bus producer (crm-events.producer.ts) and auth middleware with
// invoices/tax routes. Splitting cleanly requires either:
//   (a) lifting events/auth/types into a shared @sos/api-common package, or
//   (b) duplicating the minimum surface here and reconciling later.
//
// Until that decision lands, this skeleton boots, exposes /health, and is
// wired into the orchestrator so the port is reserved and the deployment
// topology is settled.

import express, { Express, Request, Response } from 'express';
import cors from 'cors';

const app: Express = express();

app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-Franchise-Id', 'X-User-Id'],
  }),
);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'sales-api', version: '0.1.0' });
});

app.get('/sales/v1/_status', (_req: Request, res: Response) => {
  res.json({
    service: 'sales-api',
    schema: 'sales',
    tables: ['sales.leads', 'sales.opportunities', 'sales.pipelines', 'sales.pipeline_stages', 'sales.forecasts', 'sales.forecast_lines', 'sales.scoring_configs', 'sales.scoring_rules', 'sales.scoring_logs'],
    notes: 'Routes pending: leads, opportunities, pipelines, forecasts, scoring. Currently served by crm-api/leads.routes.ts until lift-out lands.',
  });
});

export default app;
