import type { ApiRequest, ApiResponse } from '../../../_utils/types';
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
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import {
  buildPartsAuthDiagnostics,
  mapPartsInventoryRowToTemplate,
  resolveWorkflowTriggers,
  validatePartsRecordInput,
  writePartsAuditLog,
  writePartsWorkflowEvents,
} from './shared';

function isEnabled(): boolean {
  const normalized = String(process.env.AMRO_PARTS_REALTIME_V2_ENABLED || 'true').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

const INVENTORY_ALLOWED_KEYS = new Set([
  'part_number',
  'serial_number',
  'description',
  'status',
  'lifecycle_status',
  'quantity_on_hand',
  'quantity_reserved',
  'warehouse_location',
]);

function normalizeInventoryPatchPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!INVENTORY_ALLOWED_KEYS.has(key)) continue;
    if (value === undefined) continue;
    if (key === 'part_number') {
      normalized[key] = String(value || '').trim().toUpperCase();
      continue;
    }
    if (key === 'serial_number') {
      const serial = String(value || '').trim().toUpperCase();
      normalized[key] = serial || null;
      continue;
    }
    if (key === 'description') {
      const description = String(value || '').trim();
      normalized[key] = description || null;
      continue;
    }
    if (key === 'status' || key === 'lifecycle_status') {
      normalized[key] = String(value || '').trim().toLowerCase();
      continue;
    }
    if (key === 'warehouse_location') {
      normalized[key] = String(value || '').trim();
      continue;
    }
    if (key === 'quantity_on_hand' || key === 'quantity_reserved') {
      normalized[key] = Number(value ?? 0);
      continue;
    }
    normalized[key] = value;
  }
  return normalized;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  try {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'PATCH' && req.method !== 'DELETE') {
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    enforceHttps(req);
    enforceRateLimit(req);
    let auth: Awaited<ReturnType<typeof authenticateRequest>>;
    let access: Awaited<ReturnType<typeof resolveAndApplyAccessContext>>;
    try {
      auth = await authenticateRequest(req);
      ctx.userId = auth.userId;
      ctx.role = auth.role;
      enforceAnyPermission(auth.permissions || [], ['dashboards.view', 'view_amro_dashboard']);
      access = await resolveAndApplyAccessContext(req, ctx);
      await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    } catch (authError) {
      const diagnostics = buildPartsAuthDiagnostics(req, authError);
      res.status(diagnostics.http_status).json({
        error: diagnostics.http_status === 403 ? 'Forbidden' : 'Unauthorized',
        version: 'v2',
        correlationId: ctx.correlationId,
        auth_diagnostics: diagnostics,
      });
      return;
    }

    const tenantId = String(access.tenantId || '');
    const franchiseId = access.franchiseId ? String(access.franchiseId) : null;
    const id = String(req.query.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const { data: existing, error: existingError } = await supabase
      .from('parts_inventory')
      .select('id,tenant_id,franchise_id,part_number,serial_number,description,status,lifecycle_status,quantity_on_hand,quantity_reserved,quantity_available,warehouse_location,supplier_name,criticality,ata_chapter,reorder_level,metadata,created_at,updated_at')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .limit(1)
      .maybeSingle();
    if (existingError) throw new Error(`Failed to query part record: ${existingError.message}`);
    if (!existing) {
      res.status(404).json({ error: 'Record not found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    if (franchiseId && existing.franchise_id && String(existing.franchise_id) !== franchiseId) {
      res.status(403).json({ error: 'Forbidden', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    if (req.method === 'GET') {
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-parts-detail',
        output: { record: mapPartsInventoryRowToTemplate(existing as Record<string, unknown>) },
      });
      return;
    }

    if (req.method === 'DELETE') {
      const { error: deleteError } = await supabase
        .from('parts_inventory')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', id);
      if (deleteError) throw new Error(`Failed to delete part record: ${deleteError.message}`);

      await writePartsAuditLog({
        tenantId,
        userId: auth.userId,
        action: 'AMRO_PART_DELETE',
        partInventoryId: id,
        correlationId: ctx.correlationId,
        details: { previous: existing },
      });
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-parts-delete',
        output: { id, deleted: true },
      });
      return;
    }

    const payload = normalizeInventoryPatchPayload(asObject(req.body));
    const patch = {
      ...payload,
      part_number: payload.part_number ?? existing.part_number,
      serial_number: payload.serial_number ?? existing.serial_number,
      warehouse_location: payload.warehouse_location ?? existing.warehouse_location,
      quantity_on_hand: payload.quantity_on_hand ?? existing.quantity_on_hand,
      quantity_reserved: payload.quantity_reserved ?? existing.quantity_reserved,
      status: payload.status ?? existing.status,
      lifecycle_status: payload.lifecycle_status ?? existing.lifecycle_status,
    };
    const issues = validatePartsRecordInput(patch);
    if (issues.length > 0) {
      res.status(400).json({ error: 'Validation failed', issues, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    const updatePayload = {
      ...payload,
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    };
    if (Object.keys(payload).length === 0) {
      res.status(400).json({
        error: 'Validation failed',
        issues: [{ field: 'payload', message: 'No inventory fields provided for update' }],
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }
    const { data: updated, error: updateError } = await supabase
      .from('parts_inventory')
      .update(updatePayload)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select('id,part_number,serial_number,description,status,lifecycle_status,quantity_on_hand,quantity_reserved,quantity_available,warehouse_location,supplier_name,criticality,ata_chapter,reorder_level,created_at,updated_at')
      .limit(1)
      .maybeSingle();
    if (updateError) {
      res.status(400).json({
        error: 'Failed to update part record',
        issues: [{ field: 'payload', message: updateError.message }],
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }
    if (!updated) {
      res.status(404).json({
        error: 'Record not found after update attempt',
        issues: [{ field: 'id', message: 'No matching part record was updated' }],
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    const workflowEvents = resolveWorkflowTriggers({
      previous: existing as Record<string, unknown>,
      next: {
        ...(existing as Record<string, unknown>),
        ...updatePayload,
      },
    });
    await writePartsWorkflowEvents({
      tenantId,
      franchiseId,
      partInventoryId: id,
      events: workflowEvents,
      userId: auth.userId,
      correlationId: ctx.correlationId,
      payload: updatePayload as Record<string, unknown>,
    });
    await writePartsAuditLog({
      tenantId,
      userId: auth.userId,
      action: 'AMRO_PART_UPDATE',
      partInventoryId: id,
      correlationId: ctx.correlationId,
      details: {
        previous: existing,
        next: updatePayload,
        workflow_events: workflowEvents,
      },
    });

    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-parts-update',
      output: {
        record: mapPartsInventoryRowToTemplate(updated as Record<string, unknown>),
        workflow_events: workflowEvents,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
