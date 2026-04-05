import type { ApiRequest, ApiResponse } from '@/pages/api/_utils/types';

const OPENAPI_YAML = `
openapi: 3.1.0
info:
  title: UIM Integration API
  version: 0.8.0
  description: >
    Phase 4 analytics and reporting contracts for UIM unified inventory services.
servers:
  - url: /api/v2/uim
paths:
  /commands:
    post:
      summary: Execute inventory command (RECEIVE, MOVE, RESERVE, CONSUME)
  /projections/replay:
    post:
      summary: Rebuild deterministic projection snapshots from stock ledger
  /projections/items:
    get:
      summary: List inventory projection snapshots
  /integrations/rest:
    post:
      summary: REST hardening audit and compatibility reporting
  /analytics/kpis:
    get:
      summary: UIM analytics KPI model snapshot
  /analytics/etl:
    get:
      summary: UIM ETL scheduler queue status and telemetry
    post:
      summary: UIM ETL scheduler actions (schedule/process/start/stop)
  /analytics/reconciliation:
    get:
      summary: UIM reporting reconciliation readiness checks
  /analytics/bi-cube:
    get:
      summary: UIM BI cube deployment artifact and published data dictionary
  /analytics/qa-signoff:
    get:
      summary: UIM reporting QA sign-off workflow state
    post:
      summary: Submit UIM reporting QA sign-off decision
  /analytics/sla-evidence:
    get:
      summary: UIM Phase 4 v0.8 latency and SLA evidence package
  /graphql:
    post:
      summary: GraphQL endpoint for projection and inventory read models
  /webhooks:
    get:
      summary: List webhook adapters
    post:
      summary: Register/dispatch/deactivate webhook adapters
  /connectors/manifests:
    get:
      summary: List connector manifests
`.trim();

export default async function handler(_req: ApiRequest, res: ApiResponse) {
  res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
  res.status(200).end(OPENAPI_YAML);
}
