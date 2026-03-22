import { createHash } from 'node:crypto';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../_utils/compatibility-facade';
import { replayAmroAuditLedgerRecords, replayAmroAuditTamperAlerts, validateAmroAuditLedgerIntegrity } from '../audit-ledger';

type ApiAmroReplayErrorCode = 'AMRO_AUDIT_RANGE_TOO_LARGE' | 'AMRO_EXPORT_UNAVAILABLE' | 'AMRO_EVALUATION_CONTEXT_INVALID';

function parseBoolean(value: unknown, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function parseDate(value: unknown, fieldName: string): Date {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`invalid:${fieldName}`);
  }
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`invalid:${fieldName}`);
  }
  return new Date(parsed);
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  const normalized = String(value || '').trim();
  if (!normalized) return [];
  return normalized.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function sendReplayError(
  res: ApiResponse,
  traceId: string,
  status: number,
  code: ApiAmroReplayErrorCode,
  message: string,
  details: string[],
  retryable: boolean,
) {
  res.status(status).json({
    version: 'v2',
    code,
    message,
    details,
    trace_id: traceId,
    retryable,
  });
}

function mapReplayError(error: unknown, traceId: string, res: ApiResponse): boolean {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('invalid:')) {
    sendReplayError(
      res,
      traceId,
      422,
      'AMRO_EVALUATION_CONTEXT_INVALID',
      'Replay request query is invalid',
      [message.replace('invalid:', '')],
      false,
    );
    return true;
  }
  if (message === 'range_too_large') {
    sendReplayError(
      res,
      traceId,
      413,
      'AMRO_AUDIT_RANGE_TOO_LARGE',
      'Requested replay range is too large',
      ['Reduce the replay date range or request async export.'],
      false,
    );
    return true;
  }
  if (message === 'export_unavailable') {
    sendReplayError(
      res,
      traceId,
      503,
      'AMRO_EXPORT_UNAVAILABLE',
      'Replay export format is temporarily unavailable',
      ['Retry with format=json or enable audit export capability.'],
      true,
    );
    return true;
  }
  return false;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const compatibility = resolveGatewayCompatibility(req, { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId });
  applyCompatibilityResponseHeaders(res, compatibility, ctx.correlationId);

  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId, version: 'v2' });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });

    const entityId = String(req.query.entity_id || '').trim();
    const fromDate = parseDate(req.query.from, 'from');
    const toDate = parseDate(req.query.to, 'to');
    if (fromDate.getTime() > toDate.getTime()) {
      throw new Error('invalid:from');
    }
    const rangeMs = toDate.getTime() - fromDate.getTime();
    if (rangeMs > 1000 * 60 * 60 * 24 * 31) {
      throw new Error('range_too_large');
    }
    const eventTypes = parseStringArray(req.query.event_types);
    const includeSignatures = parseBoolean(req.query.include_signatures, false);
    const format = String(req.query.format || 'json').trim().toLowerCase();
    if (format !== 'json' && format !== 'csv') {
      throw new Error('invalid:format');
    }
    if (format === 'csv' && String(process.env.AMRO_AUDIT_EXPORTS_ENABLED || 'false').trim().toLowerCase() !== 'true') {
      throw new Error('export_unavailable');
    }

    const records = replayAmroAuditLedgerRecords({
      tenantId: String(access.tenantId || ''),
      franchiseId: access.franchiseId ? String(access.franchiseId) : null,
      limit: 500,
    });
    const filteredRecords = records.filter((record) => {
      if (entityId && record.entityId !== entityId) return false;
      const createdAt = Date.parse(record.createdAt);
      if (!Number.isFinite(createdAt) || createdAt < fromDate.getTime() || createdAt > toDate.getTime()) return false;
      if (eventTypes.length > 0 && !eventTypes.includes(record.eventType)) return false;
      return true;
    });
    const integrity = validateAmroAuditLedgerIntegrity({
      tenantId: String(access.tenantId || ''),
      franchiseId: access.franchiseId ? String(access.franchiseId) : null,
    });
    const tamperAlerts = replayAmroAuditTamperAlerts({
      tenantId: String(access.tenantId || ''),
      franchiseId: access.franchiseId ? String(access.franchiseId) : null,
      limit: 100,
    });
    const hashValidationStatus = filteredRecords.every((record, index) => {
      if (index === filteredRecords.length - 1) {
        return true;
      }
      return record.previousHash === filteredRecords[index + 1].chainHash;
    }) && integrity.valid ? 'valid' : 'invalid';
    const timeline = filteredRecords.map((record) => ({
      event_id: record.recordId,
      event_type: record.eventType,
      entity_id: record.entityId,
      action: record.action,
      created_at: record.createdAt,
      chain_hash: record.chainHash,
      previous_hash: record.previousHash,
      signatures: includeSignatures ? [{ signer_id: 'certifier', signature_ref: `${record.recordId}-signature` }] : [],
    }));
    const exportRef = format === 'csv'
      ? `amro-audit-export-${createHash('sha256').update(`${access.tenantId}:${ctx.correlationId}:${Date.now()}`).digest('hex').slice(0, 16)}`
      : null;

    return res.status(200).json({
      version: 'v2',
      timeline,
      hash_validation_status: hashValidationStatus,
      tamper_alerts: tamperAlerts.map((alert) => ({
        record_id: alert.recordId,
        reason: alert.reason,
        expected_previous_hash: alert.expectedPreviousHash,
        actual_previous_hash: alert.actualPreviousHash,
        detected_at: alert.detectedAt,
      })),
      export_ref: exportRef,
      applied_filters: {
        entity_id: entityId || null,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        event_types: eventTypes,
        include_signatures: includeSignatures,
        format,
      },
      api_guardrails: {
        class: 'audit replay/export',
        p95_target_ms: 1500,
        p99_target_ms: 3000,
        availability_target: 99.9,
      },
      trace_id: ctx.correlationId,
    });
  } catch (error) {
    if (mapReplayError(error, ctx.correlationId, res)) {
      return;
    }
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
