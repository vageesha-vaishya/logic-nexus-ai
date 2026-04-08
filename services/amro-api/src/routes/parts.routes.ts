import { Router } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

type JsonRecord = Record<string, unknown>;

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

function parsePagination(req: AuthRequest): { page: number; pageSize: number } {
  const page = Math.max(1, Number(req.query.page || 1) || 1);
  const pageSize = Math.max(1, Math.min(200, Number(req.query.page_size || req.query.pageSize || 50) || 50));
  return { page, pageSize };
}

function asObject(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function mapRowToTemplateRecord(row: JsonRecord): JsonRecord {
  return {
    id: String(row.id || ''),
    partNumber: String(row.part_number || ''),
    serialNumber: row.serial_number ? String(row.serial_number) : null,
    description: row.description ? String(row.description) : null,
    status: String(row.status || 'available'),
    lifecycleStatus: row.lifecycle_status ? String(row.lifecycle_status) : 'serviceable',
    quantityOnHand: Number(row.quantity_on_hand || 0),
    quantityReserved: Number(row.quantity_reserved || 0),
    warehouseLocation: String(row.warehouse_location || ''),
    supplierName: row.supplier_name ? String(row.supplier_name) : null,
    criticality: String(row.criticality || 'normal'),
    ataChapter: row.ata_chapter ? String(row.ata_chapter) : null,
  };
}

router.get(
  '/amro/parts',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.tenantId) {
      res.status(401).json({ error: 'Missing tenant context', code: 'MISSING_TENANT', statusCode: 401 });
      return;
    }
    const tenantId = String(req.tenantId);
    const { page, pageSize } = parsePagination(req);
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim().toLowerCase();
    const lifecycleStatus = String(req.query.lifecycle_status || req.query.lifecycleStatus || '').trim().toLowerCase();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('parts_inventory')
      .select(
        'id,part_number,serial_number,description,status,lifecycle_status,quantity_on_hand,quantity_reserved,warehouse_location,supplier_name,criticality,ata_chapter,updated_at',
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);
    if (lifecycleStatus) query = query.eq('lifecycle_status', lifecycleStatus);
    if (search) {
      const escaped = search.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
      query = query.or(
        `part_number.ilike.%${escaped}%,serial_number.ilike.%${escaped}%,description.ilike.%${escaped}%,supplier_name.ilike.%${escaped}%`,
      );
    }

    const { data, error, count } = await query;
    if (error) {
      res.status(500).json({ error: `Failed to query parts inventory: ${error.message}`, code: 'PARTS_QUERY_FAILED', statusCode: 500 });
      return;
    }

    res.status(200).json({
      version: 'v2',
      interface: 'amro-parts-list',
      output: {
        page,
        page_size: pageSize,
        total: Number(count || 0),
        records: (data || []).map((row) => mapRowToTemplateRecord(row as JsonRecord)),
      },
    });
  }),
);

router.get(
  '/amro/parts/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.tenantId) {
      res.status(401).json({ error: 'Missing tenant context', code: 'MISSING_TENANT', statusCode: 401 });
      return;
    }
    const tenantId = String(req.tenantId);
    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required', code: 'VALIDATION_ERROR', statusCode: 400 });
      return;
    }
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('parts_inventory')
      .select('id,part_number,serial_number,description,status,lifecycle_status,quantity_on_hand,quantity_reserved,warehouse_location,supplier_name,criticality,ata_chapter')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .limit(1)
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: `Failed to query part record: ${error.message}`, code: 'PARTS_QUERY_FAILED', statusCode: 500 });
      return;
    }
    if (!data) {
      res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }
    res.status(200).json({
      version: 'v2',
      interface: 'amro-parts-detail',
      output: { record: mapRowToTemplateRecord(data as JsonRecord) },
    });
  }),
);

router.post(
  '/amro/parts',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.tenantId || !req.userId) {
      res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
      return;
    }
    const payload = asObject(req.body);
    const partNumber = String(payload.part_number || payload.partNumber || '').trim().toUpperCase();
    const warehouseLocation = String(payload.warehouse_location || payload.warehouseLocation || '').trim();
    if (!partNumber || !warehouseLocation) {
      res.status(400).json({ error: 'part_number and warehouse_location are required', code: 'VALIDATION_ERROR', statusCode: 400 });
      return;
    }
    const supabase = getSupabaseAdminClient();
    const insertPayload = {
      tenant_id: req.tenantId,
      part_number: partNumber,
      serial_number: String(payload.serial_number || payload.serialNumber || '').trim() || null,
      description: String(payload.description || '').trim() || null,
      status: String(payload.status || 'available').toLowerCase(),
      lifecycle_status: String(payload.lifecycle_status || payload.lifecycleStatus || 'serviceable').toLowerCase(),
      quantity_on_hand: Number(payload.quantity_on_hand ?? payload.quantityOnHand ?? 0),
      quantity_reserved: Number(payload.quantity_reserved ?? payload.quantityReserved ?? 0),
      warehouse_location: warehouseLocation,
      supplier_name: String(payload.supplier_name || payload.supplierName || '').trim() || null,
      criticality: String(payload.criticality || 'normal').toLowerCase(),
      ata_chapter: String(payload.ata_chapter || payload.ataChapter || '').trim() || null,
      created_by: req.userId,
      updated_by: req.userId,
    };

    const { data, error } = await supabase
      .from('parts_inventory')
      .insert(insertPayload)
      .select('id,part_number,serial_number,description,status,lifecycle_status,quantity_on_hand,quantity_reserved,warehouse_location,supplier_name,criticality,ata_chapter')
      .limit(1)
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: `Failed to create parts inventory record: ${error.message}`, code: 'PARTS_CREATE_FAILED', statusCode: 500 });
      return;
    }
    res.status(201).json({
      version: 'v2',
      interface: 'amro-parts-create',
      output: { record: mapRowToTemplateRecord((data || {}) as JsonRecord), workflow_events: [] },
    });
  }),
);

router.patch(
  '/amro/parts/:id',
  asyncHandler(async (req: AuthRequest, res) => {
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
    const updatePayload: JsonRecord = {
      updated_by: req.userId,
      updated_at: new Date().toISOString(),
    };
    for (const [key, value] of Object.entries(payload)) {
      updatePayload[key] = value;
    }
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('parts_inventory')
      .update(updatePayload)
      .eq('tenant_id', req.tenantId)
      .eq('id', id)
      .select('id,part_number,serial_number,description,status,lifecycle_status,quantity_on_hand,quantity_reserved,warehouse_location,supplier_name,criticality,ata_chapter')
      .limit(1)
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: `Failed to update part record: ${error.message}`, code: 'PARTS_UPDATE_FAILED', statusCode: 500 });
      return;
    }
    if (!data) {
      res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND', statusCode: 404 });
      return;
    }
    res.status(200).json({
      version: 'v2',
      interface: 'amro-parts-update',
      output: { record: mapRowToTemplateRecord(data as JsonRecord), workflow_events: [] },
    });
  }),
);

router.delete(
  '/amro/parts/:id',
  asyncHandler(async (req: AuthRequest, res) => {
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
    const { error } = await supabase.from('parts_inventory').delete().eq('tenant_id', req.tenantId).eq('id', id);
    if (error) {
      res.status(500).json({ error: `Failed to delete part record: ${error.message}`, code: 'PARTS_DELETE_FAILED', statusCode: 500 });
      return;
    }
    res.status(200).json({
      version: 'v2',
      interface: 'amro-parts-delete',
      output: { id, deleted: true },
    });
  }),
);

export default router;

