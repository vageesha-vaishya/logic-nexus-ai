import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  applyCors,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { resolveUimAccess } from '../_shared';

const CONNECTOR_MANIFESTS = [
  {
    connector_id: 'freight-bridge',
    connector_name: 'Freight Bridge Connector',
    version: '0.6.0',
    protocol: ['REST', 'Webhook'],
    direction: 'bi-directional',
    source_systems: ['freight-core', 'quotation-service'],
    events: ['uim.command.applied.v1', 'uim.stock.threshold.breach.v1'],
    sla: { p95_latency_ms: 250, availability_percent: 99.9 },
  },
  {
    connector_id: 'amro-bridge',
    connector_name: 'AMRO Connector',
    version: '0.6.0',
    protocol: ['REST', 'GraphQL', 'Webhook'],
    direction: 'bi-directional',
    source_systems: ['amro-core'],
    events: ['uim.reservation.created.v1', 'uim.projection.replayed.v1'],
    sla: { p95_latency_ms: 300, availability_percent: 99.9 },
  },
  {
    connector_id: 'marketplace-bridge',
    connector_name: 'Marketplace Adapter',
    version: '0.6.0',
    protocol: ['REST', 'Webhook'],
    direction: 'outbound',
    source_systems: ['vendor-marketplace'],
    events: ['uim.command.applied.v1'],
    sla: { p95_latency_ms: 350, availability_percent: 99.5 },
  },
  {
    connector_id: 'erp-bridge',
    connector_name: 'ERP Adapter',
    version: '0.6.0',
    protocol: ['REST', 'Webhook'],
    direction: 'bi-directional',
    source_systems: ['sap', 'oracle-eam'],
    events: ['uim.command.applied.v1', 'uim.stock.threshold.breach.v1'],
    sla: { p95_latency_ms: 300, availability_percent: 99.9 },
  },
] as const;

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
    const access = await resolveUimAccess(req, ctx);

    res.status(200).json({
      version: 'v2',
      interface: 'uim-connector-manifests',
      correlationId: ctx.correlationId,
      output: {
        tenant_id: access.tenantId,
        franchise_id: access.franchiseId || null,
        connector_manifests: CONNECTOR_MANIFESTS,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
