import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { resolveUimAccess } from './_shared';

export const UIM_OPENAPI_SPEC_PATH = '/api/v2/uim/contracts/openapi-3.1.yaml' as const;
export const UIM_GRAPHQL_SUBGRAPH_PATH = '/api/v2/uim/contracts/uim-subgraph.graphql' as const;
export const UIM_CONNECTOR_MANIFESTS_PATH = '/api/v2/uim/connectors/manifests' as const;
export const UIM_WEBHOOK_FRAMEWORK_PATH = '/api/v2/uim/webhooks' as const;
export const UIM_GRAPHQL_PATH = '/api/v2/uim/graphql' as const;
export const UIM_REST_HARDENING_PATH = '/api/v2/uim/integrations/rest' as const;
export const UIM_ANALYTICS_KPIS_PATH = '/api/v2/uim/analytics/kpis' as const;
export const UIM_ANALYTICS_ETL_PATH = '/api/v2/uim/analytics/etl' as const;

export const UIM_INTEGRATION_CONTRACTS = {
  rest: {
    specification: 'OpenAPI 3.1',
    endpoints: [
      '/api/v2/uim/commands',
      '/api/v2/uim/projections/replay',
      '/api/v2/uim/projections/items',
      '/api/v2/uim/forms/{node}',
      '/api/v2/uim/forms/{node}/{id}',
      UIM_REST_HARDENING_PATH,
      UIM_ANALYTICS_KPIS_PATH,
      UIM_ANALYTICS_ETL_PATH,
      UIM_WEBHOOK_FRAMEWORK_PATH,
      UIM_CONNECTOR_MANIFESTS_PATH,
      '/api/v2/uim/health',
    ],
    contractPath: UIM_OPENAPI_SPEC_PATH,
  },
  graphql: {
    type: 'subgraph',
    fields: [
      'uimProjectionItems(limit, offset)',
      'uimInventoryItem(id)',
      'uimHealth',
    ],
    schemaPath: UIM_GRAPHQL_SUBGRAPH_PATH,
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
  analytics: {
    kpiPath: UIM_ANALYTICS_KPIS_PATH,
    etlPath: UIM_ANALYTICS_ETL_PATH,
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
} as const;

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);

  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }
    enforceHttps(req);
    enforceRateLimit(req);
    await resolveUimAccess(req, ctx);
    res.status(200).json({
      version: 'v2',
      interface: 'uim-integration-contracts',
      correlationId: ctx.correlationId,
      output: UIM_INTEGRATION_CONTRACTS,
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
