// Phase 7 UIM Step 4b.4 — integration contracts registry route.
//
// Carves src/pages/api/v2/uim/integration-contracts.ts (140 LOC)
// into uim-api. Static registry endpoint that lists every UIM
// integration surface (REST endpoints, GraphQL fields, webhook events,
// connector adapters, analytics KPIs, AMRO pipeline, seeding) so
// frontend code + external connectors can discover paths from one
// canonical source.
//
// Paths are documented as /api/v1/uim/... — the new uim-api surface —
// since this registry serves uim-api's contract going forward. The
// legacy /api/v2/uim/... registry stays in src/pages/api/v2/uim/ for
// existing consumers until the cut-over slice.

import { Router, Response } from 'express';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { ErrorResponse } from '../types/uim.types.js';

const router = Router();

// Path constants — using the new /api/v1/uim/... namespace. Add new
// constants here as more routes land.
const UIM_OPENAPI_SPEC_PATH = '/api/v1/uim/contracts/openapi-3.1.yaml';
const UIM_GRAPHQL_SUBGRAPH_PATH = '/api/v1/uim/contracts/uim-subgraph.graphql';
const UIM_CONNECTOR_MANIFESTS_PATH = '/api/v1/uim/connectors/manifests';
const UIM_WEBHOOK_FRAMEWORK_PATH = '/api/v1/uim/webhooks';
const UIM_GRAPHQL_PATH = '/api/v1/uim/graphql';
const UIM_REST_HARDENING_PATH = '/api/v1/uim/integrations/rest';
const UIM_EXTERNAL_MRO_PIPELINE_PATH = '/api/v1/uim/integrations/external-mro-pipeline';
const UIM_AMRO_PIPELINE_PATH_LEGACY = '/api/v1/uim/integrations/amro-pipeline';
const UIM_ANALYTICS_KPIS_PATH = '/api/v1/uim/analytics/kpis';
const UIM_ANALYTICS_ETL_PATH = '/api/v1/uim/analytics/etl';
const UIM_ANALYTICS_RECONCILIATION_PATH = '/api/v1/uim/analytics/reconciliation';
const UIM_ANALYTICS_BI_CUBE_PATH = '/api/v1/uim/analytics/bi-cube';
const UIM_ANALYTICS_QA_SIGNOFF_PATH = '/api/v1/uim/analytics/qa-signoff';
const UIM_ANALYTICS_SLA_EVIDENCE_PATH = '/api/v1/uim/analytics/sla-evidence';

const UIM_INTEGRATION_CONTRACTS = Object.freeze({
  rest: {
    specification: 'OpenAPI 3.1',
    endpoints: [
      '/api/v1/uim/commands',
      '/api/v1/uim/projections/replay',
      '/api/v1/uim/projections/items',
      '/api/v1/uim/forms/{node}',
      '/api/v1/uim/forms/{node}/{id}',
      UIM_REST_HARDENING_PATH,
      UIM_EXTERNAL_MRO_PIPELINE_PATH,
      UIM_AMRO_PIPELINE_PATH_LEGACY,
      '/api/v1/uim/seeding/mro',
      UIM_ANALYTICS_KPIS_PATH,
      UIM_ANALYTICS_ETL_PATH,
      UIM_ANALYTICS_RECONCILIATION_PATH,
      UIM_ANALYTICS_BI_CUBE_PATH,
      UIM_ANALYTICS_QA_SIGNOFF_PATH,
      UIM_ANALYTICS_SLA_EVIDENCE_PATH,
      UIM_WEBHOOK_FRAMEWORK_PATH,
      UIM_CONNECTOR_MANIFESTS_PATH,
      '/health',
    ],
    contractPath: UIM_OPENAPI_SPEC_PATH,
  },
  graphql: {
    type: 'subgraph',
    runtime: 'graphql-yoga + Pothos (code-first)',
    fields: [
      'uimHealth',
      'uimProjectionItems(limit, offset)',
      'uimInventoryItem(id)',
      'inventoryItems(first, after, catalogItemId, status, locationId): InventoryItemConnection',
      'reservations(first, after, status, referencedModule): ReservationConnection',
      'ledgerEntries(first, after, inventoryItemId, transactionType, since): LedgerEntryConnection',
      'availabilityByPartNumber(partNumbers: [String!]!): [PartAvailability!]',
      'availableQuantityByLocation(status): [LocationAvailability!]',
      'integrations(limit, lifecycleState): [Integration!]',
      'integration(id): Integration',
      'webhookDlqRetryable(limit): [DlqRetryableRow!]',
    ],
    schemaPath: UIM_GRAPHQL_SUBGRAPH_PATH,
    endpointPath: UIM_GRAPHQL_PATH,
    pagination: 'Relay cursor (first / after) on new collections; limit/offset preserved on uimProjectionItems for back-compat',
    introspection: true,
    notes: 'Read-only — mutations stay REST per master plan §9.2',
  },
  webhooks: {
    adapterFrameworkPath: UIM_WEBHOOK_FRAMEWORK_PATH,
    supportedEvents: [
      'uim.command.applied.v1',
      'uim.projection.replayed.v1',
      'uim.reservation.created.v1',
      'uim.stock.threshold.breach.v1',
    ],
  },
  connectors: {
    manifestPath: UIM_CONNECTOR_MANIFESTS_PATH,
    adapters: ['freight-bridge', 'amro-bridge', 'marketplace-bridge', 'erp-bridge'],
  },
  amroPipeline: {
    path: UIM_EXTERNAL_MRO_PIPELINE_PATH,
    compatibilityAliasPath: UIM_AMRO_PIPELINE_PATH_LEGACY,
    actions: ['reserve', 'consume', 'return', 'sync-batch', 'process-queue'],
    idempotency: 'tenant-scoped idempotency key with job replay',
    queueTable: 'uim_amro_sync_jobs',
    auditTable: 'uim_amro_sync_audit',
  },
  seeding: {
    mroPath: '/api/v1/uim/seeding/mro',
    targetRange: '500-1000',
    defaultCount: 800,
  },
  analytics: {
    kpiPath: UIM_ANALYTICS_KPIS_PATH,
    etlPath: UIM_ANALYTICS_ETL_PATH,
    reconciliationPath: UIM_ANALYTICS_RECONCILIATION_PATH,
    biCubePath: UIM_ANALYTICS_BI_CUBE_PATH,
    qaSignoffPath: UIM_ANALYTICS_QA_SIGNOFF_PATH,
    slaEvidencePath: UIM_ANALYTICS_SLA_EVIDENCE_PATH,
    defaultLowStockThreshold: 5,
    kpis: [
      'total_tracked_items',
      'available_quantity',
      'reserved_quantity',
      'consumed_quantity',
      'in_transit_items',
      'low_stock_items',
      'inventory_turnover_ratio',
    ],
    etlActions: [
      'schedule-run',
      'process-now',
      'start-scheduler',
      'stop-scheduler',
    ],
  },
});

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  } as ErrorResponse);
}

router.get(
  '/v1/uim/integration-contracts',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    return res.json(UIM_INTEGRATION_CONTRACTS);
  }),
);

export default router;
