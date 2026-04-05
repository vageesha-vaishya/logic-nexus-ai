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
import { UIM_INTEGRATION_CONTRACTS } from '../integration-contracts';

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function parseInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return fallback;
  return parsed;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
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
    const body = (req.body && typeof req.body === 'object') ? (req.body as Record<string, unknown>) : {};
    const interfaceName = String(body.interface || '').trim().toLowerCase();

    if (interfaceName === 'rest-hardening-audit') {
      const expectedP95 = parseInteger(body.expected_p95_ms, 300);
      const observedP95 = parseInteger(body.observed_p95_ms, 0);
      const expectedAvailability = Number(body.expected_availability_percent || 99.9);
      const observedAvailability = Number(body.observed_availability_percent || 0);
      const idempotencyEnabled = parseBoolean(body.idempotency_enabled, true);
      const schemaValidationEnabled = parseBoolean(body.schema_validation_enabled, true);
      const authzValidationEnabled = parseBoolean(body.authz_validation_enabled, true);
      const errorBudgetStatus = observedP95 <= expectedP95 && observedAvailability >= expectedAvailability
        ? 'within_budget'
        : 'breach';

      res.status(200).json({
        version: 'v2',
        interface: 'uim-rest-hardening',
        correlationId: ctx.correlationId,
        output: {
          tenant_id: access.tenantId,
          controls: {
            idempotency_enabled: idempotencyEnabled,
            schema_validation_enabled: schemaValidationEnabled,
            authz_validation_enabled: authzValidationEnabled,
            compatibility_mode: 'strict-v2',
          },
          sla: {
            expected_p95_ms: expectedP95,
            observed_p95_ms: observedP95,
            expected_availability_percent: expectedAvailability,
            observed_availability_percent: observedAvailability,
            error_budget_status: errorBudgetStatus,
          },
          contract: {
            rest_specification: UIM_INTEGRATION_CONTRACTS.rest.specification,
            endpoint_count: UIM_INTEGRATION_CONTRACTS.rest.endpoints.length,
            contract_path: UIM_INTEGRATION_CONTRACTS.rest.contractPath,
          },
        },
      });
      return;
    }

    if (interfaceName === 'contract-compatibility-report') {
      const consumerModule = String(body.consumer_module || '').trim() || 'unknown-consumer';
      const requestedVersion = String(body.requested_schema_version || 'v0.6');
      const providedVersion = String(body.provided_schema_version || 'v0.6');
      const compatible = requestedVersion === providedVersion;
      res.status(200).json({
        version: 'v2',
        interface: 'uim-rest-hardening',
        correlationId: ctx.correlationId,
        output: {
          consumer_module: consumerModule,
          requested_schema_version: requestedVersion,
          provided_schema_version: providedVersion,
          compatibility_status: compatible ? 'compatible' : 'incompatible',
          report_id: `${access.tenantId}-${consumerModule}-${Date.now()}`,
        },
      });
      return;
    }

    res.status(400).json({
      error: 'Unsupported interface. Use rest-hardening-audit or contract-compatibility-report',
      version: 'v2',
      correlationId: ctx.correlationId,
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
