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
  mapTemplateToPartsInventoryRow,
  parsePagination,
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
    const supabase = getSupabaseAdminClient();

    if (req.method === 'GET') {
      const { page, pageSize } = parsePagination(req);
      const search = String(req.query.search || '').trim();
      const status = String(req.query.status || '').trim().toLowerCase();
      const lifecycleStatus = String(req.query.lifecycle_status || req.query.lifecycleStatus || '').trim().toLowerCase();
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('parts_inventory')
        .select('id,part_number,serial_number,description,status,lifecycle_status,quantity_on_hand,quantity_reserved,quantity_available,warehouse_location,supplier_name,criticality,ata_chapter,reorder_level,created_at,updated_at', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .range(from, to);

      if (status) query = query.eq('status', status);
      if (lifecycleStatus) query = query.eq('lifecycle_status', lifecycleStatus);
      if (search) {
        const escaped = search.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
        query = query.or(`part_number.ilike.%${escaped}%,serial_number.ilike.%${escaped}%,description.ilike.%${escaped}%,supplier_name.ilike.%${escaped}%`);
      }

      const { data, error, count } = await query;
      if (error) throw new Error(`Failed to query parts inventory: ${error.message}`);

      const response = {
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-parts-list',
        output: {
          page,
          page_size: pageSize,
          total: Number(count || 0),
          latency_ms: Date.now() - startedAt,
          records: (data || []).map((row) => mapPartsInventoryRowToTemplate(row as Record<string, unknown>)),
        },
      };
      res.status(200).json(response);
      return;
    }

    const payload = asObject(req.body);
    const mapped = mapTemplateToPartsInventoryRow({
      partNumber: String(payload.part_number || payload.partNumber || ''),
      serialNumber: String(payload.serial_number || payload.serialNumber || '') || null,
      description: String(payload.description || '') || null,
      status: String(payload.status || 'available').toLowerCase() as any,
      lifecycleStatus: (String(payload.lifecycle_status || payload.lifecycleStatus || '') || undefined) as any,
      quantityOnHand: Number(payload.quantity_on_hand ?? payload.quantityOnHand ?? 0),
      quantityReserved: Number(payload.quantity_reserved ?? payload.quantityReserved ?? 0),
      warehouseLocation: String(payload.warehouse_location || payload.warehouseLocation || ''),
      supplierName: String(payload.supplier_name || payload.supplierName || '') || null,
      criticality: (String(payload.criticality || 'normal') as any),
      ataChapter: String(payload.ata_chapter || payload.ataChapter || '') || null,
    });
    const issues = validatePartsRecordInput(mapped);
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
      .from('parts_inventory')
      .insert(rowToCreate)
      .select('id,part_number,serial_number,description,status,lifecycle_status,quantity_on_hand,quantity_reserved,quantity_available,warehouse_location,supplier_name,criticality,ata_chapter,reorder_level,created_at,updated_at')
      .limit(1)
      .maybeSingle();
    if (insertError) throw new Error(`Failed to create parts inventory record: ${insertError.message}`);

    const insertedId = String(inserted?.id || '');
    const workflowEvents = resolveWorkflowTriggers({ previous: null, next: rowToCreate });
    await writePartsWorkflowEvents({
      tenantId,
      franchiseId,
      partInventoryId: insertedId,
      events: workflowEvents,
      userId: auth.userId,
      correlationId: ctx.correlationId,
      payload: rowToCreate,
    });
    await writePartsAuditLog({
      tenantId,
      userId: auth.userId,
      action: 'AMRO_PART_CREATE',
      partInventoryId: insertedId,
      correlationId: ctx.correlationId,
      details: { workflow_events: workflowEvents, payload: rowToCreate },
    });

    res.status(201).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-parts-create',
      output: {
        record: mapPartsInventoryRowToTemplate(inserted as Record<string, unknown>),
        workflow_events: workflowEvents,
        latency_ms: Date.now() - startedAt,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
