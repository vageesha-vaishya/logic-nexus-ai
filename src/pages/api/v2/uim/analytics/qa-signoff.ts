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
import {
  createUimQaSignoffRecord,
  getLatestUimQaSignoffRecord,
  listUimQaSignoffRecords,
} from '@/modules/uim/analytics/reconciliationSignoffStore';

function toBody(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object') return input as Record<string, unknown>;
  return {};
}

function readBoolean(value: unknown): boolean {
  return value === true || String(value || '').trim().toLowerCase() === 'true';
}

function assertNonEmpty(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${fieldName} is required`);
  return normalized;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);

  try {
    enforceHttps(req);
    enforceRateLimit(req);
    const access = await resolveUimAccess(req, ctx);

    if (req.method === 'GET') {
      const records = listUimQaSignoffRecords(access.tenantId, access.franchiseId || null);
      const latest = getLatestUimQaSignoffRecord(access.tenantId, access.franchiseId || null);
      res.status(200).json({
        version: 'v2',
        interface: 'uim-analytics-qa-signoff',
        correlationId: ctx.correlationId,
        output: {
          tenant_id: access.tenantId,
          franchise_id: access.franchiseId || null,
          latest,
          records,
        },
      });
      return;
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    const body = toBody(req.body);
    const signoff = createUimQaSignoffRecord({
      tenant_id: access.tenantId,
      franchise_id: access.franchiseId || null,
      signoff_status: String(body.signoff_status || '').trim().toLowerCase() === 'revoked' ? 'revoked' : 'signed_off',
      signed_off_by: assertNonEmpty(body.signed_off_by, 'signed_off_by'),
      signed_off_role: assertNonEmpty(body.signed_off_role, 'signed_off_role'),
      checklist: {
        reconciliation_verified: readBoolean(body.reconciliation_verified),
        latency_target_met: readBoolean(body.latency_target_met),
        data_dictionary_published: readBoolean(body.data_dictionary_published),
        bi_cube_deployed: readBoolean(body.bi_cube_deployed),
      },
      notes: String(body.notes || ''),
    });

    res.status(200).json({
      version: 'v2',
      interface: 'uim-analytics-qa-signoff',
      correlationId: ctx.correlationId,
      output: {
        tenant_id: access.tenantId,
        franchise_id: access.franchiseId || null,
        signoff,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
