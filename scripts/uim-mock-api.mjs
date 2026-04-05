import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const UIM_MOCK_AUTO_SEED = String(process.env.UIM_MOCK_AUTO_SEED || '').toLowerCase() === 'true';
const UIM_MOCK_SOURCE = String(
  process.env.UIM_MOCK_SOURCE || (
    process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'database' : 'memory'
  ),
).toLowerCase();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const supabaseAdmin = (
  UIM_MOCK_SOURCE === 'database'
  && process.env.VITE_SUPABASE_URL
  && process.env.SUPABASE_SERVICE_ROLE_KEY
) ? createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) : null;

let databaseTenantCache = null;

const NODE_KEYS = new Set([
  'overview',
  'item-master',
  'stock-ledger',
  'reservations',
  'issue-consume',
  'restock',
  'locations',
  'analytics',
]);

const store = new Map();
const catalog = new Map();
const inventoryItems = new Map();
const reservations = new Map();
const ledger = [];
const commands = new Map();
const projectionSnapshots = new Map();
const webhookAdapters = new Map();
const qaSignoffRecords = [];
const MOCK_DECCAN_TENANT_ID = 'deccan';
const MOCK_DECCAN_FRANCHISE_ID = 'deccan-franchise-1';
const MOCK_PLATFORM_DOMAINS = [
  {
    id: 'domain-amro',
    code: 'AMRO',
    name: 'AMRO',
    description: 'Airline Maintenance, Repair and Overhaul',
    is_active: true,
  },
  {
    id: 'domain-logistics',
    code: 'LOGISTICS',
    name: 'Logistics',
    description: 'Core logistics operations',
    is_active: true,
  },
];

const UIM_ANALYTICS_KPI_MODEL_DEFINITIONS = [
  { key: 'total_tracked_items', label: 'Total tracked items', formula: 'COUNT(items)' },
  { key: 'available_quantity', label: 'Available quantity', formula: 'SUM(projected_available_quantity)' },
  { key: 'reserved_quantity', label: 'Reserved quantity', formula: 'SUM(projected_reserved_quantity)' },
  { key: 'consumed_quantity', label: 'Consumed quantity', formula: 'SUM(projected_consumed_quantity)' },
  { key: 'in_transit_items', label: 'In transit items', formula: "COUNT(status='in_transit')" },
  { key: 'low_stock_items', label: 'Low stock items', formula: 'COUNT(projected_available_quantity <= threshold)' },
  { key: 'inventory_turnover_ratio', label: 'Inventory turnover ratio', formula: 'consumed/(available+reserved)' },
];

const UIM_ANALYTICS_SEMANTIC_DICTIONARY = {
  cube_name: 'uim_inventory_analytics_cube',
  version: 'phase4-prep-v1',
  dimensions: [
    { key: 'tenant_id', source: 'uim_inventory_projection_snapshots.tenant_id', grain: 'tenant' },
    { key: 'inventory_item_id', source: 'uim_inventory_projection_snapshots.inventory_item_id', grain: 'inventory_item' },
    { key: 'snapshot_date', source: 'DATE(uim_inventory_projection_snapshots.updated_at)', grain: 'projection_snapshot' },
  ],
  measures: [
    { key: 'available_quantity', source: 'projected_available_quantity', aggregation: 'sum' },
    { key: 'reserved_quantity', source: 'projected_reserved_quantity', aggregation: 'sum' },
    { key: 'consumed_quantity', source: 'projected_consumed_quantity', aggregation: 'sum' },
    { key: 'replay_version', source: 'replay_version', aggregation: 'max' },
  ],
};

const etlState = {
  scheduler_running: false,
  queue: {
    queued: 0,
    running: 0,
    retryScheduled: 0,
    completed: 0,
    failed: 0,
  },
  telemetry: {
    total_runs: 0,
    completed_runs: 0,
    failed_runs: 0,
    retry_scheduled_runs: 0,
    retry_events: 0,
    average_duration_ms: 120,
    success_rate: 1,
    latest_completed_at: null,
    last_error: null,
  },
};

const CONNECTOR_MANIFESTS = [
  {
    connector_id: 'freight-bridge',
    connector_name: 'Freight Bridge Connector',
    version: '0.6.0',
    protocol: ['REST', 'Webhook'],
    direction: 'bi-directional',
    events: ['uim.command.applied.v1', 'uim.stock.threshold.breach.v1'],
    sla: { p95_latency_ms: 250, availability_percent: 99.9 },
  },
  {
    connector_id: 'amro-bridge',
    connector_name: 'AMRO Connector',
    version: '0.6.0',
    protocol: ['REST', 'GraphQL', 'Webhook'],
    direction: 'bi-directional',
    events: ['uim.reservation.created.v1', 'uim.projection.replayed.v1', 'uim.command.applied.v1'],
    sla: { p95_latency_ms: 300, availability_percent: 99.9 },
  },
  {
    connector_id: 'marketplace-bridge',
    connector_name: 'Marketplace Adapter',
    version: '0.6.0',
    protocol: ['REST', 'Webhook'],
    direction: 'outbound',
    events: ['uim.command.applied.v1'],
    sla: { p95_latency_ms: 350, availability_percent: 99.5 },
  },
];

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Tenant-Id,X-Franchise-Id,X-User-Id,X-Correlation-Id');
}

function getHeader(req, key) {
  const value = req.headers[key.toLowerCase()];
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function resolveTenant(req) {
  const tenantId = String(getHeader(req, 'x-tenant-id') || 'dev-tenant');
  const franchiseId = String(getHeader(req, 'x-franchise-id') || '').trim() || null;
  return { tenantId, franchiseId };
}

async function resolveDatabaseScope(req) {
  if (!supabaseAdmin) return resolveTenant(req);
  const incomingTenant = String(getHeader(req, 'x-tenant-id') || '').trim();
  const incomingFranchise = String(getHeader(req, 'x-franchise-id') || '').trim();
  if (incomingTenant && UUID_REGEX.test(incomingTenant)) {
    return { tenantId: incomingTenant, franchiseId: UUID_REGEX.test(incomingFranchise) ? incomingFranchise : null };
  }
  if (incomingTenant && !UUID_REGEX.test(incomingTenant)) {
    const tenantByName = await supabaseAdmin
      .from('tenants')
      .select('id')
      .ilike('name', incomingTenant)
      .limit(1)
      .maybeSingle();
    if (tenantByName.data?.id) {
      let franchiseId = null;
      if (incomingFranchise) {
        const franchiseByName = await supabaseAdmin
          .from('franchises')
          .select('id')
          .eq('tenant_id', tenantByName.data.id)
          .ilike('name', incomingFranchise)
          .limit(1)
          .maybeSingle();
        if (franchiseByName.data?.id) franchiseId = String(franchiseByName.data.id);
      }
      return { tenantId: String(tenantByName.data.id), franchiseId };
    }
  }
  if (databaseTenantCache) return databaseTenantCache;
  const { data: tenantRow } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const tenantId = String(tenantRow?.id || '');
  if (!tenantId) return { tenantId: 'deccan', franchiseId: null };
  const { data: franchiseRow } = await supabaseAdmin
    .from('franchises')
    .select('id')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  databaseTenantCache = { tenantId, franchiseId: franchiseRow?.id ? String(franchiseRow.id) : null };
  return databaseTenantCache;
}

function toIso(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function toHeaderLabel(key) {
  return String(key)
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : ''))
    .join(' ');
}

