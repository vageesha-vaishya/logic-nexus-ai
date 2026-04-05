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

type NodeListResult = {
  records: Array<Record<string, unknown>>;
  total: number;
  source: 'canonical' | 'form-storage';
  columnCatalog: Array<{ key: string; header: string; sortable?: boolean }>;
};

const MODULE_CACHE_TTL_MS = 30_000;
const moduleRecordsCache = new Map<string, { expiresAt: number; value: NodeListResult }>();

function cacheKey(input: { tenantId: string; franchiseId: string | null; nodeKey: string; limit: number; offset: number }): string {
  return [input.tenantId, input.franchiseId || 'no-franchise', input.nodeKey, input.limit, input.offset].join(':');
}

function readCache(key: string): NodeListResult | null {
  const cached = moduleRecordsCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    moduleRecordsCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeCache(key: string, value: NodeListResult): void {
  moduleRecordsCache.set(key, { value, expiresAt: Date.now() + MODULE_CACHE_TTL_MS });
}

function invalidateNodeCache(tenantId: string, nodeKey: string): void {
  for (const key of moduleRecordsCache.keys()) {
    if (key.startsWith(`${tenantId}:`) && key.includes(`:${nodeKey}:`)) {
      moduleRecordsCache.delete(key);
    }
  }
}

function toIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  const parsed = Date.parse(String(value));
  if (!Number.isFinite(parsed)) return new Date().toISOString();
  return new Date(parsed).toISOString();
}

function isMissingDeletedAtColumnError(error: unknown): boolean {
  const message = String((error as { message?: unknown } | null)?.message || error || '').toLowerCase();
  return message.includes('deleted_at') && message.includes('does not exist');
}

