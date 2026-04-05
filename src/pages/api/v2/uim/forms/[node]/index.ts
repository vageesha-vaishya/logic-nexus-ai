import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import {
  applyCors,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from '../../../../_utils/http';
import { sendErrorResponse } from '../../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../../_utils/supabaseAdmin';
import { parseNodeKey, parsePayload, parsePositiveInt, resolveUimFormAccess, tryHandleUimFormStorageError } from '../_shared';

function toIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  const iso = new Date(String(value)).toISOString();
  return Number.isNaN(Date.parse(iso)) ? new Date().toISOString() : iso;
}

async function buildDerivedNodeRecords(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  access: { tenantId: string; franchiseId: string },
  nodeKey: string,
  limit: number,
  offset: number,
): Promise<Array<Record<string, unknown>>> {
  const tenantId = access.tenantId;
  const franchiseId = access.franchiseId || null;

  if (nodeKey === 'item-master') {
    const { data, error } = await supabase
      .from('uim_catalog_items')
      .select('id, sku, part_number, title, category, unit_of_measure, attributes, updated_at')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`Failed to derive item-master records: ${error.message}`);
    return (data || []).map((row: any) => ({
      id: String(row.id),
      tenant_id: tenantId,
      franchise_id: franchiseId,
      node_key: nodeKey,
      payload: {
        item_name: row.title || '',
        sku: row.sku || '',
        part_number: row.part_number || '',
        category: row.category || '',
        uom: row.unit_of_measure || 'EA',
        maintenance_category: (row.attributes || {}).maintenance_category || '',
        ata_chapter_code: (row.attributes || {}).ata_chapter_code || '',
        status: 'active',
      },
      metadata: { mode: 'derived-canonical', source: 'uim_catalog_items' },
      created_at: toIso(row.updated_at),
      updated_at: toIso(row.updated_at),
    }));
  }

  if (nodeKey === 'stock-ledger' || nodeKey === 'issue-consume' || nodeKey === 'restock') {
    const { data, error } = await supabase
      .from('uim_inventory_ledger')
      .select('id, inventory_item_id, transaction_type, quantity_changed, created_at, metadata')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`Failed to derive ledger records: ${error.message}`);
    const filtered = (data || []).filter((row: any) => {
      const tx = String(row.transaction_type || '').toUpperCase();
      if (nodeKey === 'issue-consume') return tx === 'CONSUME';
      if (nodeKey === 'restock') return tx === 'RECEIVE' || tx === 'ADJUST' || tx === 'RETURN';
      return true;
    });
    return filtered.map((row: any) => ({
      id: String(row.id),
      tenant_id: tenantId,
      franchise_id: franchiseId,
      node_key: nodeKey,
      payload: {
        item_id: row.inventory_item_id || '',
        transaction_type: row.transaction_type || '',
        quantity_delta: Number(row.quantity_changed || 0),
        reference: (row.metadata || {}).reference || '',
        issued_at: toIso(row.created_at),
        status: 'active',
      },
      metadata: { mode: 'derived-canonical', source: 'uim_inventory_ledger' },
      created_at: toIso(row.created_at),
      updated_at: toIso(row.created_at),
    }));
  }

  if (nodeKey === 'reservations') {
    const { data, error } = await supabase
      .from('uim_inventory_reservations')
      .select('id, inventory_item_id, reserved_quantity, reservation_status, reservation_token, expected_use_at, updated_at, metadata')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`Failed to derive reservations records: ${error.message}`);
    return (data || []).map((row: any) => ({
      id: String(row.id),
      tenant_id: tenantId,
      franchise_id: franchiseId,
      node_key: nodeKey,
      payload: {
        item_id: row.inventory_item_id || '',
        requested_quantity: Number(row.reserved_quantity || 0),
        reservation_status: row.reservation_status || 'active',
        consumer_reference: (row.metadata || {}).consumer_reference || '',
        expected_use_date: row.expected_use_at || '',
        reservation_token: row.reservation_token || '',
      },
      metadata: { mode: 'derived-canonical', source: 'uim_inventory_reservations' },
      created_at: toIso(row.updated_at),
      updated_at: toIso(row.updated_at),
    }));
  }

  if (nodeKey === 'locations') {
    const { data, error } = await supabase
      .from('uim_inventory_items')
      .select('id, location_type, metadata, updated_at')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`Failed to derive location records: ${error.message}`);
    return (data || []).map((row: any, index: number) => ({
      id: String(row.id || `loc-${index}`),
      tenant_id: tenantId,
      franchise_id: franchiseId,
      node_key: nodeKey,
      payload: {
        location_code: String((row.metadata || {}).location_code || `UIM-${String(index + 1).padStart(4, '0')}`),
        location_name: String((row.metadata || {}).location_name || row.location_type || 'Warehouse Location'),
        city: String((row.metadata || {}).city || ''),
        state_region: String((row.metadata || {}).state_region || ''),
        country_code: String((row.metadata || {}).country_code || ''),
        latitude: Number((row.metadata || {}).latitude || 0),
        longitude: Number((row.metadata || {}).longitude || 0),
      },
      metadata: { mode: 'derived-canonical', source: 'uim_inventory_items' },
      created_at: toIso(row.updated_at),
      updated_at: toIso(row.updated_at),
    }));
  }

  if (nodeKey === 'analytics') {
    const [catalogCountQuery, inventoryCountQuery, reservationCountQuery, projectionCountQuery] = await Promise.all([
      supabase.from('uim_catalog_items').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).is('deleted_at', null),
      supabase.from('uim_inventory_items').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).is('deleted_at', null),
      supabase.from('uim_inventory_reservations').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('uim_inventory_projection_snapshots').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ]);
    if (catalogCountQuery.error) throw new Error(`Failed to derive analytics catalog count: ${catalogCountQuery.error.message}`);
    if (inventoryCountQuery.error) throw new Error(`Failed to derive analytics inventory count: ${inventoryCountQuery.error.message}`);
    if (reservationCountQuery.error) throw new Error(`Failed to derive analytics reservation count: ${reservationCountQuery.error.message}`);
    if (projectionCountQuery.error) throw new Error(`Failed to derive analytics projection count: ${projectionCountQuery.error.message}`);
    return [{
      id: `derived-analytics-${tenantId}`,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      node_key: nodeKey,
      payload: {
        report_name: 'Derived UIM Tenant Snapshot',
        metric_group: 'inventory_health',
        include_archived: false,
        catalog_items: Number(catalogCountQuery.count || 0),
        inventory_items: Number(inventoryCountQuery.count || 0),
        reservations: Number(reservationCountQuery.count || 0),
        projection_snapshots: Number(projectionCountQuery.count || 0),
      },
      metadata: { mode: 'derived-canonical', source: 'uim_* aggregate counts' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }];
  }

  if (nodeKey === 'overview') {
    const [catalogCountQuery, inventoryCountQuery, projectionCountQuery] = await Promise.all([
      supabase.from('uim_catalog_items').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).is('deleted_at', null),
      supabase.from('uim_inventory_items').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).is('deleted_at', null),
      supabase.from('uim_inventory_projection_snapshots').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ]);
    if (catalogCountQuery.error) throw new Error(`Failed to derive overview catalog count: ${catalogCountQuery.error.message}`);
    if (inventoryCountQuery.error) throw new Error(`Failed to derive overview inventory count: ${inventoryCountQuery.error.message}`);
    if (projectionCountQuery.error) throw new Error(`Failed to derive overview projection count: ${projectionCountQuery.error.message}`);
    return [{
      id: `derived-overview-${tenantId}`,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      node_key: nodeKey,
      payload: {
        module_name: 'Universal Inventory Management',
        owner_email: 'uim-system@logicnexus.ai',
        rollout_phase: 'phase_4',
        target_go_live_date: new Date().toISOString().slice(0, 10),
        notes: `Derived from canonical tables: catalog=${Number(catalogCountQuery.count || 0)}, inventory=${Number(inventoryCountQuery.count || 0)}, projections=${Number(projectionCountQuery.count || 0)}`,
      },
      metadata: { mode: 'derived-canonical', source: 'uim_* aggregate counts' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }];
  }

  return [];
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);

  try {
    if (!['GET', 'POST'].includes(String(req.method))) {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    const nodeKey = parseNodeKey(req.query.node);
    if (!nodeKey) {
      res.status(404).json({
        error: 'UIM form node not found',
        code: 'UIM_FORM_NODE_NOT_FOUND',
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const access = await resolveUimFormAccess(req, ctx);
    const supabase = getSupabaseAdminClient();

    if (req.method === 'GET') {
      const limit = parsePositiveInt(req.query.limit, 25);
      const offset = parsePositiveInt(req.query.offset, 0);
      const end = offset + Math.min(limit, 100) - 1;
      const tenantScopedBase = supabase
        .from('uim_form_records')
        .select('id, tenant_id, franchise_id, node_key, payload, metadata, created_at, updated_at', { count: 'exact' })
        .eq('tenant_id', access.tenantId)
        .eq('node_key', nodeKey)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .range(offset, end);

      let data: Array<Record<string, unknown>> | null = null;
      let count: number | null = null;

      if (access.franchiseId) {
        const franchiseScoped = await supabase
          .from('uim_form_records')
          .select('id, tenant_id, franchise_id, node_key, payload, metadata, created_at, updated_at', { count: 'exact' })
          .eq('tenant_id', access.tenantId)
          .eq('franchise_id', access.franchiseId)
          .eq('node_key', nodeKey)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .range(offset, end);
        if (franchiseScoped.error) throw new Error(`Failed to load franchise-scoped UIM form records: ${franchiseScoped.error.message}`);
        data = franchiseScoped.data as Array<Record<string, unknown>> | null;
        count = Number(franchiseScoped.count || 0);
      }

      // Fallback: if franchise scope is empty, return tenant-level records.
      if (!access.franchiseId || (count || 0) === 0) {
        const tenantScoped = await tenantScopedBase;
        if (tenantScoped.error) throw new Error(`Failed to load tenant-scoped UIM form records: ${tenantScoped.error.message}`);
        data = tenantScoped.data as Array<Record<string, unknown>> | null;
        count = Number(tenantScoped.count || 0);
      }

      // Canonical fallback: derive records from UIM canonical tables when form records are empty.
      if ((count || 0) === 0) {
        const derivedRecords = await buildDerivedNodeRecords(
          supabase,
          access,
          nodeKey,
          Math.min(limit, 100),
          offset,
        );
        if (derivedRecords.length > 0) {
          data = derivedRecords;
          count = derivedRecords.length;
        }
      }

      res.status(200).json({
        version: 'v2',
        interface: 'uim-form-records-list',
        correlationId: ctx.correlationId,
        output: {
          node_key: nodeKey,
          count: Number(count || 0),
          limit: Math.min(limit, 100),
          offset,
          records: data || [],
        },
      });
      return;
    }

    const payload = parsePayload(req.body);
    const insertRow = {
      tenant_id: access.tenantId,
      franchise_id: access.franchiseId || null,
      node_key: nodeKey,
      payload,
      metadata: {
        mode: 'form-crud',
        source: 'api_v2_uim_forms_node_index',
      },
      created_by: access.userId,
      updated_by: access.userId,
    };
    const { data, error } = await supabase
      .from('uim_form_records')
      .insert(insertRow)
      .select('id, node_key, payload, created_at, updated_at')
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Failed to create UIM form record: ${error.message}`);

    res.status(201).json({
      version: 'v2',
      interface: 'uim-form-record-create',
      correlationId: ctx.correlationId,
      id: String(data?.id || ''),
      output: data || {},
      message: 'UIM form record created successfully',
    });
  } catch (error) {
    if (tryHandleUimFormStorageError(res, error, ctx.correlationId)) return;
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
