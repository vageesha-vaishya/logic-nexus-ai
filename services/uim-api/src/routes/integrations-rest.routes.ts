// Phase 7 UIM Step 4b.11 — REST hardening interface route.
//
// Carves src/pages/api/v2/uim/integrations/rest.ts (117 LOC) into
// uim-api as POST /api/v1/uim/integrations/rest. Two interface
// modes:
//   - rest-hardening-audit         → SLA + controls + contract
//                                    snapshot for an external auditor
//   - contract-compatibility-report → consumer module's requested
//                                    vs provided schema version
//
// These are read-only synthesis endpoints — they don't mutate any
// table. Outputs are derived from the request body + the
// integration-contracts registry. Pre-existing connector-manifests
// already advertises this path.

import { Router, Response } from 'express';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { ErrorResponse } from '../types/uim.types.js';

const router = Router();

// Snapshot mirrors the integration-contracts registry. Keeping it
// inline here (rather than importing) avoids coupling this route to
// the contracts module's full shape — only 3 fields are surfaced.
const REST_CONTRACT_SNAPSHOT = {
  specification: 'OpenAPI 3.1',
  endpoint_count: 17,
  contract_path: '/api/v1/uim/contracts/openapi-3.1.yaml',
};

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  } as ErrorResponse);
}

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

router.post(
  '/v1/uim/integrations/rest',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    const body = (req.body && typeof req.body === 'object')
      ? (req.body as Record<string, unknown>)
      : {};
    const interfaceName = String(body.interface || '').trim().toLowerCase();

    if (interfaceName === 'rest-hardening-audit') {
      const expectedP95 = parseInteger(body.expected_p95_ms, 300);
      const observedP95 = parseInteger(body.observed_p95_ms, 0);
      const expectedAvailability = Number(body.expected_availability_percent || 99.9);
      const observedAvailability = Number(body.observed_availability_percent || 0);
      const idempotencyEnabled = parseBoolean(body.idempotency_enabled, true);
      const schemaValidationEnabled = parseBoolean(body.schema_validation_enabled, true);
      const authzValidationEnabled = parseBoolean(body.authz_validation_enabled, true);
      const errorBudgetStatus =
        observedP95 <= expectedP95 && observedAvailability >= expectedAvailability
          ? 'within_budget'
          : 'breach';

      return res.status(200).json({
        version: 'v1',
        interface: 'uim-rest-hardening',
        output: {
          tenant_id: authReq.tenantId,
          controls: {
            idempotency_enabled: idempotencyEnabled,
            schema_validation_enabled: schemaValidationEnabled,
            authz_validation_enabled: authzValidationEnabled,
            compatibility_mode: 'strict-v1',
          },
          sla: {
            expected_p95_ms: expectedP95,
            observed_p95_ms: observedP95,
            expected_availability_percent: expectedAvailability,
            observed_availability_percent: observedAvailability,
            error_budget_status: errorBudgetStatus,
          },
          contract: {
            rest_specification: REST_CONTRACT_SNAPSHOT.specification,
            endpoint_count: REST_CONTRACT_SNAPSHOT.endpoint_count,
            contract_path: REST_CONTRACT_SNAPSHOT.contract_path,
          },
        },
      });
    }

    if (interfaceName === 'contract-compatibility-report') {
      const consumerModule = String(body.consumer_module || '').trim() || 'unknown-consumer';
      const requestedVersion = String(body.requested_schema_version || 'v0.6');
      const providedVersion = String(body.provided_schema_version || 'v0.6');
      const compatible = requestedVersion === providedVersion;
      return res.status(200).json({
        version: 'v1',
        interface: 'uim-rest-hardening',
        output: {
          consumer_module: consumerModule,
          requested_schema_version: requestedVersion,
          provided_schema_version: providedVersion,
          compatibility_status: compatible ? 'compatible' : 'incompatible',
          report_id: `${authReq.tenantId}-${consumerModule}-${Date.now()}`,
        },
      });
    }

    return res.status(400).json({
      error: 'Unsupported interface. Use rest-hardening-audit or contract-compatibility-report',
      code: 'INVALID_REQUEST',
      statusCode: 400,
    } as ErrorResponse);
  }),
);

export default router;
