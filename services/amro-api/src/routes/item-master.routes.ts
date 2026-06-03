import { Router } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

type JsonRecord = Record<string, unknown>;

const router = Router();

const ITEM_TYPES = new Set(['part', 'tool', 'consumable', 'kit']);
const ITEM_STATUSES = new Set(['active', 'inactive', 'deprecated', 'retired']);
const LIFECYCLE_STATUSES = new Set([
  'serviceable',
  'inspection_due',
  'needs_repair',
  'repair_in_progress',
  'ready_for_install',
  'replaced',
  'retired',
  'quarantined',
]);

function isEnabled(): boolean {
  const normalized = String(process.env.AMRO_ITEM_MASTER_V2_ENABLED || 'true').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function getSupabaseAdminClient(): SupabaseClient {
  const url = String(
    process.env.AMRO_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '',
  ).replace(/\/$/, '');
  const serviceKey = String(
    process.env.AMRO_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    '',
  ).trim();
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return createClient(url, serviceKey);
}

function asObject(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? value as JsonRecord : {};
}

function asNullableText(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function asUpperText(value: unknown, fallback = ''): string {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized || fallback;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function parsePagination(req: AuthRequest): { page: number; pageSize: number } {
  const page = Math.max(1, Number(req.query.page || 1) || 1);
  const pageSize = Math.max(1, Math.min(200, Number(req.query.page_size || req.query.pageSize || 50) || 50));
  return { page, pageSize };
}

function normalizeCrossReferences(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asObject(entry))
    .map((entry) => ({
      reference_type: String(entry.reference_type || entry.referenceType || 'alternate').trim().toLowerCase(),
      reference_part_number: asUpperText(entry.reference_part_number || entry.referencePartNumber || ''),
      reference_description: asNullableText(entry.reference_description || entry.referenceDescription),
      is_active: entry.is_active === undefined ? (entry.isActive === undefined ? true : Boolean(entry.isActive)) : Boolean(entry.is_active),
    }))
    .filter((entry) => String(entry.reference_part_number || '').trim().length > 0);
}

function normalizeUomConversions(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asObject(entry))
    .map((entry) => ({
      from_uom: asUpperText(entry.from_uom || entry.fromUom || 'EA', 'EA'),
      to_uom: asUpperText(entry.to_uom || entry.toUom || 'EA', 'EA'),
      factor: toFiniteNumber(entry.factor, 1),
      rounding_mode: String(entry.rounding_mode || entry.roundingMode || 'half_up').trim().toLowerCase(),
      is_active: entry.is_active === undefined ? (entry.isActive === undefined ? true : Boolean(entry.isActive)) : Boolean(entry.is_active),
    }))
    .filter((entry) =>
      String(entry.from_uom || '').trim().length > 0
      && String(entry.to_uom || '').trim().length > 0
      && Number(entry.factor) > 0,
    );
}

function mapItemMasterRowToTemplate(row: JsonRecord): JsonRecord {
  const crossRefs = Array.isArray(row.cross_references) ? row.cross_references : [];
  const uomConversions = Array.isArray(row.uom_conversions) ? row.uom_conversions : [];
  return {
    id: String(row.id || ''),
    partNumber: String(row.part_number || ''),
    description: asNullableText(row.description),
    itemType: String(row.item_type || 'part').toLowerCase(),
    category: asNullableText(row.category),
    subcategory: asNullableText(row.subcategory),
    status: String(row.status || 'active').toLowerCase(),
    lifecycleStatus: String(row.lifecycle_status || 'serviceable').toLowerCase(),
    specification: (row.specification && typeof row.specification === 'object') ? row.specification : {},
    manufacturerName: asNullableText(row.manufacturer_name),
    manufacturerPartNumber: asNullableText(row.manufacturer_part_number),
    oemPartNumber: asNullableText(row.oem_part_number),
    unitOfMeasure: asUpperText(row.unit_of_measure || 'EA', 'EA'),
    baseUnitOfMeasure: asUpperText(row.base_unit_of_measure || 'EA', 'EA'),
    uomConversionFactor: toFiniteNumber(row.uom_conversion_factor, 1),
    currency: asUpperText(row.currency || 'USD', 'USD'),
    isActive: Boolean(row.is_active ?? true),
    metadata: (row.metadata && typeof row.metadata === 'object') ? row.metadata : {},
    crossReferences: crossRefs.map((entry) => {
      const ref = asObject(entry);
      return {
        referenceType: String(ref.reference_type || 'alternate').toLowerCase(),
        referencePartNumber: asUpperText(ref.reference_part_number || ''),
        referenceDescription: asNullableText(ref.reference_description),
        isActive: Boolean(ref.is_active ?? true),
      };
    }),
    uomConversions: uomConversions.map((entry) => {
      const conversion = asObject(entry);
      return {
        fromUom: asUpperText(conversion.from_uom || 'EA', 'EA'),
        toUom: asUpperText(conversion.to_uom || 'EA', 'EA'),
        factor: toFiniteNumber(conversion.factor, 1),
        roundingMode: String(conversion.rounding_mode || 'half_up').toLowerCase(),
        isActive: Boolean(conversion.is_active ?? true),
      };
    }),
  };
}

function validateItemMasterPayload(payload: JsonRecord): Array<{ field: string; message: string }> {
  const issues: Array<{ field: string; message: string }> = [];
  const partNumber = asUpperText(payload.part_number || payload.partNumber || '');
  const itemType = String(payload.item_type || payload.itemType || 'part').trim().toLowerCase();
  const status = String(payload.status || 'active').trim().toLowerCase();
  const lifecycle = String(payload.lifecycle_status || payload.lifecycleStatus || 'serviceable').trim().toLowerCase();
  const factor = toFiniteNumber(payload.uom_conversion_factor ?? payload.uomConversionFactor, NaN);

  if (!partNumber) issues.push({ field: 'part_number', message: 'part_number is required' });
  if (partNumber && !/^[A-Z0-9-]{3,64}$/.test(partNumber)) issues.push({ field: 'part_number', message: 'part_number must match /^[A-Z0-9-]{3,64}$/' });
  if (!ITEM_TYPES.has(itemType)) issues.push({ field: 'item_type', message: 'item_type must be part, tool, consumable, or kit' });
  if (!ITEM_STATUSES.has(status)) issues.push({ field: 'status', message: 'status must be active, inactive, deprecated, or retired' });
  if (!LIFECYCLE_STATUSES.has(lifecycle)) issues.push({ field: 'lifecycle_status', message: 'lifecycle_status is invalid' });
  if (!Number.isFinite(factor) || factor <= 0) issues.push({ field: 'uom_conversion_factor', message: 'uom_conversion_factor must be > 0' });

  return issues;
}

router.get(
  '/amro/item-master',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }
    if (!req.tenantId) {
      res.status(401).json({ error: 'Missing tenant context', code: 'MISSING_TENANT', statusCode: 401 });
      return;
    }
    const tenantId = String(req.tenantId);
    const { page, pageSize } = parsePagination(req);
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim().toLowerCase();
    const itemType = String(req.query.item_type || req.query.itemType || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const supabase = getSupabaseAdminClient();

    // Step 9d read cutover: source is amro_v_item_master view
    // (uim.item_master joined with amro.part_profiles). Writes still
    // hit amro_item_master + dual-write trigger to uim.item_master.
    // Column names are byte-compatible with amro_item_master.
    let query = supabase
      .from('amro_v_item_master')
      .select('id,part_number,description,item_type,category,subcategory,status,lifecycle_status,specification,manufacturer_name,manufacturer_part_number,oem_part_number,unit_of_measure,base_unit_of_measure,uom_conversion_factor,currency,is_active,metadata,created_at,updated_at', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);
    if (itemType) query = query.eq('item_type', itemType);
    if (category) query = query.eq('category', category);
    if (search) {
      const escaped = search.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
      query = query.or(`part_number.ilike.%${escaped}%,description.ilike.%${escaped}%,manufacturer_part_number.ilike.%${escaped}%,oem_part_number.ilike.%${escaped}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      res.status(500).json({ error: `Failed to query item master records: ${error.message}`, code: 'ITEM_MASTER_QUERY_FAILED', statusCode: 500 });
      return;
    }

    res.status(200).json({
      version: 'v2',
      interface: 'amro-item-master-list',
      output: {
        page,
        page_size: pageSize,
        total: Number(count || 0),
        records: (data || []).map((row) => mapItemMasterRowToTemplate(row as JsonRecord)),
      },
    });
  }),
);

router.get(
  '/amro/item-master/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }
    if (!req.tenantId) {
      res.status(401).json({ error: 'Missing tenant context', code: 'MISSING_TENANT', statusCode: 401 });
      return;
    }
    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'VALIDATION_ERROR', statusCode: 400 });
      return;
    }
    const supabase = getSupabaseAdminClient();
    const tenantId = String(req.tenantId);

    // Step 9d read cutover: see list route above.
    const { data, error } = await supabase
      .from('amro_v_item_master')
      .select('id,part_number,description,item_type,category,subcategory,status,lifecycle_status,specification,manufacturer_name,manufacturer_part_number,oem_part_number,unit_of_measure,base_unit_of_measure,uom_conversion_factor,currency,is_active,metadata,created_at,updated_at')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .limit(1)
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: `Failed to query item master record: ${error.message}`, code: 'ITEM_MASTER_QUERY_FAILED', statusCode: 500 });
      return;
    }
    if (!data) {
      res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }

    const [{ data: crossRefs }, { data: uomConversions }] = await Promise.all([
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
      interface: 'amro-item-master-detail',
      output: {
        record: mapItemMasterRowToTemplate({
          ...(data as JsonRecord),
          cross_references: crossRefs || [],
          uom_conversions: uomConversions || [],
        }),
      },
    });
  }),
);

router.post(
  '/amro/item-master',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }
    if (!req.tenantId || !req.userId) {
      res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
      return;
    }
    const payload = asObject(req.body);
    const issues = validateItemMasterPayload(payload);
    if (issues.length > 0) {
      res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', statusCode: 400, issues });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const tenantId = String(req.tenantId);
    const franchiseId = req.headers['x-franchise-id'] ? String(req.headers['x-franchise-id']) : null;
    const now = new Date().toISOString();
    const rowToCreate = {
      tenant_id: tenantId,
      franchise_id: franchiseId,
      part_number: asUpperText(payload.part_number || payload.partNumber || ''),
      description: asNullableText(payload.description),
      item_type: String(payload.item_type || payload.itemType || 'part').trim().toLowerCase(),
      category: asNullableText(payload.category),
      subcategory: asNullableText(payload.subcategory),
      status: String(payload.status || 'active').trim().toLowerCase(),
      lifecycle_status: String(payload.lifecycle_status || payload.lifecycleStatus || 'serviceable').trim().toLowerCase(),
      specification: payload.specification && typeof payload.specification === 'object' ? payload.specification : {},
      manufacturer_name: asNullableText(payload.manufacturer_name || payload.manufacturerName),
      manufacturer_part_number: asNullableText(payload.manufacturer_part_number || payload.manufacturerPartNumber),
      oem_part_number: asNullableText(payload.oem_part_number || payload.oemPartNumber),
      unit_of_measure: asUpperText(payload.unit_of_measure || payload.unitOfMeasure || 'EA', 'EA'),
      base_unit_of_measure: asUpperText(payload.base_unit_of_measure || payload.baseUnitOfMeasure || 'EA', 'EA'),
      uom_conversion_factor: toFiniteNumber(payload.uom_conversion_factor ?? payload.uomConversionFactor, 1),
      currency: asUpperText(payload.currency || 'USD', 'USD'),
      is_active: payload.is_active === undefined ? (payload.isActive === undefined ? true : Boolean(payload.isActive)) : Boolean(payload.is_active),
      metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
      created_by: req.userId,
      updated_by: req.userId,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('amro_item_master')
      .insert(rowToCreate)
      .select('id,part_number,description,item_type,category,subcategory,status,lifecycle_status,specification,manufacturer_name,manufacturer_part_number,oem_part_number,unit_of_measure,base_unit_of_measure,uom_conversion_factor,currency,is_active,metadata,created_at,updated_at')
      .limit(1)
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: `Failed to create item master record: ${error.message}`, code: 'ITEM_MASTER_CREATE_FAILED', statusCode: 500 });
      return;
    }

    const itemMasterId = String(data?.id || '');
    const crossReferences = normalizeCrossReferences(payload.cross_references || payload.crossReferences);
    const uomConversions = normalizeUomConversions(payload.uom_conversions || payload.uomConversions);

    if (itemMasterId && crossReferences.length > 0) {
      const rows = crossReferences.map((entry) => ({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        item_master_id: itemMasterId,
        reference_type: entry.reference_type,
        reference_part_number: entry.reference_part_number,
        reference_description: entry.reference_description || null,
        is_active: Boolean(entry.is_active ?? true),
        created_by: req.userId,
        updated_by: req.userId,
      }));
      const { error: crossRefError } = await supabase.from('amro_item_cross_references').insert(rows);
      if (crossRefError) {
        res.status(500).json({ error: `Failed to create item cross references: ${crossRefError.message}`, code: 'ITEM_MASTER_CROSS_REF_CREATE_FAILED', statusCode: 500 });
        return;
      }
    }
    if (itemMasterId && uomConversions.length > 0) {
      const rows = uomConversions.map((entry) => ({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        item_master_id: itemMasterId,
        from_uom: entry.from_uom,
        to_uom: entry.to_uom,
        factor: entry.factor,
        rounding_mode: entry.rounding_mode,
        is_active: Boolean(entry.is_active ?? true),
        created_by: req.userId,
        updated_by: req.userId,
      }));
      const { error: uomError } = await supabase.from('amro_item_uom_conversions').insert(rows);
      if (uomError) {
        res.status(500).json({ error: `Failed to create UOM conversions: ${uomError.message}`, code: 'ITEM_MASTER_UOM_CREATE_FAILED', statusCode: 500 });
        return;
      }
    }

    res.status(201).json({
      version: 'v2',
      interface: 'amro-item-master-create',
      output: {
        record: mapItemMasterRowToTemplate((data || {}) as JsonRecord),
      },
    });
  }),
);

router.patch(
  '/amro/item-master/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }
    if (!req.tenantId || !req.userId) {
      res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
      return;
    }
    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'VALIDATION_ERROR', statusCode: 400 });
      return;
    }
    const payload = asObject(req.body);
    const supabase = getSupabaseAdminClient();
    const tenantId = String(req.tenantId);
    const franchiseId = req.headers['x-franchise-id'] ? String(req.headers['x-franchise-id']) : null;

    const updatePayload: JsonRecord = {
      updated_by: req.userId,
      updated_at: new Date().toISOString(),
    };
    const assignIfDefined = (field: string, value: unknown) => {
      if (value !== undefined) updatePayload[field] = value;
    };
    assignIfDefined('part_number', payload.part_number !== undefined || payload.partNumber !== undefined ? asUpperText(payload.part_number || payload.partNumber || '') : undefined);
    assignIfDefined('description', payload.description !== undefined ? asNullableText(payload.description) : undefined);
    assignIfDefined('item_type', payload.item_type !== undefined || payload.itemType !== undefined ? String(payload.item_type || payload.itemType || '').trim().toLowerCase() : undefined);
    assignIfDefined('category', payload.category !== undefined ? asNullableText(payload.category) : undefined);
    assignIfDefined('subcategory', payload.subcategory !== undefined ? asNullableText(payload.subcategory) : undefined);
    assignIfDefined('status', payload.status !== undefined ? String(payload.status || '').trim().toLowerCase() : undefined);
    assignIfDefined('lifecycle_status', payload.lifecycle_status !== undefined || payload.lifecycleStatus !== undefined ? String(payload.lifecycle_status || payload.lifecycleStatus || '').trim().toLowerCase() : undefined);
    assignIfDefined('specification', payload.specification !== undefined ? (payload.specification && typeof payload.specification === 'object' ? payload.specification : {}) : undefined);
    assignIfDefined('manufacturer_name', payload.manufacturer_name !== undefined || payload.manufacturerName !== undefined ? asNullableText(payload.manufacturer_name || payload.manufacturerName) : undefined);
    assignIfDefined('manufacturer_part_number', payload.manufacturer_part_number !== undefined || payload.manufacturerPartNumber !== undefined ? asNullableText(payload.manufacturer_part_number || payload.manufacturerPartNumber) : undefined);
    assignIfDefined('oem_part_number', payload.oem_part_number !== undefined || payload.oemPartNumber !== undefined ? asNullableText(payload.oem_part_number || payload.oemPartNumber) : undefined);
    assignIfDefined('unit_of_measure', payload.unit_of_measure !== undefined || payload.unitOfMeasure !== undefined ? asUpperText(payload.unit_of_measure || payload.unitOfMeasure || 'EA', 'EA') : undefined);
    assignIfDefined('base_unit_of_measure', payload.base_unit_of_measure !== undefined || payload.baseUnitOfMeasure !== undefined ? asUpperText(payload.base_unit_of_measure || payload.baseUnitOfMeasure || 'EA', 'EA') : undefined);
    assignIfDefined('uom_conversion_factor', payload.uom_conversion_factor !== undefined || payload.uomConversionFactor !== undefined ? toFiniteNumber(payload.uom_conversion_factor ?? payload.uomConversionFactor, 1) : undefined);
    assignIfDefined('currency', payload.currency !== undefined ? asUpperText(payload.currency || 'USD', 'USD') : undefined);
    assignIfDefined('is_active', payload.is_active !== undefined || payload.isActive !== undefined ? (payload.is_active === undefined ? Boolean(payload.isActive) : Boolean(payload.is_active)) : undefined);
    assignIfDefined('metadata', payload.metadata !== undefined ? (payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}) : undefined);

    const mergedForValidation = { ...payload, ...updatePayload };
    const issues = validateItemMasterPayload(mergedForValidation);
    if (issues.length > 0) {
      res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', statusCode: 400, issues });
      return;
    }

    const { data, error } = await supabase
      .from('amro_item_master')
      .update(updatePayload)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select('id,part_number,description,item_type,category,subcategory,status,lifecycle_status,specification,manufacturer_name,manufacturer_part_number,oem_part_number,unit_of_measure,base_unit_of_measure,uom_conversion_factor,currency,is_active,metadata,created_at,updated_at')
      .limit(1)
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: `Failed to update item master record: ${error.message}`, code: 'ITEM_MASTER_UPDATE_FAILED', statusCode: 500 });
      return;
    }
    if (!data) {
      res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }

    if (Array.isArray(payload.cross_references) || Array.isArray(payload.crossReferences)) {
      const crossRefs = normalizeCrossReferences(payload.cross_references || payload.crossReferences);
      const { error: deleteError } = await supabase
        .from('amro_item_cross_references')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('item_master_id', id);
      if (deleteError) {
        res.status(500).json({ error: `Failed to replace item cross references: ${deleteError.message}`, code: 'ITEM_MASTER_CROSS_REF_UPDATE_FAILED', statusCode: 500 });
        return;
      }
      if (crossRefs.length > 0) {
        const rows = crossRefs.map((entry) => ({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          item_master_id: id,
          reference_type: entry.reference_type,
          reference_part_number: entry.reference_part_number,
          reference_description: entry.reference_description || null,
          is_active: Boolean(entry.is_active ?? true),
          created_by: req.userId,
          updated_by: req.userId,
        }));
        const { error: insertError } = await supabase.from('amro_item_cross_references').insert(rows);
        if (insertError) {
          res.status(500).json({ error: `Failed to save item cross references: ${insertError.message}`, code: 'ITEM_MASTER_CROSS_REF_UPDATE_FAILED', statusCode: 500 });
          return;
        }
      }
    }

    if (Array.isArray(payload.uom_conversions) || Array.isArray(payload.uomConversions)) {
      const uomConversions = normalizeUomConversions(payload.uom_conversions || payload.uomConversions);
      const { error: deleteError } = await supabase
        .from('amro_item_uom_conversions')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('item_master_id', id);
      if (deleteError) {
        res.status(500).json({ error: `Failed to replace UOM conversions: ${deleteError.message}`, code: 'ITEM_MASTER_UOM_UPDATE_FAILED', statusCode: 500 });
        return;
      }
      if (uomConversions.length > 0) {
        const rows = uomConversions.map((entry) => ({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          item_master_id: id,
          from_uom: entry.from_uom,
          to_uom: entry.to_uom,
          factor: entry.factor,
          rounding_mode: entry.rounding_mode,
          is_active: Boolean(entry.is_active ?? true),
          created_by: req.userId,
          updated_by: req.userId,
        }));
        const { error: insertError } = await supabase.from('amro_item_uom_conversions').insert(rows);
        if (insertError) {
          res.status(500).json({ error: `Failed to save UOM conversions: ${insertError.message}`, code: 'ITEM_MASTER_UOM_UPDATE_FAILED', statusCode: 500 });
          return;
        }
      }
    }

    res.status(200).json({
      version: 'v2',
      interface: 'amro-item-master-update',
      output: {
        record: mapItemMasterRowToTemplate((data || {}) as JsonRecord),
      },
    });
  }),
);

router.delete(
  '/amro/item-master/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }
    if (!req.tenantId || !req.userId) {
      res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
      return;
    }
    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'VALIDATION_ERROR', statusCode: 400 });
      return;
    }
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from('amro_item_master')
      .delete()
      .eq('tenant_id', req.tenantId)
      .eq('id', id);
    if (error) {
      res.status(500).json({ error: `Failed to delete item master record: ${error.message}`, code: 'ITEM_MASTER_DELETE_FAILED', statusCode: 500 });
      return;
    }
    res.status(200).json({
      version: 'v2',
      interface: 'amro-item-master-delete',
      output: { id, deleted: true },
    });
  }),
);

export default router;
