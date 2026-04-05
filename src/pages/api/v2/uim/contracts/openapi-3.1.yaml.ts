import type { ApiRequest, ApiResponse } from '@/pages/api/_utils/types';

const OPENAPI_YAML = `
openapi: 3.1.0
info:
  title: UIM Integration API
  version: 0.6.0
  description: >
    Phase 3 channel integration contracts for UIM core inventory services.
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
