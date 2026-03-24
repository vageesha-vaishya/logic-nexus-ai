import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../../_utils/http';
import { getSupabaseAdminClient } from '../../../../_utils/supabaseAdmin';
import {
  getEntityConfig,
  resolveEntity,
  sanitizeWritePayload,
  sendError,
  writeAuditRecord,
  HttpError,
} from '../shared';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../../_utils/compatibility-facade';

function isV2Enabled(): boolean {
  const normalized = String(process.env.AMRO_MASTER_DATA_V2_ENABLED || 'true').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function asBodyObject(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  const compatibilityDecision = resolveGatewayCompatibility(req, {
    tenantId: ctx.tenantId,
    franchiseId: ctx.franchiseId,
  });
  applyCompatibilityResponseHeaders(res, compatibilityDecision, ctx.correlationId);

  try {
    if (!isV2Enabled()) {
      throw new HttpError('Not Found', 404);
    }
    if (req.method !== 'GET' && req.method !== 'PATCH' && req.method !== 'DELETE') {
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
      throw new HttpError(`Method ${req.method} Not Allowed`, 405);
    }
    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(scopedAccess, { correlationId: ctx.correlationId });
    const tenantId = String(scopedAccess.tenantId || '');
    const franchiseId = scopedAccess.franchiseId ? String(scopedAccess.franchiseId) : null;
    const entity = resolveEntity(req.query.entity);
    const id = String(req.query.id || '').trim();
    if (!id) throw new HttpError('id is required', 400);
    const entityConfig = getEntityConfig(entity);
    const supabase = getSupabaseAdminClient();

    const { data: existing, error: existingError } = await supabase
      .from(entityConfig.table)
      .select(entityConfig.listColumns)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .limit(1)
      .maybeSingle();
    if (existingError) throw new HttpError(existingError.message, 400);
    if (!existing) throw new HttpError('Record not found', 404);
    const existingRecord = existing as unknown as Record<string, unknown>;
    const existingFranchiseId = String(existingRecord.franchise_id || '').trim();
    if (franchiseId && existingFranchiseId && existingFranchiseId !== franchiseId) {
      throw new HttpError('Forbidden', 403);
    }

    if (req.method === 'GET') {
      enforceAnyPermission(auth.permissions || [], ['view_amro_dashboard', 'edit_aircraft_records']);
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          entity,
          record: existing,
        },
      });
      return;
    }

    if (req.method === 'DELETE') {
      enforceAnyPermission(auth.permissions || [], ['edit_aircraft_records']);
      const { error } = await supabase.from(entityConfig.table).delete().eq('tenant_id', tenantId).eq('id', id);
      if (error) throw new HttpError(error.message, 400);
      await writeAuditRecord({
        tenantId,
        franchiseId,
        userId: auth.userId,
        entity,
        action: 'delete',
        entityId: id,
        beforeData: existing,
      });
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          entity,
          deleted_id: id,
        },
      });
      return;
    }

    enforceAnyPermission(auth.permissions || [], ['edit_aircraft_records', 'create_maintenance_request']);
    const payload = sanitizeWritePayload(entity, asBodyObject(req.body));
    const updatePayload = {
      ...payload,
      updated_by: auth.userId,
    };
    const { data, error } = await supabase
      .from(entityConfig.table)
      .update(updatePayload)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select(entityConfig.listColumns)
      .limit(1)
      .maybeSingle();
    if (error) throw new HttpError(error.message, 400);
    await writeAuditRecord({
      tenantId,
      franchiseId,
      userId: auth.userId,
      entity,
      action: 'update',
      entityId: id,
      beforeData: existing,
      afterData: data,
    });
    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      output: {
        entity,
        record: data,
      },
    });
  } catch (error) {
    sendError(res, error, ctx.correlationId);
  }
}