function collectPayloadKeys(payload) {
  const keys = new Set();
  for (const [key, value] of Object.entries(payload || {})) {
    keys.add(key);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const childKey of Object.keys(value)) {
        keys.add(`${key}.${childKey}`);
      }
    }
  }
  return [...keys];
}

function schemaDrivenCatalog(records) {
  const keys = new Set(['id', 'tenant_id', 'franchise_id', 'updated_at']);
  for (const record of (records || [])) {
    for (const key of collectPayloadKeys(record.payload || {})) keys.add(key);
  }
  return [...keys].map((key) => ({ key, header: toHeaderLabel(key), sortable: true }));
}

async function listDatabaseBackedUimFormRecords(req, node, limit, offset) {
  if (!supabaseAdmin) return null;
  const scope = await resolveDatabaseScope(req);
  const tenantId = scope.tenantId;
  const franchiseId = scope.franchiseId || null;
  const wrap = (records, total, source = 'canonical') => ({
    node_key: node,
    count: Number(total || 0),
    limit,
    offset,
    source,
    column_catalog: schemaDrivenCatalog(records || []),
    records,
  });

  if (node === 'item-master') {
    const { data, count, error } = await supabaseAdmin
      .from('uim_catalog_items')
      .select('id, sku, part_number, title, category, unit_of_measure, attributes, updated_at', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (!error && Number(count || 0) > 0) {
      return wrap((data || []).map((row) => ({
        id: String(row.id),
        tenant_id: tenantId,
        franchise_id: franchiseId,
        node_key: node,
        payload: {
          ...row,
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
      })), count);
    }
  }

  if (node === 'stock-ledger' || node === 'issue-consume' || node === 'restock') {
    const { data, count, error } = await supabaseAdmin
      .from('uim_inventory_ledger')
      .select('id, inventory_item_id, transaction_type, quantity_changed, created_at, metadata', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (!error) {
      const filtered = (data || []).filter((row) => {
        const tx = String(row.transaction_type || '').toUpperCase();
        if (node === 'issue-consume') return tx === 'CONSUME';
        if (node === 'restock') return tx === 'RECEIVE' || tx === 'ADJUST' || tx === 'RETURN';
        return true;
      });
      return wrap(filtered.map((row) => ({
        id: String(row.id),
        tenant_id: tenantId,
        franchise_id: franchiseId,
        node_key: node,
        payload: {
          ...row,
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
      })), count);
    }
  }

  if (node === 'reservations') {
    const { data, count, error } = await supabaseAdmin
      .from('uim_inventory_reservations')
      .select('id, inventory_item_id, reserved_quantity, reservation_status, reservation_token, expected_use_date, metadata, updated_at', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (!error) {
      return wrap((data || []).map((row) => ({
        id: String(row.id),
        tenant_id: tenantId,
        franchise_id: franchiseId,
        node_key: node,
        payload: {
          ...row,
          item_id: row.inventory_item_id || '',
          requested_quantity: Number(row.reserved_quantity || 0),
          reservation_status: row.reservation_status || 'active',
          consumer_reference: (row.metadata || {}).consumer_reference || '',
          expected_use_date: row.expected_use_date || '',
          reservation_token: row.reservation_token || '',
        },
        metadata: { mode: 'derived-canonical', source: 'uim_inventory_reservations' },
        created_at: toIso(row.updated_at),
        updated_at: toIso(row.updated_at),
      })), count);
    }
  }

  if (node === 'locations') {
    const { data, count, error } = await supabaseAdmin
      .from('uim_inventory_items')
      .select('id, location_type, metadata, updated_at', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (!error) {
      return wrap((data || []).map((row, index) => ({
        id: String(row.id || `loc-${index}`),
        tenant_id: tenantId,
        franchise_id: franchiseId,
        node_key: node,
        payload: {
          ...row,
          location_code: String((row.metadata || {}).location_code || `UIM-${String(index + 1).padStart(4, '0')}`),
          location_name: String((row.metadata || {}).location_name || row.location_type || 'Warehouse Location'),
          city: String((row.metadata || {}).city || ''),
          state_region: String((row.metadata || {}).state_region || ''),
          country_code: String((row.metadata || {}).country_code || ''),
        },
        metadata: { mode: 'derived-canonical', source: 'uim_inventory_items' },
        created_at: toIso(row.updated_at),
        updated_at: toIso(row.updated_at),
      })), count);
    }
  }

  if (node === 'overview' || node === 'analytics') {
    const [catalogCount, inventoryCount, reservationCount, projectionCount] = await Promise.all([
      supabaseAdmin.from('uim_catalog_items').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabaseAdmin.from('uim_inventory_items').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabaseAdmin.from('uim_inventory_reservations').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabaseAdmin.from('uim_inventory_projection_snapshots').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ]);
    const record = {
      id: `${node}-${tenantId}`,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      node_key: node,
      payload: node === 'overview' ? {
        module_name: 'Universal Inventory Management',
        rollout_phase: 'phase_4',
        notes: `catalog=${Number(catalogCount.count || 0)} inventory=${Number(inventoryCount.count || 0)} projections=${Number(projectionCount.count || 0)}`,
      } : {
        report_name: 'Derived UIM Tenant Snapshot',
        metric_group: 'inventory_health',
        catalog_items: Number(catalogCount.count || 0),
        inventory_items: Number(inventoryCount.count || 0),
        reservations: Number(reservationCount.count || 0),
        projection_snapshots: Number(projectionCount.count || 0),
      },
      metadata: { mode: 'derived-canonical', source: 'uim_* aggregate counts' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return wrap([record], 1);
  }

  return wrap([], 0);
}

async function getDatabaseBackedUimFormRecord(req, node, id) {
  if (!supabaseAdmin) return null;
  const scope = await resolveDatabaseScope(req);
  const tenantId = scope.tenantId;
  const franchiseId = scope.franchiseId || null;

  if (node === 'item-master') {
    const { data, error } = await supabaseAdmin
      .from('uim_catalog_items')
      .select('id, sku, part_number, title, category, unit_of_measure, attributes, updated_at, created_at')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: String(data.id),
      tenant_id: tenantId,
      franchise_id: franchiseId,
      node_key: node,
      payload: {
        item_name: data.title || '',
        sku: data.sku || '',
        part_number: data.part_number || '',
        category: data.category || '',
        uom: data.unit_of_measure || 'EA',
        maintenance_category: (data.attributes || {}).maintenance_category || '',
        ata_chapter_code: (data.attributes || {}).ata_chapter_code || '',
        status: 'active',
      },
      metadata: { mode: 'derived-canonical', source: 'uim_catalog_items' },
      created_at: toIso(data.created_at || data.updated_at),
      updated_at: toIso(data.updated_at),
    };
  }

  if (node === 'stock-ledger' || node === 'issue-consume' || node === 'restock') {
    const { data, error } = await supabaseAdmin
      .from('uim_inventory_ledger')
      .select('id, inventory_item_id, transaction_type, quantity_changed, created_at, metadata')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: String(data.id),
      tenant_id: tenantId,
      franchise_id: franchiseId,
      node_key: node,
      payload: {
        item_id: data.inventory_item_id || '',
        transaction_type: data.transaction_type || '',
        quantity_delta: Number(data.quantity_changed || 0),
        reference: (data.metadata || {}).reference || '',
        issued_at: toIso(data.created_at),
        status: 'active',
      },
      metadata: { mode: 'derived-canonical', source: 'uim_inventory_ledger' },
      created_at: toIso(data.created_at),
      updated_at: toIso(data.created_at),
    };
  }

  if (node === 'reservations') {
    const { data, error } = await supabaseAdmin
      .from('uim_inventory_reservations')
      .select('id, inventory_item_id, reserved_quantity, reservation_status, reservation_token, expected_use_date, metadata, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: String(data.id),
      tenant_id: tenantId,
      franchise_id: franchiseId,
      node_key: node,
      payload: {
        item_id: data.inventory_item_id || '',
        requested_quantity: Number(data.reserved_quantity || 0),
        reservation_status: data.reservation_status || 'active',
        reservation_token: data.reservation_token || '',
        expected_use_date: data.expected_use_date || '',
        consumer_reference: (data.metadata || {}).consumer_reference || '',
      },
      metadata: { mode: 'derived-canonical', source: 'uim_inventory_reservations' },
      created_at: toIso(data.created_at || data.updated_at),
      updated_at: toIso(data.updated_at || data.created_at),
    };
  }

  if (node === 'locations') {
    const { data, error } = await supabaseAdmin
      .from('uim_inventory_items')
      .select('id, location_type, metadata, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: String(data.id),
      tenant_id: tenantId,
      franchise_id: franchiseId,
      node_key: node,
      payload: {
        location_code: String((data.metadata || {}).location_code || data.id),
        location_name: String((data.metadata || {}).location_name || data.location_type || 'Warehouse Location'),
        city: String((data.metadata || {}).city || ''),
        state_region: String((data.metadata || {}).state_region || ''),
        country_code: String((data.metadata || {}).country_code || ''),
      },
      metadata: { mode: 'derived-canonical', source: 'uim_inventory_items' },
      created_at: toIso(data.created_at || data.updated_at),
      updated_at: toIso(data.updated_at || data.created_at),
    };
  }

  if (node === 'overview' || node === 'analytics') {
    const list = await listDatabaseBackedUimFormRecords(req, node, 1, 0);
    return list?.records?.[0] || null;
  }

  return null;
}

function sendJson(res, status, payload) {
  setCors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function normalizeSeedCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 800;
  const rounded = Math.floor(parsed);
  if (rounded < 500) return 500;
  if (rounded > 1000) return 1000;
  return rounded;
}

function clearTenantSeedData(tenantId) {
  for (const [id, record] of store.entries()) {
    if (record?.tenant_id === tenantId) store.delete(id);
  }
  for (const [id, row] of catalog.entries()) {
    if (row?.tenant_id === tenantId) catalog.delete(id);
  }
  for (const [id, row] of inventoryItems.entries()) {
    if (row?.tenant_id === tenantId) inventoryItems.delete(id);
  }
  for (const [id, row] of reservations.entries()) {
    if (row?.tenant_id === tenantId) reservations.delete(id);
  }
  for (let i = ledger.length - 1; i >= 0; i -= 1) {
    if (ledger[i]?.tenant_id === tenantId) ledger.splice(i, 1);
  }
  for (const [id, row] of projectionSnapshots.entries()) {
    if (row?.tenant_id === tenantId) projectionSnapshots.delete(id);
  }
}

function createSeededFormRecord(nodeKey, tenantId, franchiseId, payload) {
  const now = new Date().toISOString();
  const id = randomUUID();
  store.set(id, {
    id,
    tenant_id: tenantId,
    franchise_id: franchiseId,
    node_key: nodeKey,
    payload,
    metadata: { mode: 'dev-mock', seed_source: 'uim-mro-seeding' },
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
}

function seedTenantMroDataset({ tenantId, franchiseId, targetCount }) {
  clearTenantSeedData(tenantId);
  const count = normalizeSeedCount(targetCount);
  const manufacturers = ['CFM', 'Honeywell', 'Collins', 'Safran', 'Parker', 'Liebherr'];
  const ataChapters = ['21', '24', '27', '28', '29', '32', '49', '52', '71'];
  const nowIso = new Date().toISOString();

  createSeededFormRecord('overview', tenantId, franchiseId, {
    tenant: tenantId,
    summary: 'UIM MRO seed dataset ready',
    seeded_records: count,
    status: 'active',
  });
  createSeededFormRecord('analytics', tenantId, franchiseId, {
    dashboard_seed: true,
    status: 'active',
    seeded_records: count,
    note: 'MRO seed dataset applied via mock seeding endpoint',
  });
  createSeededFormRecord('locations', tenantId, franchiseId, {
    primary_location: `${tenantId.toUpperCase()}-MRO-MAIN`,
    line_location: `${tenantId.toUpperCase()}-LINE`,
    quarantine_location: `${tenantId.toUpperCase()}-QUAR`,
    status: 'active',
  });

  for (let i = 1; i <= count; i += 1) {
    const category = ['rotable', 'consumable', 'tooling', 'equipment'][i % 4] || 'rotable';
    const maintenanceCategory = i % 12 === 0 ? 'emergency-spare' : category;
    const manufacturer = manufacturers[i % manufacturers.length] || 'CFM';
    const ataChapter = ataChapters[i % ataChapters.length] || '21';
    const availableQty = category === 'consumable' ? 10 + (i % 80) : 1;
    const reservedQty = i % 11 === 0 ? 1 : 0;
    const consumedQty = i % 13 === 0 ? 1 : 0;
    const status = i % 25 === 0 ? 'in_transit' : 'available';
    const sku = `UIM-MRO-${String(i).padStart(6, '0')}`;
    const partNumber = `MRO-PN-${String(700000 + i).padStart(8, '0')}`;
    const serialNumber = `SER-${String(900000 + i).padStart(8, '0')}`;
    const inventoryId = `${tenantId}-item-${i}`;
    const catalogId = `${tenantId}-catalog-${i}`;

    catalog.set(catalogId, {
      id: catalogId,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      sku,
      part_number: partNumber,
      title: `MRO Component ${i}`,
      category,
      manufacturer_name: manufacturer,
      ata_chapter_code: ataChapter,
      created_at: nowIso,
      updated_at: nowIso,
    });

    inventoryItems.set(inventoryId, {
      id: inventoryId,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      catalog_item_id: catalogId,
      serial_number: serialNumber,
      batch_lot_number: `LOT-${String(600000 + i).padStart(8, '0')}`,
      quantity: availableQty,
      status,
      location_type: 'warehouse',
      created_at: nowIso,
      updated_at: nowIso,
    });

    projectionSnapshots.set(inventoryId, {
      id: randomUUID(),
      tenant_id: tenantId,
      franchise_id: franchiseId,
      inventory_item_id: inventoryId,
      projected_available_quantity: availableQty,
      projected_reserved_quantity: reservedQty,
      projected_consumed_quantity: consumedQty,
      last_ledger_id: null,
      last_ledger_at: nowIso,
      replay_version: 2,
      updated_at: nowIso,
      // Enriched attributes consumed by UIM UI projection rendering
      catalog_item_id: catalogId,
      sku,
      part_number: partNumber,
      title: `MRO Component ${i}`,
      category,
      serial_number: serialNumber,
      batch_lot_number: `LOT-${String(600000 + i).padStart(8, '0')}`,
      inventory_status: status,
      inventory_location_type: 'warehouse',
      maintenance_category: maintenanceCategory,
      ata_chapter_code: ataChapter,
      ata_sub_chapter_code: String((i % 10) + 1).padStart(2, '0'),
      ata_section_code: String((i % 7) + 1).padStart(2, '0'),
      condition_code: i % 20 === 0 ? 'INSP' : 'SV',
      certification_status: i % 18 === 0 ? 'expiring' : 'valid',
      aog_priority: i % 12 === 0,
    });

    if (i <= 180) {
      createSeededFormRecord('item-master', tenantId, franchiseId, {
        sku,
        part_number: partNumber,
        manufacturer_name: manufacturer,
        maintenance_category: maintenanceCategory,
        ata_chapter_code: ataChapter,
        condition_code: i % 20 === 0 ? 'INSP' : 'SV',
        certification_status: i % 18 === 0 ? 'expiring' : 'valid',
        status: 'active',
      });
    }
    if (i <= 160) {
      createSeededFormRecord('stock-ledger', tenantId, franchiseId, {
        reference: `GRN-${String(1000 + i)}`,
        part_number: partNumber,
        transaction_type: 'RECEIVE',
        quantity: availableQty,
        status: 'posted',
      });
    }
    if (i <= 120) {
      const reservationId = `${tenantId}-res-${i}`;
      reservations.set(reservationId, {
        id: reservationId,
        tenant_id: tenantId,
        franchise_id: franchiseId,
        inventory_item_id: inventoryId,
        catalog_item_id: catalogId,
        reserved_quantity: reservedQty,
        reservation_status: reservedQty > 0 ? 'active' : 'fulfilled',
        reservation_token: `${tenantId}-resv-${i}`,
      });
      createSeededFormRecord('reservations', tenantId, franchiseId, {
        reservation_token: `${tenantId}-resv-${i}`,
        part_number: partNumber,
        reserved_quantity: reservedQty,
        status: reservedQty > 0 ? 'active' : 'fulfilled',
      });
      createSeededFormRecord('issue-consume', tenantId, franchiseId, {
        reference: `WP-${String(2000 + i)}`,
        part_number: partNumber,
        transaction_type: 'CONSUME',
        quantity: consumedQty || 1,
        status: 'posted',
      });
      createSeededFormRecord('restock', tenantId, franchiseId, {
        reference: `PO-${String(3000 + i)}`,
        part_number: partNumber,
        transaction_type: 'RECEIVE',
        quantity: availableQty,
        status: 'posted',
      });
    }
  }

  return {
    count,
    catalog_items: [...catalog.values()].filter((row) => row.tenant_id === tenantId).length,
    inventory_items: [...inventoryItems.values()].filter((row) => row.tenant_id === tenantId).length,
    profile_items: [...projectionSnapshots.values()].filter((row) => row.tenant_id === tenantId).length,
    projection_snapshots: [...projectionSnapshots.values()].filter((row) => row.tenant_id === tenantId).length,
  };
}

function seedMockFormRecords() {
  const now = new Date().toISOString();
  const seeds = [
    ['overview', { tenant: 'Deccan', summary: 'AMRO inventory overview', status: 'active' }],
    ['item-master', { sku: 'DECCAN-AMRO-PUMP-001', part_number: 'DCC-PN-1001', status: 'active' }],
    ['stock-ledger', { reference: 'DECCAN-GRN-0001', transaction_type: 'RECEIVE', status: 'active' }],
    ['reservations', { reservation_token: 'deccan-amro-reservation-001', reserved_quantity: 5, status: 'active' }],
    ['issue-consume', { reference: 'DECCAN-WP-0001', transaction_type: 'CONSUME', status: 'active' }],
    ['restock', { reference: 'DECCAN-GRN-0001', transaction_type: 'RECEIVE', status: 'active' }],
    ['locations', { primary_location: 'DECCAN-MRO-MAIN', line_location: 'DECCAN-LINE', status: 'active' }],
    ['analytics', { dashboard_seed: true, kpi_hint: 'deccan-amro-inventory', status: 'active' }],
  ];

  for (const [nodeKey, payload] of seeds) {
    const idTenant = randomUUID();
    store.set(idTenant, {
      id: idTenant,
      tenant_id: MOCK_DECCAN_TENANT_ID,
      franchise_id: MOCK_DECCAN_FRANCHISE_ID,
      node_key: nodeKey,
      payload,
      metadata: { mode: 'dev-mock', seed_source: 'uim-mock-api', tenant: 'deccan' },
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    // Keep a second "dev-tenant" copy so local requests without headers still return data.
    const idDev = randomUUID();
    store.set(idDev, {
      id: idDev,
      tenant_id: 'dev-tenant',
      franchise_id: null,
      node_key: nodeKey,
      payload,
      metadata: { mode: 'dev-mock', seed_source: 'uim-mock-api', tenant: 'dev-tenant' },
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
  }

  const projectionNow = new Date().toISOString();
  projectionSnapshots.set('deccan-item-1', {
    id: randomUUID(),
    tenant_id: MOCK_DECCAN_TENANT_ID,
    franchise_id: MOCK_DECCAN_FRANCHISE_ID,
    inventory_item_id: 'deccan-item-1',
    projected_available_quantity: 55,
    projected_reserved_quantity: 5,
    projected_consumed_quantity: 7,
    last_ledger_id: null,
    last_ledger_at: projectionNow,
    replay_version: 2,
    updated_at: projectionNow,
  });
}

if (UIM_MOCK_AUTO_SEED) {
  seedMockFormRecords();
  seedTenantMroDataset({
    tenantId: MOCK_DECCAN_TENANT_ID,
    franchiseId: MOCK_DECCAN_FRANCHISE_ID,
    targetCount: 800,
  });
  seedTenantMroDataset({
    tenantId: 'dev-tenant',
    franchiseId: null,
    targetCount: 800,
  });
}

function readNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeAnalyticsKpis(lowStockThreshold = 5) {
  const snapshots = [...projectionSnapshots.values()];
  const totalTrackedItems = inventoryItems.size;
  let available = 0;
  let reserved = 0;
  let consumed = 0;
  let lowStock = 0;
  let replayVersion = 0;
  snapshots.forEach((snapshot) => {
    const a = readNumber(snapshot.projected_available_quantity);
    const r = readNumber(snapshot.projected_reserved_quantity);
    const c = readNumber(snapshot.projected_consumed_quantity);
    available += a;
    reserved += r;
    consumed += c;
    if (a <= lowStockThreshold) lowStock += 1;
    replayVersion = Math.max(replayVersion, readNumber(snapshot.replay_version));
  });
  let inTransit = 0;
  for (const item of inventoryItems.values()) {
    if (String(item.status || '') === 'in_transit') inTransit += 1;
  }
  const ratio = Number((consumed / Math.max(1, available + reserved)).toFixed(4));
  return {
    kpis: {
      total_tracked_items: totalTrackedItems,
      available_quantity: available,
      reserved_quantity: reserved,
      consumed_quantity: consumed,
      in_transit_items: inTransit,
      low_stock_items: lowStock,
      inventory_turnover_ratio: ratio,
    },
    snapshot: {
      replay_version: replayVersion,
      generated_at: new Date().toISOString(),
    },
  };
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const server = createServer(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname;
  const method = String(req.method || 'GET').toUpperCase();

  if (method === 'GET' && pathname === '/health') {
    sendJson(res, 200, { status: 'ok', service: 'uim-api', mode: 'dev-mock', timestamp: new Date().toISOString() });
    return;
  }
  if (method === 'GET' && pathname === '/api/v2/uim/health') {
    sendJson(res, 200, { status: 'ok', interface: 'uim-api', mode: 'dev-mock', timestamp: new Date().toISOString() });
    return;
  }

  const listMatch = pathname.match(/^\/api\/v2\/uim\/forms\/([^/]+)$/);
  const recordMatch = pathname.match(/^\/api\/v2\/uim\/forms\/([^/]+)\/([^/]+)$/);
  const commandMatch = pathname.match(/^\/api\/v2\/uim\/commands$/);
  const replayMatch = pathname.match(/^\/api\/v2\/uim\/projections\/replay$/);
  const projectionItemsMatch = pathname.match(/^\/api\/v2\/uim\/projections\/items$/);
  const restIntegrationMatch = pathname.match(/^\/api\/v2\/uim\/integrations\/rest$/);
  const webhookMatch = pathname.match(/^\/api\/v2\/uim\/webhooks$/);
  const connectorManifestMatch = pathname.match(/^\/api\/v2\/uim\/connectors\/manifests$/);
  const integrationContractsMatch = pathname.match(/^\/api\/v2\/uim\/integration-contracts$/);
  const openapiMatch = pathname.match(/^\/api\/v2\/uim\/contracts\/openapi-3\.1\.yaml$/);
  const analyticsKpisMatch = pathname.match(/^\/api\/v2\/uim\/analytics\/kpis$/);
  const analyticsEtlMatch = pathname.match(/^\/api\/v2\/uim\/analytics\/etl$/);
  const analyticsReconciliationMatch = pathname.match(/^\/api\/v2\/uim\/analytics\/reconciliation$/);
  const analyticsBiCubeMatch = pathname.match(/^\/api\/v2\/uim\/analytics\/bi-cube$/);
  const analyticsQaSignoffMatch = pathname.match(/^\/api\/v2\/uim\/analytics\/qa-signoff$/);
  const analyticsSlaEvidenceMatch = pathname.match(/^\/api\/v2\/uim\/analytics\/sla-evidence$/);
  const seedingMroMatch = pathname.match(/^\/api\/v2\/uim\/seeding\/mro$/);
  const platformDomainsMatch = pathname.match(/^\/api\/v1\/platform-domains$/);

  if (seedingMroMatch && method === 'GET') {
    const { tenantId, franchiseId } = resolveTenant(req);
    const seeded = {
      catalog_items: [...catalog.values()].filter((row) => row.tenant_id === tenantId).length,
      inventory_items: [...inventoryItems.values()].filter((row) => row.tenant_id === tenantId).length,
      profile_items: [...projectionSnapshots.values()].filter((row) => row.tenant_id === tenantId).length,
      projection_snapshots: [...projectionSnapshots.values()].filter((row) => row.tenant_id === tenantId).length,
    };
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-mro-seeding-status',
      output: {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        seed_limits: { min: 500, max: 1000, default: 800 },
        seeded,
      },
    });
    return;
  }

  if (seedingMroMatch && method === 'POST') {
    const body = await parseBody(req);
    const { tenantId, franchiseId } = resolveTenant(req);
    const targetCount = normalizeSeedCount(body.target_count);
    const dryRun = String(body.dry_run || '').trim().toLowerCase() === 'true' || body.dry_run === true;
    if (dryRun) {
      const sample = Array.from({ length: 5 }).map((_, i) => ({
        sku: `UIM-MRO-${String(i + 1).padStart(6, '0')}`,
        part_number: `MRO-PN-${String(700001 + i).padStart(8, '0')}`,
        maintenance_category: (i + 1) % 4 === 0 ? 'equipment' : 'rotable',
      }));
      sendJson(res, 200, {
        version: 'v2',
        interface: 'uim-mro-seeding-preview',
        output: {
          tenant_id: tenantId,
          franchise_id: franchiseId,
          target_count: targetCount,
          sample,
        },
      });
      return;
    }
    const seeded = seedTenantMroDataset({ tenantId, franchiseId, targetCount });
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-mro-seeding',
      output: {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        seeded_count: seeded.count,
        seeded,
      },
    });
    return;
  }

  if (platformDomainsMatch && method === 'GET') {
    sendJson(res, 200, {
      data: {
        domains: MOCK_PLATFORM_DOMAINS,
        tenantDomainCount: MOCK_PLATFORM_DOMAINS.length,
        tenantId: MOCK_DECCAN_TENANT_ID,
        isPlatformAdmin: true,
      },
      correlationId: String(getHeader(req, 'x-correlation-id') || randomUUID()),
      version: 'v1',
    });
    return;
  }

  if (restIntegrationMatch && method === 'POST') {
    const body = await parseBody(req);
    const iface = String(body.interface || '').trim().toLowerCase();
    if (iface === 'rest-hardening-audit') {
      const expectedP95 = readNumber(body.expected_p95_ms) || 300;
      const observedP95 = readNumber(body.observed_p95_ms);
      const expectedAvailability = readNumber(body.expected_availability_percent) || 99.9;
      const observedAvailability = readNumber(body.observed_availability_percent);
      const status = observedP95 <= expectedP95 && observedAvailability >= expectedAvailability ? 'within_budget' : 'breach';
      sendJson(res, 200, {
        version: 'v2',
        interface: 'uim-rest-hardening',
        output: {
          controls: {
            idempotency_enabled: true,
            schema_validation_enabled: true,
            authz_validation_enabled: true,
            compatibility_mode: 'strict-v2',
          },
          sla: {
            expected_p95_ms: expectedP95,
            observed_p95_ms: observedP95,
            expected_availability_percent: expectedAvailability,
            observed_availability_percent: observedAvailability,
            error_budget_status: status,
          },
        },
      });
      return;
    }
    if (iface === 'contract-compatibility-report') {
      const requested = String(body.requested_schema_version || 'v0.6');
      const provided = String(body.provided_schema_version || 'v0.6');
      sendJson(res, 200, {
        version: 'v2',
        interface: 'uim-rest-hardening',
        output: {
          consumer_module: String(body.consumer_module || 'unknown-consumer'),
          requested_schema_version: requested,
          provided_schema_version: provided,
          compatibility_status: requested === provided ? 'compatible' : 'incompatible',
          report_id: `report-${Date.now()}`,
        },
      });
      return;
    }
    sendJson(res, 400, { error: 'Unsupported interface', code: 'BAD_REQUEST', statusCode: 400 });
    return;
  }

  if (webhookMatch && method === 'GET') {
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-webhook-adapter-framework',
      output: {
        adapters: [...webhookAdapters.values()],
      },
    });
    return;
  }

  if (webhookMatch && method === 'POST') {
    const body = await parseBody(req);
    const action = String(body.action || '').trim().toLowerCase();
    if (action === 'register-adapter') {
      const adapterId = String(body.adapter_id || '').trim();
      const adapter = {
        adapter_id: adapterId,
        provider: String(body.provider || ''),
        target_url: String(body.target_url || ''),
        secret_ref: String(body.secret_ref || ''),
        subscribed_events: Array.isArray(body.subscribed_events) ? body.subscribed_events.map((x) => String(x)) : [],
        active: true,
        created_at: new Date().toISOString(),
      };
      webhookAdapters.set(adapterId, adapter);
      sendJson(res, 200, {
        version: 'v2',
        interface: 'uim-webhook-adapter-framework',
        output: { action: 'register-adapter', adapter },
      });
      return;
    }
    if (action === 'dispatch-event') {
      const adapterId = String(body.adapter_id || '').trim();
      const eventType = String(body.event_type || '').trim();
      const adapter = webhookAdapters.get(adapterId);
      if (!adapter || !adapter.active) {
        sendJson(res, 404, { error: 'adapter_id is not registered/active', code: 'ADAPTER_NOT_FOUND', statusCode: 404 });
        return;
      }
      if (!adapter.subscribed_events.includes(eventType)) {
        sendJson(res, 409, { error: 'adapter is not subscribed to event_type', code: 'EVENT_NOT_SUBSCRIBED', statusCode: 409 });
        return;
      }
      sendJson(res, 200, {
        version: 'v2',
        interface: 'uim-webhook-adapter-framework',
        output: {
          action: 'dispatch-event',
          dispatch_id: `${adapterId}-${Date.now()}`,
          adapter_id: adapterId,
          event_type: eventType,
          status: 'queued',
          target_url: adapter.target_url,
          payload_size: JSON.stringify(body.payload || {}).length,
        },
      });
      return;
    }
    sendJson(res, 400, { error: 'Unsupported action', code: 'BAD_REQUEST', statusCode: 400 });
    return;
  }

  if (connectorManifestMatch && method === 'GET') {
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-connector-manifests',
      output: {
        connector_manifests: CONNECTOR_MANIFESTS,
      },
    });
    return;
  }

  if (integrationContractsMatch && method === 'GET') {
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-integration-contracts',
      output: {
        analytics: {
          kpiPath: '/api/v2/uim/analytics/kpis',
          etlPath: '/api/v2/uim/analytics/etl',
          reconciliationPath: '/api/v2/uim/analytics/reconciliation',
          biCubePath: '/api/v2/uim/analytics/bi-cube',
          qaSignoffPath: '/api/v2/uim/analytics/qa-signoff',
          slaEvidencePath: '/api/v2/uim/analytics/sla-evidence',
        },
      },
    });
    return;
  }

  if (openapiMatch && method === 'GET') {
    setCors(res);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    res.end(`openapi: 3.1.0
info:
  title: UIM Integration API
  version: 0.8.0
paths:
  /analytics/kpis:
    get:
      summary: UIM analytics KPI model snapshot
  /analytics/etl:
    get:
      summary: UIM ETL scheduler queue status and telemetry
  /analytics/reconciliation:
    get:
      summary: UIM reporting reconciliation readiness checks
  /analytics/bi-cube:
    get:
      summary: UIM BI cube deployment artifact and published data dictionary
  /analytics/qa-signoff:
    get:
      summary: UIM reporting QA sign-off workflow state
  /analytics/sla-evidence:
    get:
      summary: UIM Phase 4 v0.8 latency and SLA evidence package
`);
    return;
  }

  if (analyticsKpisMatch && method === 'GET') {
    const threshold = Math.max(0, Number.parseInt(String(url.searchParams.get('low_stock_threshold') || '5'), 10) || 5);
    const kpiOutput = computeAnalyticsKpis(threshold);
    const { tenantId, franchiseId } = resolveTenant(req);
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-analytics-kpis',
      output: {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        low_stock_threshold: threshold,
        phase4_prep: {
          sequence: [
            'kpi-model-definitions',
            'etl-jobs',
            'dashboard-fe',
            'bi-semantic-cube-and-data-dictionary',
            'reporting-qa-and-reconciliation',
          ],
          kpi_model_definitions: UIM_ANALYTICS_KPI_MODEL_DEFINITIONS,
          semantic_dictionary: UIM_ANALYTICS_SEMANTIC_DICTIONARY,
          performance_targets: {
            dashboard_latency_target_ms: 2200,
            source: 'mock-default',
          },
        },
        ...kpiOutput,
      },
    });
    return;
  }

  if (analyticsEtlMatch && method === 'GET') {
    const { tenantId, franchiseId } = resolveTenant(req);
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-analytics-etl',
      output: {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        scheduler_running: etlState.scheduler_running,
        queue: etlState.queue,
        telemetry: etlState.telemetry,
      },
    });
    return;
  }

  if (analyticsEtlMatch && method === 'POST') {
    const body = await parseBody(req);
    const action = String(body.action || '').trim().toLowerCase();
    if (action === 'start-scheduler') etlState.scheduler_running = true;
    if (action === 'stop-scheduler') etlState.scheduler_running = false;
    if (action === 'schedule-run') etlState.queue.queued += 1;
    if (action === 'process-now') {
      etlState.queue.completed += etlState.queue.queued;
      etlState.telemetry.total_runs += 1;
      etlState.telemetry.completed_runs += 1;
      etlState.telemetry.latest_completed_at = new Date().toISOString();
      etlState.queue.queued = 0;
    }
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-analytics-etl',
      output: {
        action,
        scheduler_running: etlState.scheduler_running,
        queue: etlState.queue,
        telemetry: etlState.telemetry,
      },
    });
    return;
  }

  if (analyticsReconciliationMatch && method === 'GET') {
    const { tenantId, franchiseId } = resolveTenant(req);
    const kpiOutput = computeAnalyticsKpis(5);
    const checks = [
      {
        key: 'projection_replay_checkpoint',
        label: 'Projection replay checkpoint present',
        passed: Number(kpiOutput.snapshot.replay_version || 0) > 0,
        details: `Replay version ${Number(kpiOutput.snapshot.replay_version || 0)}`,
      },
      {
        key: 'etl_failure_clear',
        label: 'ETL failure queue clear',
        passed: Number(etlState.telemetry.failed_runs || 0) === 0,
        details: `Failed runs ${Number(etlState.telemetry.failed_runs || 0)}`,
      },
    ];
    const passCount = checks.filter((x) => x.passed).length;
    const score = Math.round((passCount / checks.length) * 100);
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-analytics-reconciliation',
      output: {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        readiness: {
          status: passCount === checks.length ? 'ready' : 'pending',
          score,
          checks,
        },
        snapshot: {
          replay_version: Number(kpiOutput.snapshot.replay_version || 0),
          generated_at: kpiOutput.snapshot.generated_at,
          etl_completed_runs: Number(etlState.telemetry.completed_runs || 0),
          etl_failed_runs: Number(etlState.telemetry.failed_runs || 0),
        },
      },
    });
    return;
  }

  if (analyticsBiCubeMatch && method === 'GET') {
    const { tenantId, franchiseId } = resolveTenant(req);
    const publishedAt = new Date().toISOString();
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-analytics-bi-cube',
      output: {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        deployment_artifact: {
          artifact_id: `uim-bi-cube-${Date.now()}`,
          artifact_hash: `${Date.now().toString(16)}mock`,
          artifact_version: UIM_ANALYTICS_SEMANTIC_DICTIONARY.version,
          published_at: publishedAt,
          deployment_target: 'uim_inventory_analytics_cube',
        },
        data_dictionary: {
          ...UIM_ANALYTICS_SEMANTIC_DICTIONARY,
          kpi_model_definitions: UIM_ANALYTICS_KPI_MODEL_DEFINITIONS,
          publication_status: 'published',
        },
      },
    });
    return;
  }

  if (analyticsQaSignoffMatch && method === 'GET') {
    const { tenantId, franchiseId } = resolveTenant(req);
    const records = qaSignoffRecords
      .filter((record) => record.tenant_id === tenantId && (franchiseId ? record.franchise_id === franchiseId : true))
      .sort((a, b) => (a.signed_off_at < b.signed_off_at ? 1 : -1));
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-analytics-qa-signoff',
      output: {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        latest: records[0] || null,
        records,
      },
    });
    return;
  }

  if (analyticsQaSignoffMatch && method === 'POST') {
    const { tenantId, franchiseId } = resolveTenant(req);
    const body = await parseBody(req);
    const record = {
      signoff_id: `uim-signoff-${Date.now()}`,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      signoff_status: String(body.signoff_status || '').trim().toLowerCase() === 'revoked' ? 'revoked' : 'signed_off',
      signed_off_by: String(body.signed_off_by || 'system.user@uim.local'),
      signed_off_role: String(body.signed_off_role || 'qa_lead'),
      signed_off_at: new Date().toISOString(),
      checklist: {
        reconciliation_verified: Boolean(body.reconciliation_verified),
        latency_target_met: Boolean(body.latency_target_met),
        data_dictionary_published: Boolean(body.data_dictionary_published),
        bi_cube_deployed: Boolean(body.bi_cube_deployed),
      },
      notes: String(body.notes || ''),
    };
    qaSignoffRecords.push(record);
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-analytics-qa-signoff',
      output: {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        signoff: record,
      },
    });
    return;
  }

  if (analyticsSlaEvidenceMatch && method === 'GET') {
    const { tenantId, franchiseId } = resolveTenant(req);
    const latestSignoff = [...qaSignoffRecords]
      .filter((record) => record.tenant_id === tenantId && (franchiseId ? record.franchise_id === franchiseId : true))
      .sort((a, b) => (a.signed_off_at < b.signed_off_at ? 1 : -1))[0] || null;
    const checks = [
      { key: 'kpi_model_complete', passed: UIM_ANALYTICS_KPI_MODEL_DEFINITIONS.length >= 7, details: 'kpi defs loaded' },
      { key: 'semantic_dictionary_complete', passed: true, details: 'dictionary published' },
      { key: 'etl_failures_clear', passed: Number(etlState.telemetry.failed_runs || 0) === 0, details: `failed_runs=${etlState.telemetry.failed_runs}` },
      { key: 'qa_signoff_present', passed: Boolean(latestSignoff && latestSignoff.signoff_status === 'signed_off'), details: latestSignoff ? latestSignoff.signoff_status : 'none' },
    ];
    const passCount = checks.filter((x) => x.passed).length;
    const score = Math.round((passCount / checks.length) * 100);
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-analytics-sla-evidence',
      output: {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        gate: 'v0.8-phase-4-exit',
        generated_at: new Date().toISOString(),
        performance_targets: {
          dashboard_latency_target_ms: 2200,
        },
        evidence_checks: checks,
        readiness_score: score,
        status: score === 100 ? 'ready' : 'pending',
      },
    });
    return;
  }

  if (commandMatch && method === 'POST') {
    const body = await parseBody(req);
    const commandType = String(body.command_type || '').toUpperCase();
    const payload = body.command_payload && typeof body.command_payload === 'object' ? body.command_payload : {};
    const idempotencyKey = String(body.idempotency_key || '').trim();
    if (!['RECEIVE', 'MOVE', 'RESERVE', 'CONSUME'].includes(commandType)) {
      sendJson(res, 422, { error: 'Unsupported command_type', code: 'INVALID_COMMAND' });
      return;
    }
    if (idempotencyKey && commands.has(idempotencyKey)) {
      sendJson(res, 200, {
        version: 'v2',
        interface: 'uim-command-handler',
        output: {
          replayed: true,
          command: commands.get(idempotencyKey),
        },
      });
      return;
    }

    const commandId = randomUUID();
    const commandRecord = {
      id: commandId,
      command_type: commandType,
      command_payload: payload,
      command_status: 'applied',
      applied_at: new Date().toISOString(),
    };
    if (idempotencyKey) commands.set(idempotencyKey, commandRecord);

    let appliedOutput = {};
    if (commandType === 'RECEIVE') {
      const catalogId = String(payload.catalog_item_id || '').trim() || randomUUID();
      if (!catalog.has(catalogId)) {
        catalog.set(catalogId, {
          id: catalogId,
          sku: String(payload.sku || `SKU-${Date.now().toString(36)}`),
          title: String(payload.title || payload.item_name || 'UIM Item'),
        });
      }
      const itemId = randomUUID();
      const quantity = Math.max(0, readNumber(payload.quantity));
      inventoryItems.set(itemId, {
        id: itemId,
        catalog_item_id: catalogId,
        quantity,
        status: 'available',
      });
      ledger.push({
        id: randomUUID(),
        inventory_item_id: itemId,
        transaction_type: 'RECEIVE',
        quantity_changed: quantity,
        created_at: new Date().toISOString(),
      });
      appliedOutput = { inventory_item_id: itemId, quantity };
    } else if (commandType === 'MOVE') {
      const itemId = String(payload.inventory_item_id || '').trim();
      const existing = inventoryItems.get(itemId);
      if (!existing) {
        sendJson(res, 404, { error: 'Inventory item not found', code: 'INVENTORY_ITEM_NOT_FOUND' });
        return;
      }
      const moved = {
        ...existing,
        location_id: payload.to_location_id || null,
      };
      inventoryItems.set(itemId, moved);
      ledger.push({
        id: randomUUID(),
        inventory_item_id: itemId,
        transaction_type: 'MOVE',
        quantity_changed: 0,
        created_at: new Date().toISOString(),
      });
      appliedOutput = { inventory_item_id: itemId, to_location_id: moved.location_id };
    } else if (commandType === 'RESERVE') {
      const itemId = String(payload.inventory_item_id || '').trim();
      const item = inventoryItems.get(itemId);
      if (!item) {
        sendJson(res, 404, { error: 'Inventory item not found', code: 'INVENTORY_ITEM_NOT_FOUND' });
        return;
      }
      const quantity = Math.max(0, readNumber(payload.quantity));
      if (item.quantity < quantity) {
        sendJson(res, 409, { error: 'Insufficient quantity', code: 'UIM_INSUFFICIENT_AVAILABLE_QUANTITY' });
        return;
      }
      const reservationId = randomUUID();
      reservations.set(reservationId, {
        id: reservationId,
        inventory_item_id: itemId,
        catalog_item_id: payload.catalog_item_id || item.catalog_item_id || null,
        reserved_quantity: quantity,
        reservation_status: 'active',
        reservation_token: String(payload.reservation_token || `uim-resv-${Date.now().toString(36)}`),
      });
      ledger.push({
        id: randomUUID(),
        inventory_item_id: itemId,
        transaction_type: 'RESERVE',
        quantity_changed: quantity,
        reservation_id: reservationId,
        created_at: new Date().toISOString(),
      });
      appliedOutput = { reservation_id: reservationId, reserved_quantity: quantity };
    } else if (commandType === 'CONSUME') {
      const itemId = String(payload.inventory_item_id || '').trim();
      const item = inventoryItems.get(itemId);
      if (!item) {
        sendJson(res, 404, { error: 'Inventory item not found', code: 'INVENTORY_ITEM_NOT_FOUND' });
        return;
      }
      const quantity = Math.max(0, readNumber(payload.quantity));
      if (item.quantity < quantity) {
        sendJson(res, 409, { error: 'Insufficient quantity', code: 'UIM_INSUFFICIENT_AVAILABLE_QUANTITY' });
        return;
      }
      const remaining = Number((item.quantity - quantity).toFixed(4));
      const updated = { ...item, quantity: remaining, status: remaining <= 0 ? 'consumed' : 'available' };
      inventoryItems.set(itemId, updated);
      const reservationId = String(payload.reservation_id || '').trim() || null;
      if (reservationId && reservations.has(reservationId)) {
        reservations.set(reservationId, {
          ...reservations.get(reservationId),
          reservation_status: 'fulfilled',
        });
      }
      ledger.push({
        id: randomUUID(),
        inventory_item_id: itemId,
        transaction_type: 'CONSUME',
        quantity_changed: quantity,
        reservation_id: reservationId,
        created_at: new Date().toISOString(),
      });
      appliedOutput = { inventory_item_id: itemId, remaining_quantity: remaining };
    }

    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-command-handler',
      output: {
        command_id: commandId,
        command_type: commandType,
        command_status: 'applied',
        applied_output: appliedOutput,
      },
    });
    return;
  }

  if (replayMatch && method === 'POST') {
    projectionSnapshots.clear();
    for (const event of ledger) {
      const itemId = String(event.inventory_item_id || '');
      if (!itemId) continue;
      const current = projectionSnapshots.get(itemId) || {
        id: randomUUID(),
        inventory_item_id: itemId,
        projected_available_quantity: 0,
        projected_reserved_quantity: 0,
        projected_consumed_quantity: 0,
        last_ledger_id: null,
        last_ledger_at: null,
        replay_version: Date.now(),
        updated_at: new Date().toISOString(),
      };
      const quantity = readNumber(event.quantity_changed);
      if (event.transaction_type === 'RECEIVE' || event.transaction_type === 'ADJUST' || event.transaction_type === 'RETURN') {
        current.projected_available_quantity += quantity;
      } else if (event.transaction_type === 'RESERVE') {
        current.projected_available_quantity -= quantity;
        current.projected_reserved_quantity += quantity;
      } else if (event.transaction_type === 'RELEASE') {
        current.projected_available_quantity += quantity;
        current.projected_reserved_quantity -= quantity;
      } else if (event.transaction_type === 'CONSUME') {
        current.projected_reserved_quantity = Math.max(0, current.projected_reserved_quantity - quantity);
        current.projected_consumed_quantity += quantity;
      } else if (event.transaction_type === 'SCRAP') {
        current.projected_available_quantity -= quantity;
      }
      current.last_ledger_id = event.id;
      current.last_ledger_at = event.created_at;
      current.updated_at = new Date().toISOString();
      projectionSnapshots.set(itemId, current);
    }
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-projection-replay',
      output: {
        replayed_events: ledger.length,
        updated_snapshots: projectionSnapshots.size,
      },
    });
    return;
  }

  if (projectionItemsMatch && method === 'GET') {
    const limit = Math.min(Math.max(Number.parseInt(String(url.searchParams.get('limit') || '50'), 10) || 50, 1), 500);
    const offset = Math.max(Number.parseInt(String(url.searchParams.get('offset') || '0'), 10) || 0, 0);
    const snapshots = [...projectionSnapshots.values()];
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-projection-items-query',
      output: {
        pagination: {
          limit,
          offset,
          total: snapshots.length,
        },
        snapshots: snapshots.slice(offset, offset + limit),
      },
    });
    return;
  }

  if (listMatch && method === 'GET') {
    const node = listMatch[1];
    if (!NODE_KEYS.has(node)) {
      sendJson(res, 404, { error: 'UIM form node not found', code: 'UIM_FORM_NODE_NOT_FOUND', version: 'v2' });
      return;
    }
    const limit = Math.min(Math.max(Number.parseInt(String(url.searchParams.get('limit') || '25'), 10) || 25, 1), 200);
    const offset = Math.max(Number.parseInt(String(url.searchParams.get('offset') || '0'), 10) || 0, 0);
    const { tenantId, franchiseId } = resolveTenant(req);
    if (UIM_MOCK_SOURCE === 'database' && supabaseAdmin) {
      const dbOutput = await listDatabaseBackedUimFormRecords(req, node, limit, offset);
      if (dbOutput) {
        sendJson(res, 200, {
          version: 'v2',
          interface: 'uim-form-records-list',
          correlationId: String(getHeader(req, 'x-correlation-id') || randomUUID()),
          output: dbOutput,
        });
        return;
      }
    }
    let records = [...store.values()]
      .filter((record) => record.deleted_at === null)
      .filter((record) => record.tenant_id === tenantId)
      .filter((record) => record.node_key === node)
      .filter((record) => !franchiseId || record.franchise_id === franchiseId)
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

    if (records.length === 0) {
      // Local mock fallback: return node records even if tenant/franchise headers do not match seed values.
      records = [...store.values()]
        .filter((record) => record.deleted_at === null)
        .filter((record) => record.node_key === node)
        .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    }
    sendJson(res, 200, {
      version: 'v2',
      interface: 'uim-form-records-list',
      correlationId: String(getHeader(req, 'x-correlation-id') || randomUUID()),
      output: { node_key: node, count: records.length, limit, offset, records: records.slice(offset, offset + limit) },
    });
    return;
  }

  if (listMatch && method === 'POST') {
    const node = listMatch[1];
    if (!NODE_KEYS.has(node)) {
      sendJson(res, 404, { error: 'UIM form node not found', code: 'UIM_FORM_NODE_NOT_FOUND', version: 'v2' });
      return;
    }
    const { tenantId, franchiseId } = resolveTenant(req);
    const body = await parseBody(req);
    const now = new Date().toISOString();
    const id = randomUUID();
    const record = {
      id,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      node_key: node,
      payload: body,
      metadata: { mode: 'dev-mock' },
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    store.set(id, record);
    sendJson(res, 201, { version: 'v2', interface: 'uim-form-record-create', id, output: record, message: 'UIM form record created successfully' });
    return;
  }

  if (recordMatch && method === 'GET') {
    const [_, node, id] = recordMatch;
    if (UIM_MOCK_SOURCE === 'database' && supabaseAdmin) {
      const dbRecord = await getDatabaseBackedUimFormRecord(req, node, id);
      if (dbRecord) {
        sendJson(res, 200, { version: 'v2', interface: 'uim-form-record-read', output: dbRecord });
        return;
      }
    }
    const existing = store.get(id);
    if (!existing || existing.deleted_at !== null || existing.node_key !== node) {
      sendJson(res, 404, { error: 'UIM form record not found', code: 'UIM_FORM_RECORD_NOT_FOUND', version: 'v2' });
      return;
    }
    sendJson(res, 200, { version: 'v2', interface: 'uim-form-record-read', output: existing });
    return;
  }

  if (recordMatch && method === 'PATCH') {
    const [_, node, id] = recordMatch;
    const existing = store.get(id);
    if (!existing || existing.deleted_at !== null || existing.node_key !== node) {
      sendJson(res, 404, { error: 'UIM form record not found', code: 'UIM_FORM_RECORD_NOT_FOUND', version: 'v2' });
      return;
    }
    const body = await parseBody(req);
    const updated = { ...existing, payload: body, updated_at: new Date().toISOString() };
    store.set(id, updated);
    sendJson(res, 200, { version: 'v2', interface: 'uim-form-record-update', id, output: updated, message: 'UIM form record updated successfully' });
    return;
  }

  if (recordMatch && method === 'DELETE') {
    const [_, node, id] = recordMatch;
    const existing = store.get(id);
    if (!existing || existing.deleted_at !== null || existing.node_key !== node) {
      sendJson(res, 404, { error: 'UIM form record not found', code: 'UIM_FORM_RECORD_NOT_FOUND', version: 'v2' });
      return;
    }
    const deleted = { ...existing, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    store.set(id, deleted);
    sendJson(res, 200, { version: 'v2', interface: 'uim-form-record-delete', id, message: 'UIM form record deleted successfully' });
    return;
  }

  sendJson(res, 404, { error: 'Route not found', code: 'NOT_FOUND', statusCode: 404 });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[uim-mock-api] listening on port ${PORT}`);
});
