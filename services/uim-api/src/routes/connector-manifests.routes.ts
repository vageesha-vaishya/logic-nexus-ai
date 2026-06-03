// Phase 7 UIM Step 4b.2 — connector manifests read route.
//
// Carves src/pages/api/v2/uim/connectors/manifests.ts (93 LOC) into
// uim-api. Static config endpoint — no DB. Lists the 4 known
// integration connectors with their version, protocols, source
// systems, emitted events, and SLA targets. Used by the operator UI
// to drive a connector picker and surface SLA expectations on the
// integrations page.

import { Router, Response } from 'express';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { ErrorResponse } from '../types/uim.types.js';

const router = Router();

// Frozen so the array can't be mutated by accident at runtime.
const CONNECTOR_MANIFESTS = Object.freeze([
  Object.freeze({
    connector_id: 'freight-bridge',
    connector_name: 'Freight Bridge Connector',
    version: '0.6.0',
    protocol: ['REST', 'Webhook'],
    direction: 'bi-directional',
    source_systems: ['freight-core', 'quotation-service'],
    events: ['uim.command.applied.v1', 'uim.stock.threshold.breach.v1'],
    sla: { p95_latency_ms: 250, availability_percent: 99.9 },
  }),
  Object.freeze({
    connector_id: 'amro-bridge',
    connector_name: 'AMRO Connector',
    version: '0.6.0',
    protocol: ['REST', 'GraphQL', 'Webhook'],
    direction: 'bi-directional',
    source_systems: ['amro-core'],
    events: [
      'uim.reservation.created.v1',
      'uim.projection.replayed.v1',
      'uim.amro.sync.requested.v1',
      'uim.amro.sync.completed.v1',
    ],
    sla: { p95_latency_ms: 300, availability_percent: 99.9 },
  }),
  Object.freeze({
    connector_id: 'marketplace-bridge',
    connector_name: 'Marketplace Adapter',
    version: '0.6.0',
    protocol: ['REST', 'Webhook'],
    direction: 'outbound',
    source_systems: ['vendor-marketplace'],
    events: ['uim.command.applied.v1'],
    sla: { p95_latency_ms: 350, availability_percent: 99.5 },
  }),
  Object.freeze({
    connector_id: 'erp-bridge',
    connector_name: 'ERP Adapter',
    version: '0.6.0',
    protocol: ['REST', 'Webhook'],
    direction: 'bi-directional',
    source_systems: ['sap', 'oracle-eam'],
    events: ['uim.command.applied.v1', 'uim.stock.threshold.breach.v1'],
    sla: { p95_latency_ms: 300, availability_percent: 99.9 },
  }),
]);

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  } as ErrorResponse);
}

router.get(
  '/v1/uim/connectors/manifests',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    return res.json({
      tenant_id: authReq.tenantId,
      franchise_id: authReq.franchiseId ?? null,
      connector_manifests: CONNECTOR_MANIFESTS,
    });
  }),
);

export default router;
