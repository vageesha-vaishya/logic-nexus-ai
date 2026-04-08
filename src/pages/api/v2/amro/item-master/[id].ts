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
  mapItemMasterRowToTemplate,
  validateItemMasterInput,
  writeItemMasterAuditLog,
} from './shared';

function isEnabled(): boolean {
  const normalized = String(process.env.AMRO_ITEM_MASTER_V2_ENABLED || 'true').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asCrossReferences(value: unknown): Array<{
  reference_type: 'alternate' | 'superseded_by' | 'supersedes' | 'vendor' | 'oem';
  reference_part_number: string;
  reference_description?: string | null;
  is_active: boolean;
}> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}))
    .map((entry) => ({
      reference_type: String(entry.reference_type || entry.referenceType || 'alternate').trim().toLowerCase() as never,
      reference_part_number: String(entry.reference_part_number || entry.referencePartNumber || '').trim().toUpperCase(),
      reference_description: String(entry.reference_description || entry.referenceDescription || '').trim() || null,
      is_active: entry.is_active === undefined ? (entry.isActive === undefined ? true : Boolean(entry.isActive)) : Boolean(entry.is_active),
    }))
    .filter((entry) => entry.reference_part_number.length > 0);
}

function asUomConversions(value: unknown): Array<{
  from_uom: string;
  to_uom: string;
  factor: number;
  rounding_mode: 'half_up' | 'up' | 'down';
  is_active: boolean;
}> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}))
    .map((entry) => ({
      from_uom: String(entry.from_uom || entry.fromUom || 'EA').trim().toUpperCase(),
      to_uom: String(entry.to_uom || entry.toUom || 'EA').trim().toUpperCase(),
      factor: Number(entry.factor ?? 1),
      rounding_mode: String(entry.rounding_mode || entry.roundingMode || 'half_up').trim().toLowerCase() as never,
      is_active: entry.is_active === undefined ? (entry.isActive === undefined ? true : Boolean(entry.isActive)) : Boolean(entry.is_active),
    }))
    .filter((entry) => entry.from_uom.length > 0 && entry.to_uom.length > 0 && Number.isFinite(entry.factor) && entry.factor > 0);
}

const ITEM_MASTER_ALLOWED_KEYS = new Set([
  'part_number',
  'description',
  'item_type',
  'category',
  'subcategory',
  'status',
  'lifecycle_status',
  'specification',
  'manufacturer_name',
  'manufacturer_part_number',
  'oem_part_number',
  'unit_of_measure',
  'base_unit_of_measure',
  'uom_conversion_factor',
  'currency',
  'is_active',
  'metadata',
]);

function normalizeItemMasterPatchPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!ITEM_MASTER_ALLOWED_KEYS.has(key)) continue;
    if (value === undefined) continue;
    if (key === 'part_number') {
      normalized[key] = String(value || '').trim().toUpperCase();
      continue;
    }
    if (key === 'item_type' || key === 'status' || key === 'lifecycle_status') {
      normalized[key] = String(value || '').trim().toLowerCase();
      continue;
    }
    if (key === 'description' || key === 'category' || key === 'subcategory' || key === 'manufacturer_name' || key === 'manufacturer_part_number' || key === 'oem_part_number') {
      const text = String(value || '').trim();
      normalized[key] = text || null;
      continue;
    }
    if (key === 'unit_of_measure' || key === 'base_unit_of_measure' || key === 'currency') {
      normalized[key] = String(value || '').trim().toUpperCase();
      continue;
    }
    if (key === 'uom_conversion_factor') {
      normalized[key] = Number(value ?? 1);
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
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    enforceAnyPermission(auth.permissions || [], ['dashboards.view', 'view_amro_dashboard']);
    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });

    const tenantId = String(access.tenantId || '');
    const franchiseId = access.franchiseId ? String(access.franchiseId) : null;
    const id = String(req.query.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const { data: existing, error: existingError } = await supabase
      .from('amro_item_master')
      .select('id,tenant_id,franchise_id,part_number,description,item_type,category,subcategory,status,lifecycle_status,specification,manufacturer_name,manufacturer_part_number,oem_part_number,unit_of_measure,base_unit_of_measure,uom_conversion_factor,currency,is_active,metadata,created_at,updated_at')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .limit(1)
      .maybeSingle();
    if (existingError) throw new Error(`Failed to query item master record: ${existingError.message}`);
    if (!existing) {
      res.status(404).json({ error: 'Record not found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    if (franchiseId && existing.franchise_id && String(existing.franchise_id) !== franchiseId) {
      res.status(403).json({ error: 'Forbidden', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    if (req.method === 'GET') {
      const [{ data: crossReferences }, { data: uomConversions }] = await Promise.all([
        supabase
          .from('amro_item_cross_references')
          .select('id,reference_type,reference_part_number,reference_description,is_active')
          .eq('tenant_id', tenantId)
          .eq('item_master_id', id)
          .order('created_at', { ascending: true }),
        supabase
          .from('amro_item_uom_conversions')
          .select('id,from_uom,to_uom,factor,rounding_mode,is_active')
          .eq('tenant_id', tenantId)
          .eq('item_master_id', id)
          .order('created_at', { ascending: true }),
      ]);
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-item-master-detail',
        output: {
          record: mapItemMasterRowToTemplate({
            ...(existing as Record<string, unknown>),
            cross_references: crossReferences || [],
            uom_conversions: uomConversions || [],
          }),
        },
      });
      return;
    }

    if (req.method === 'DELETE') {
      const { error: deleteError } = await supabase
        .from('amro_item_master')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', id);
      if (deleteError) throw new Error(`Failed to delete item master record: ${deleteError.message}`);

      await writeItemMasterAuditLog({
        tenantId,
        userId: auth.userId,
        action: 'AMRO_ITEM_MASTER_DELETE',
        itemMasterId: id,
        correlationId: ctx.correlationId,
        details: { previous: existing },
      });
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-item-master-delete',
        output: { id, deleted: true },
      });
      return;
    }

    const payload = normalizeItemMasterPatchPayload(asObject(req.body));
    const body = asObject(req.body);
    const crossReferences = asCrossReferences(body.cross_references || body.crossReferences);
    const uomConversions = asUomConversions(body.uom_conversions || body.uomConversions);
    if (Object.keys(payload).length === 0) {
      res.status(400).json({
        error: 'Validation failed',
        issues: [{ field: 'payload', message: 'No item master fields provided for update' }],
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    const patch = {
      ...(existing as Record<string, unknown>),
      ...payload,
    };
    const issues = validateItemMasterInput(patch);
    if (issues.length > 0) {
      res.status(400).json({ error: 'Validation failed', issues, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    const updatePayload = {
      ...payload,
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    };
    const { data: updated, error: updateError } = await supabase
      .from('amro_item_master')
      .update(updatePayload)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select('id,part_number,description,item_type,category,subcategory,status,lifecycle_status,specification,manufacturer_name,manufacturer_part_number,oem_part_number,unit_of_measure,base_unit_of_measure,uom_conversion_factor,currency,is_active,metadata,created_at,updated_at')
      .limit(1)
      .maybeSingle();
    if (updateError) {
      res.status(400).json({
        error: 'Failed to update item master record',
        issues: [{ field: 'payload', message: updateError.message }],
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    await writeItemMasterAuditLog({
      tenantId,
      userId: auth.userId,
      action: 'AMRO_ITEM_MASTER_UPDATE',
      itemMasterId: id,
      correlationId: ctx.correlationId,
      details: { previous: existing, next: updatePayload },
    });

    if (Array.isArray(body.cross_references) || Array.isArray(body.crossReferences)) {
      const { error: deleteCrossRefError } = await supabase
        .from('amro_item_cross_references')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('item_master_id', id);
      if (deleteCrossRefError) throw new Error(`Failed to replace item cross references: ${deleteCrossRefError.message}`);
      if (crossReferences.length > 0) {
        const rows = crossReferences.map((entry) => ({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          item_master_id: id,
          reference_type: entry.reference_type,
          reference_part_number: entry.reference_part_number,
          reference_description: entry.reference_description || null,
          is_active: entry.is_active,
          created_by: auth.userId,
          updated_by: auth.userId,
        }));
        const { error: insertCrossRefError } = await supabase.from('amro_item_cross_references').insert(rows);
        if (insertCrossRefError) throw new Error(`Failed to save item cross references: ${insertCrossRefError.message}`);
      }
    }

    if (Array.isArray(body.uom_conversions) || Array.isArray(body.uomConversions)) {
      const { error: deleteUomError } = await supabase
        .from('amro_item_uom_conversions')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('item_master_id', id);
      if (deleteUomError) throw new Error(`Failed to replace UOM conversions: ${deleteUomError.message}`);
      if (uomConversions.length > 0) {
        const rows = uomConversions.map((entry) => ({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          item_master_id: id,
          from_uom: entry.from_uom,
          to_uom: entry.to_uom,
          factor: entry.factor,
          rounding_mode: entry.rounding_mode,
          is_active: entry.is_active,
          created_by: auth.userId,
          updated_by: auth.userId,
        }));
        const { error: insertUomError } = await supabase.from('amro_item_uom_conversions').insert(rows);
        if (insertUomError) throw new Error(`Failed to save UOM conversions: ${insertUomError.message}`);
      }
    }

    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-item-master-update',
      output: {
        record: mapItemMasterRowToTemplate(updated as Record<string, unknown>),
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