function nodeColumnCatalog(nodeKey: string): Array<{ key: string; header: string; sortable?: boolean }> {
  const base = [
    { key: 'id', header: 'Record ID', sortable: true },
    { key: 'tenant_id', header: 'Tenant ID', sortable: true },
    { key: 'franchise_id', header: 'Franchise ID', sortable: true },
    { key: 'updated_at', header: 'Updated At', sortable: true },
  ];
  const moduleColumns: Record<string, Array<{ key: string; header: string; sortable?: boolean }>> = {
    overview: [
      { key: 'module_name', header: 'Module Name', sortable: true },
      { key: 'owner_email', header: 'Owner Email', sortable: true },
      { key: 'rollout_phase', header: 'Rollout Phase', sortable: true },
      { key: 'target_go_live_date', header: 'Go-Live Date', sortable: true },
    ],
    'item-master': [
      { key: 'sku', header: 'SKU', sortable: true },
      { key: 'part_number', header: 'Part Number', sortable: true },
      { key: 'item_name', header: 'Item Name', sortable: true },
      { key: 'category', header: 'Category', sortable: true },
      { key: 'uom', header: 'UOM', sortable: true },
      { key: 'is_serialized', header: 'Serialized', sortable: true },
      { key: 'maintenance_category', header: 'Maintenance Category', sortable: true },
      { key: 'ata_chapter_code', header: 'ATA Chapter', sortable: true },
      { key: 'ata_sub_chapter_code', header: 'ATA Sub Chapter', sortable: true },
      { key: 'ata_section_code', header: 'ATA Section', sortable: true },
      { key: 'manufacturer_name', header: 'Manufacturer', sortable: true },
      { key: 'life_limited', header: 'Life Limited', sortable: true },
      { key: 'hazardous_material', header: 'Hazardous', sortable: true },
      { key: 'shelf_life_days', header: 'Shelf Life (Days)', sortable: true },
      { key: 'created_at', header: 'Created At', sortable: true },
      { key: 'created_by', header: 'Created By', sortable: true },
      { key: 'updated_by', header: 'Updated By', sortable: true },
    ],
    'stock-ledger': [
      { key: 'item_id', header: 'Item ID', sortable: true },
      { key: 'transaction_type', header: 'Transaction Type', sortable: true },
      { key: 'quantity_delta', header: 'Quantity Delta', sortable: true },
      { key: 'referenced_module', header: 'Referenced Module', sortable: true },
      { key: 'referenced_record_id', header: 'Referenced Record', sortable: true },
      { key: 'reservation_id', header: 'Reservation ID', sortable: true },
      { key: 'performed_by', header: 'Performed By', sortable: true },
      { key: 'reference', header: 'Reference', sortable: true },
      { key: 'issued_at', header: 'Transaction Timestamp', sortable: true },
    ],
    reservations: [
      { key: 'item_id', header: 'Item ID', sortable: true },
      { key: 'catalog_item_id', header: 'Catalog Item ID', sortable: true },
      { key: 'requested_quantity', header: 'Requested Qty', sortable: true },
      { key: 'reservation_status', header: 'Reservation Status', sortable: true },
      { key: 'reservation_token', header: 'Reservation Token', sortable: true },
      { key: 'referenced_module', header: 'Referenced Module', sortable: true },
      { key: 'referenced_record_id', header: 'Referenced Record', sortable: true },
      { key: 'expected_use_date', header: 'Expected Use Date', sortable: true },
      { key: 'created_by', header: 'Created By', sortable: true },
      { key: 'updated_by', header: 'Updated By', sortable: true },
    ],
    'issue-consume': [
      { key: 'item_id', header: 'Item ID', sortable: true },
      { key: 'transaction_type', header: 'Transaction Type', sortable: true },
      { key: 'quantity_delta', header: 'Issue Qty', sortable: true },
      { key: 'issued_at', header: 'Issued At', sortable: true },
      { key: 'reference', header: 'Reference', sortable: true },
    ],
    restock: [
      { key: 'item_id', header: 'Item ID', sortable: true },
      { key: 'transaction_type', header: 'Transaction Type', sortable: true },
      { key: 'quantity_delta', header: 'Restock Qty', sortable: true },
      { key: 'reference', header: 'Reference', sortable: true },
      { key: 'issued_at', header: 'Restock Time', sortable: true },
    ],
    locations: [
      { key: 'location_code', header: 'Location Code', sortable: true },
      { key: 'location_name', header: 'Location Name', sortable: true },
      { key: 'location_type', header: 'Location Type', sortable: true },
      { key: 'location_id', header: 'Location ID', sortable: true },
      { key: 'serial_number', header: 'Serial Number', sortable: true },
      { key: 'batch_lot_number', header: 'Batch/Lot Number', sortable: true },
      { key: 'quantity', header: 'Quantity', sortable: true },
      { key: 'status', header: 'Status', sortable: true },
      { key: 'city', header: 'City', sortable: true },
      { key: 'state_region', header: 'State/Region', sortable: true },
      { key: 'country_code', header: 'Country', sortable: true },
      { key: 'created_at', header: 'Created At', sortable: true },
    ],
    analytics: [
      { key: 'report_name', header: 'Report Name', sortable: true },
      { key: 'metric_group', header: 'Metric Group', sortable: true },
      { key: 'catalog_items', header: 'Catalog Items', sortable: true },
      { key: 'inventory_items', header: 'Inventory Items', sortable: true },
      { key: 'projection_snapshots', header: 'Projection Snapshots', sortable: true },
    ],
  };
  return [...base, ...(moduleColumns[nodeKey] || [])];
}

function toHeaderLabel(key: string): string {
  const withSpaces = key.replace(/\./g, ' ').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return withSpaces
    .split(' ')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : ''))
    .join(' ');
}

function collectPayloadKeys(payload: Record<string, unknown>): string[] {
  const keys = new Set<string>();
  for (const [key, value] of Object.entries(payload)) {
    keys.add(key);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const childKey of Object.keys(value as Record<string, unknown>)) {
        keys.add(`${key}.${childKey}`);
      }
    }
  }
  return [...keys];
}

function buildSchemaDrivenColumnCatalog(
  staticCatalog: Array<{ key: string; header: string; sortable?: boolean }>,
  records: Array<Record<string, unknown>>,
): Array<{ key: string; header: string; sortable?: boolean }> {
  const catalog = new Map<string, { key: string; header: string; sortable?: boolean }>();
  for (const item of staticCatalog) catalog.set(item.key, item);
  for (const record of records) {
    const payload = (record.payload || {}) as Record<string, unknown>;
    for (const key of collectPayloadKeys(payload)) {
      if (catalog.has(key)) continue;
      catalog.set(key, { key, header: toHeaderLabel(key), sortable: true });
    }
  }
  return [...catalog.values()];
}

