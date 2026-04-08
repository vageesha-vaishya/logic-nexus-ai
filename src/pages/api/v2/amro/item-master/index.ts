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
  mapTemplateToItemMasterRow,
  parsePagination,
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

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const startedAt = Date.now();
  try {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
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
    const supabase = getSupabaseAdminClient();

    if (req.method === 'GET') {
      const { page, pageSize } = parsePagination(req);
      const search = String(req.query.search || '').trim();
      const status = String(req.query.status || '').trim().toLowerCase();
      const itemType = String(req.query.item_type || req.query.itemType || '').trim().toLowerCase();
      const category = String(req.query.category || '').trim();
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('amro_item_master')
        .select('id,part_number,description,item_type,category,subcategory,status,lifecycle_status,specification,manufacturer_name,manufacturer_part_number,oem_part_number,unit_of_measure,base_unit_of_measure,uom_conversion_factor,currency,is_active,metadata,created_at,updated_at', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .range(from, to);

      if (franchiseId) query = query.eq('franchise_id', franchiseId);
      if (status) query = query.eq('status', status);
      if (itemType) query = query.eq('item_type', itemType);
      if (category) query = query.eq('category', category);
      if (search) {
        const escaped = search.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
        query = query.or(`part_number.ilike.%${escaped}%,description.ilike.%${escaped}%,manufacturer_part_number.ilike.%${escaped}%,oem_part_number.ilike.%${escaped}%`);
      }

      const { data, error, count } = await query;
      if (error) throw new Error(`Failed to query item master: ${error.message}`);

      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-item-master-list',
        output: {
          page,
          page_size: pageSize,
          total: Number(count || 0),
          latency_ms: Date.now() - startedAt,
          records: (data || []).map((row) => mapItemMasterRowToTemplate(row as Record<string, unknown>)),
        },
      });
      return;
    }

    const payload = asObject(req.body);
    const crossReferences = asCrossReferences(payload.cross_references || payload.crossReferences);
    const uomConversions = asUomConversions(payload.uom_conversions || payload.uomConversions);
    const mapped = mapTemplateToItemMasterRow({
      partNumber: String(payload.part_number || payload.partNumber || ''),
      description: String(payload.description || '') || null,
      itemType: String(payload.item_type || payload.itemType || 'part') as never,
      category: String(payload.category || '') || null,
      subcategory: String(payload.subcategory || '') || null,
      status: String(payload.status || 'active') as never,
      lifecycleStatus: String(payload.lifecycle_status || payload.lifecycleStatus || 'serviceable') as never,
      specification: (payload.specification && typeof payload.specification === 'object') ? payload.specification as Record<string, unknown> : {},
      manufacturerName: String(payload.manufacturer_name || payload.manufacturerName || '') || null,
      manufacturerPartNumber: String(payload.manufacturer_part_number || payload.manufacturerPartNumber || '') || null,
      oemPartNumber: String(payload.oem_part_number || payload.oemPartNumber || '') || null,
      unitOfMeasure: String(payload.unit_of_measure || payload.unitOfMeasure || 'EA'),
      baseUnitOfMeasure: String(payload.base_unit_of_measure || payload.baseUnitOfMeasure || 'EA'),
      uomConversionFactor: Number(payload.uom_conversion_factor ?? payload.uomConversionFactor ?? 1),
      currency: String(payload.currency || 'USD'),
      isActive: payload.is_active === undefined ? true : Boolean(payload.is_active),
      metadata: (payload.metadata && typeof payload.metadata === 'object') ? payload.metadata as Record<string, unknown> : {},
    });
    const issues = validateItemMasterInput(mapped);
    if (issues.length > 0) {
      res.status(400).json({ error: 'Validation failed', issues, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    const now = new Date().toISOString();
    const rowToCreate = {
      ...mapped,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      created_by: auth.userId,
      updated_by: auth.userId,
      created_at: now,
      updated_at: now,
    };
    const { data: inserted, error: insertError } = await supabase
      .from('amro_item_master')
      .insert(rowToCreate)
      .select('id,part_number,description,item_type,category,subcategory,status,lifecycle_status,specification,manufacturer_name,manufacturer_part_number,oem_part_number,unit_of_measure,base_unit_of_measure,uom_conversion_factor,currency,is_active,metadata,created_at,updated_at')
      .limit(1)
      .maybeSingle();
    if (insertError) throw new Error(`Failed to create item master record: ${insertError.message}`);

    const insertedId = String(inserted?.id || '');
    if (insertedId && crossReferences.length > 0) {
      const rows = crossReferences.map((entry) => ({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        item_master_id: insertedId,
        reference_type: entry.reference_type,
        reference_part_number: entry.reference_part_number,
        reference_description: entry.reference_description || null,
        is_active: entry.is_active,
        created_by: auth.userId,
        updated_by: auth.userId,
      }));
      const { error: crossRefError } = await supabase.from('amro_item_cross_references').insert(rows);
      if (crossRefError) throw new Error(`Failed to create item cross references: ${crossRefError.message}`);
    }
    if (insertedId && uomConversions.length > 0) {
      const rows = uomConversions.map((entry) => ({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        item_master_id: insertedId,
        from_uom: entry.from_uom,
        to_uom: entry.to_uom,
        factor: entry.factor,
        rounding_mode: entry.rounding_mode,
        is_active: entry.is_active,
        created_by: auth.userId,
        updated_by: auth.userId,
      }));
      const { error: uomError } = await supabase.from('amro_item_uom_conversions').insert(rows);
      if (uomError) throw new Error(`Failed to create UOM conversions: ${uomError.message}`);
    }
    await writeItemMasterAuditLog({
      tenantId,
      userId: auth.userId,
      action: 'AMRO_ITEM_MASTER_CREATE',
      itemMasterId: insertedId,
      correlationId: ctx.correlationId,
      details: { payload: rowToCreate },
    });

    res.status(201).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-item-master-create',
      output: {
        record: mapItemMasterRowToTemplate(inserted as Record<string, unknown>),
        latency_ms: Date.now() - startedAt,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