function mapItemMasterPayloadToCatalog(input: {
  payload: Record<string, unknown>;
  tenantId: string;
  franchiseId: string | null;
  userId: string;
}): Record<string, unknown> {
  const sku = String(input.payload.sku || '').trim();
  const itemName = String(input.payload.item_name || '').trim();
  const partNumber = String(input.payload.part_number || '').trim() || sku;
  const category = String(input.payload.category || '').trim() || 'UNCLASSIFIED';
  const uom = String(input.payload.uom || '').trim() || 'EA';
  const attributes = {
    maintenance_category: input.payload.maintenance_category || '',
    ata_chapter_code: input.payload.ata_chapter_code || '',
    sku_is_unique: Boolean(input.payload.sku_is_unique),
    source_node: 'item-master-form',
  };
  return {
    tenant_id: input.tenantId,
    franchise_id: input.franchiseId,
    sku,
    part_number: partNumber,
    title: itemName || sku,
    category,
    unit_of_measure: uom,
    is_serialized: false,
    attributes,
    created_by: input.userId,
    updated_by: input.userId,
  };
}

async function buildDerivedNodeRecords(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  access: { tenantId: string; franchiseId: string },
  nodeKey: string,
  limit: number,
  offset: number,
): Promise<NodeListResult> {
  const tenantId = access.tenantId;
  const franchiseId = access.franchiseId || null;

  if (nodeKey === 'item-master') {
    let data: any[] | null = null;
    let count = 0;
    {
      const withDeletedAt = await supabase
        .from('uim_catalog_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (withDeletedAt.error && isMissingDeletedAtColumnError(withDeletedAt.error)) {
        const withoutDeletedAt = await supabase
          .from('uim_catalog_items')
      .select('id, tenant_id, franchise_id, sku, part_number, title, category, unit_of_measure, is_serialized, attributes, created_at, updated_at, created_by, updated_by')
          .eq('tenant_id', tenantId)
          .order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (withoutDeletedAt.error) throw new Error(`Failed to derive item-master records: ${withoutDeletedAt.error.message}`);
        data = withoutDeletedAt.data as any[] | null;
      } else if (withDeletedAt.error) {
        throw new Error(`Failed to derive item-master records: ${withDeletedAt.error.message}`);
      } else {
        data = withDeletedAt.data as any[] | null;
      }

      const countWithDeletedAt = await supabase
        .from('uim_catalog_items')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('deleted_at', null);
      if (countWithDeletedAt.error && isMissingDeletedAtColumnError(countWithDeletedAt.error)) {
        const countWithoutDeletedAt = await supabase
          .from('uim_catalog_items')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);
        if (countWithoutDeletedAt.error) throw new Error(`Failed to count item-master records: ${countWithoutDeletedAt.error.message}`);
        count = Number(countWithoutDeletedAt.count || 0);
      } else if (countWithDeletedAt.error) {
        throw new Error(`Failed to count item-master records: ${countWithDeletedAt.error.message}`);
      } else {
        count = Number(countWithDeletedAt.count || 0);
      }
    }
    const records = (data || []).map((row: any) => ({
      id: String(row.id),
      tenant_id: tenantId,
      franchise_id: franchiseId,
      node_key: nodeKey,
      payload: {
        tenant_id: row.tenant_id || tenantId,
        franchise_id: row.franchise_id || franchiseId,
        item_name: row.title || '',
        sku: row.sku || '',
        part_number: row.part_number || '',
        category: row.category || '',
        uom: row.unit_of_measure || 'EA',
        is_serialized: Boolean(row.is_serialized),
        maintenance_category: (row.attributes || {}).maintenance_category || '',
        ata_chapter_code: (row.attributes || {}).ata_chapter_code || '',
        ata_sub_chapter_code: (row.attributes || {}).ata_sub_chapter_code || '',
        ata_section_code: (row.attributes || {}).ata_section_code || '',
        manufacturer_name: (row.attributes || {}).manufacturer_name || '',
        life_limited: Boolean((row.attributes || {}).life_limited),
        hazardous_material: Boolean((row.attributes || {}).hazardous_material),
        shelf_life_days: Number((row.attributes || {}).shelf_life_days || 0),
        created_at: row.created_at || '',
        created_by: row.created_by || '',
        updated_by: row.updated_by || '',
        status: 'active',
      },
      metadata: { mode: 'derived-canonical', source: 'uim_catalog_items' },
      created_at: toIso(row.created_at || row.updated_at),
      updated_at: toIso(row.updated_at),
    }));
    if (Number(count || 0) > 0) {
      return { records, total: Number(count || 0), source: 'canonical', columnCatalog: nodeColumnCatalog(nodeKey) };
    }

    let inventoryRows: any[] | null = null;
    let inventoryCount = 0;
    {
      const withDeletedAt = await supabase
        .from('uim_inventory_items')
        .select('id, tenant_id, franchise_id, serial_number, batch_lot_number, quantity, status, location_type, location_id, metadata, created_at, updated_at, created_by, updated_by')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (withDeletedAt.error && isMissingDeletedAtColumnError(withDeletedAt.error)) {
        const withoutDeletedAt = await supabase
          .from('uim_inventory_items')
          .select('id, tenant_id, franchise_id, serial_number, batch_lot_number, quantity, status, location_type, location_id, metadata, created_at, updated_at, created_by, updated_by')
          .eq('tenant_id', tenantId)
          .order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (withoutDeletedAt.error) throw new Error(`Failed to derive fallback item-master records: ${withoutDeletedAt.error.message}`);
        inventoryRows = withoutDeletedAt.data as any[] | null;
      } else if (withDeletedAt.error) {
        throw new Error(`Failed to derive fallback item-master records: ${withDeletedAt.error.message}`);
      } else {
        inventoryRows = withDeletedAt.data as any[] | null;
      }

      const countWithDeletedAt = await supabase
        .from('uim_inventory_items')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('deleted_at', null);
      if (countWithDeletedAt.error && isMissingDeletedAtColumnError(countWithDeletedAt.error)) {
        const countWithoutDeletedAt = await supabase
          .from('uim_inventory_items')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);
        if (countWithoutDeletedAt.error) throw new Error(`Failed to count fallback item-master records: ${countWithoutDeletedAt.error.message}`);
        inventoryCount = Number(countWithoutDeletedAt.count || 0);
      } else if (countWithDeletedAt.error) {
        throw new Error(`Failed to count fallback item-master records: ${countWithDeletedAt.error.message}`);
      } else {
        inventoryCount = Number(countWithDeletedAt.count || 0);
      }
    }

    const fallbackRecords = (inventoryRows || []).map((row: any) => {
      const metadata = (row.metadata || {}) as Record<string, unknown>;
      const partNumber = String(metadata.part_number || '').trim();
      const sku = String(metadata.sku || partNumber || row.id || '').trim();
      return {
        id: String(row.id),
        tenant_id: tenantId,
        franchise_id: franchiseId,
        node_key: nodeKey,
        payload: {
          tenant_id: row.tenant_id || tenantId,
          franchise_id: row.franchise_id || franchiseId,
          item_name: String(metadata.item_name || metadata.title || partNumber || sku || 'Inventory Item'),
          sku,
          part_number: partNumber,
          category: String(metadata.category || metadata.item_category || 'UNCLASSIFIED'),
          uom: String(metadata.uom || 'EA'),
          serial_number: String(row.serial_number || ''),
          batch_lot_number: String(row.batch_lot_number || ''),
          quantity: Number(row.quantity || 0),
          maintenance_category: String(metadata.maintenance_category || ''),
          ata_chapter_code: String(metadata.ata_chapter_code || ''),
          location_type: String(row.location_type || ''),
          location_id: String(row.location_id || ''),
          metadata: row.metadata || {},
          created_at: row.created_at || '',
          created_by: row.created_by || '',
          updated_by: row.updated_by || '',
          status: String(row.status || 'active'),
        },
        metadata: { mode: 'derived-canonical', source: 'uim_inventory_items-fallback' },
        created_at: toIso(row.created_at || row.updated_at),
        updated_at: toIso(row.updated_at),
      };
    });
    return {
      records: fallbackRecords,
      total: Number(inventoryCount || 0),
      source: 'canonical',
      columnCatalog: nodeColumnCatalog(nodeKey),
    };
  }

  if (nodeKey === 'stock-ledger' || nodeKey === 'issue-consume' || nodeKey === 'restock') {
    const { data, error } = await supabase
      .from('uim_inventory_ledger')
      .select('*')
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
    const total = filtered.length;
    const records = filtered.map((row: any) => ({
      id: String(row.id),
      tenant_id: tenantId,
      franchise_id: franchiseId,
      node_key: nodeKey,
      payload: {
        tenant_id: row.tenant_id || tenantId,
        franchise_id: row.franchise_id || franchiseId,
        item_id: row.inventory_item_id || '',
        transaction_type: row.transaction_type || '',
        quantity_delta: Number(row.quantity_changed || 0),
        referenced_module: row.referenced_module || '',
        referenced_record_id: row.referenced_record_id || '',
        reservation_id: row.reservation_id || '',
        performed_by: row.performed_by || '',
        reference: (row.metadata || {}).reference || '',
        metadata: row.metadata || {},
        issued_at: toIso(row.created_at),
        status: 'active',
      },
      metadata: { mode: 'derived-canonical', source: 'uim_inventory_ledger' },
      created_at: toIso(row.created_at),
      updated_at: toIso(row.created_at),
    }));
    return { records, total, source: 'canonical', columnCatalog: nodeColumnCatalog(nodeKey) };
  }

  if (nodeKey === 'reservations') {
    const { data, error } = await supabase
      .from('uim_inventory_reservations')
      .select('id, tenant_id, franchise_id, catalog_item_id, inventory_item_id, reserved_quantity, reservation_status, reservation_token, referenced_module, referenced_record_id, expected_use_date, updated_at, created_at, metadata, created_by, updated_by')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`Failed to derive reservations records: ${error.message}`);
    const { count, error: countError } = await supabase
      .from('uim_inventory_reservations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    if (countError) throw new Error(`Failed to count reservation records: ${countError.message}`);
    const records = (data || []).map((row: any) => ({
      id: String(row.id),
      tenant_id: tenantId,
      franchise_id: franchiseId,
      node_key: nodeKey,
      payload: {
        tenant_id: row.tenant_id || tenantId,
        franchise_id: row.franchise_id || franchiseId,
        catalog_item_id: row.catalog_item_id || '',
        item_id: row.inventory_item_id || '',
        requested_quantity: Number(row.reserved_quantity || 0),
        reservation_status: row.reservation_status || 'active',
        referenced_module: row.referenced_module || '',
        referenced_record_id: row.referenced_record_id || '',
        consumer_reference: (row.metadata || {}).consumer_reference || '',
        expected_use_date: row.expected_use_date || '',
        reservation_token: row.reservation_token || '',
        metadata: row.metadata || {},
        created_by: row.created_by || '',
        updated_by: row.updated_by || '',
      },
      metadata: { mode: 'derived-canonical', source: 'uim_inventory_reservations' },
      created_at: toIso(row.created_at || row.updated_at),
      updated_at: toIso(row.updated_at),
    }));
    return { records, total: Number(count || 0), source: 'canonical', columnCatalog: nodeColumnCatalog(nodeKey) };
  }

  if (nodeKey === 'locations') {
    const { data, error } = await supabase
      .from('uim_inventory_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`Failed to derive location records: ${error.message}`);
    const { count, error: countError } = await supabase
      .from('uim_inventory_items')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);
    if (countError) throw new Error(`Failed to count location records: ${countError.message}`);
    const records = (data || []).map((row: any, index: number) => ({
      id: String(row.id || `loc-${index}`),
      tenant_id: tenantId,
      franchise_id: franchiseId,
      node_key: nodeKey,
      payload: {
        tenant_id: row.tenant_id || tenantId,
        franchise_id: row.franchise_id || franchiseId,
        location_code: String((row.metadata || {}).location_code || `UIM-${String(index + 1).padStart(4, '0')}`),
        location_name: String((row.metadata || {}).location_name || row.location_type || 'Warehouse Location'),
        location_type: String(row.location_type || ''),
        location_id: String(row.location_id || ''),
        serial_number: String(row.serial_number || ''),
        batch_lot_number: String(row.batch_lot_number || ''),
        quantity: Number(row.quantity || 0),
        status: String(row.status || ''),
        metadata: row.metadata || {},
        city: String((row.metadata || {}).city || ''),
        state_region: String((row.metadata || {}).state_region || ''),
        country_code: String((row.metadata || {}).country_code || ''),
        latitude: Number((row.metadata || {}).latitude || 0),
        longitude: Number((row.metadata || {}).longitude || 0),
        created_at: row.created_at || '',
      },
      metadata: { mode: 'derived-canonical', source: 'uim_inventory_items' },
      created_at: toIso(row.created_at || row.updated_at),
      updated_at: toIso(row.updated_at),
    }));
    return { records, total: Number(count || 0), source: 'canonical', columnCatalog: nodeColumnCatalog(nodeKey) };
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
    const records = [{
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
    return { records, total: 1, source: 'canonical', columnCatalog: nodeColumnCatalog(nodeKey) };
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
    const records = [{
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
    return { records, total: 1, source: 'canonical', columnCatalog: nodeColumnCatalog(nodeKey) };
  }

  return { records: [], total: 0, source: 'canonical', columnCatalog: nodeColumnCatalog(nodeKey) };
}

async function listFormStorageRecords(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  access: { tenantId: string; franchiseId: string },
  nodeKey: string,
  limit: number,
  offset: number,
): Promise<NodeListResult> {
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

  if (!access.franchiseId || (count || 0) === 0) {
    const tenantScoped = await tenantScopedBase;
    if (tenantScoped.error) throw new Error(`Failed to load tenant-scoped UIM form records: ${tenantScoped.error.message}`);
    data = tenantScoped.data as Array<Record<string, unknown>> | null;
    count = Number(tenantScoped.count || 0);
  }

  return {
    records: data || [],
    total: Number(count || 0),
    source: 'form-storage',
    columnCatalog: nodeColumnCatalog(nodeKey),
  };
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
      const normalizedLimit = Math.min(limit, 100);
      const key = cacheKey({
        tenantId: access.tenantId,
        franchiseId: access.franchiseId || null,
        nodeKey,
        limit: normalizedLimit,
        offset,
      });
      let listResult = readCache(key);

      if (!listResult) {
        try {
          listResult = await buildDerivedNodeRecords(
            supabase,
            access,
            nodeKey,
            normalizedLimit,
            offset,
          );
        } catch (canonicalError) {
          listResult = await listFormStorageRecords(
            supabase,
            access,
            nodeKey,
            normalizedLimit,
            offset,
          );
        }
        writeCache(key, listResult);
      }

      const schemaDrivenCatalog = buildSchemaDrivenColumnCatalog(
        listResult.columnCatalog,
        listResult.records || [],
      );

      res.status(200).json({
        version: 'v2',
        interface: 'uim-form-records-list',
        correlationId: ctx.correlationId,
        output: {
          node_key: nodeKey,
          count: Number(listResult.total || 0),
          limit: normalizedLimit,
          offset,
          source: listResult.source,
          column_catalog: schemaDrivenCatalog,
          records: listResult.records || [],
        },
      });
      return;
    }

    const payload = parsePayload(req.body);
    if (nodeKey === 'item-master') {
      const catalogInsert = mapItemMasterPayloadToCatalog({
        payload,
        tenantId: access.tenantId,
        franchiseId: access.franchiseId || null,
        userId: access.userId,
      });
      if (!String(catalogInsert.sku || '').trim()) {
        res.status(400).json({
          error: 'SKU is required for item-master',
          code: 'UIM_ITEM_MASTER_SKU_REQUIRED',
          version: 'v2',
          correlationId: ctx.correlationId,
        });
        return;
      }
      const { data, error } = await supabase
        .from('uim_catalog_items')
        .insert(catalogInsert)
        .select('id, sku, part_number, title, category, unit_of_measure, attributes, updated_at')
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`Failed to create UIM item-master record: ${error.message}`);
      invalidateNodeCache(access.tenantId, nodeKey);
      res.status(201).json({
        version: 'v2',
        interface: 'uim-item-master-create',
        correlationId: ctx.correlationId,
        id: String(data?.id || ''),
        output: data || {},
        message: 'UIM item-master record created successfully',
      });
      return;
    }
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
    invalidateNodeCache(access.tenantId, nodeKey);

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
