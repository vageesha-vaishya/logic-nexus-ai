import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const now = new Date();
const nowIso = now.toISOString();
const oneHourLaterIso = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
const twoHoursLaterIso = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
const tomorrowIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
const nextWeekDateIso = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const signature = crypto.randomBytes(16);
const previousHash = crypto.randomBytes(16);
const runSuffix = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

const seedUsers = [
  { key: 'tenantAdmin', email: 'deccan.tenant.admin@amro.local', role: 'tenant_admin', firstName: 'Aarav', lastName: 'Rao' },
  { key: 'franchiseAdmin', email: 'deccan.franchise.admin@amro.local', role: 'franchise_admin', firstName: 'Mira', lastName: 'Kapoor' },
  { key: 'heavyFranchiseAdmin', email: 'deccan.heavy.franchise.admin@amro.local', role: 'franchise_admin', firstName: 'Vikram', lastName: 'Pillai' },
  { key: 'planner', email: 'deccan.planner@amro.local', role: 'user', firstName: 'Nikhil', lastName: 'Mehta' },
  { key: 'technician', email: 'deccan.technician@amro.local', role: 'user', firstName: 'Kunal', lastName: 'Singh' },
  { key: 'inspector', email: 'deccan.inspector@amro.local', role: 'user', firstName: 'Riya', lastName: 'Verma' },
  { key: 'compliance', email: 'deccan.compliance@amro.local', role: 'user', firstName: 'Ira', lastName: 'Shah' },
  { key: 'certifier', email: 'deccan.certifier@amro.local', role: 'user', firstName: 'Dev', lastName: 'Iyer' },
  { key: 'store', email: 'deccan.store@amro.local', role: 'user', firstName: 'Anya', lastName: 'Patel' },
  { key: 'integration', email: 'deccan.integration@amro.local', role: 'user', firstName: 'Arjun', lastName: 'Nair' },
  { key: 'management', email: 'deccan.management@amro.local', role: 'user', firstName: 'Sara', lastName: 'Khanna' },
  { key: 'ops', email: 'deccan.ops@amro.local', role: 'user', firstName: 'Rahul', lastName: 'Jain' },
];

const moduleCrudResults = [];
const crudFailures = [];
const scopeConsistencyResults = [];

const requiredModuleIds = [
  'MOD-AMRO-01',
  'MOD-AMRO-02',
  'MOD-AMRO-03',
  'MOD-AMRO-04',
  'MOD-AMRO-05',
  'MOD-AMRO-06',
  'MOD-AMRO-07',
  'MOD-AMRO-08',
  'MOD-AMRO-09',
  'MOD-AMRO-10',
];

const requiredScreenIds = [
  'SCR-AMRO-001',
  'SCR-AMRO-002',
  'SCR-AMRO-003',
  'SCR-AMRO-004',
  'SCR-AMRO-005',
  'SCR-AMRO-006',
  'SCR-AMRO-007',
  'SCR-AMRO-008',
  'SCR-AMRO-009',
  'SCR-AMRO-010',
  'SCR-AMRO-011',
];

const ensureNoError = (error, context) => {
  if (error) {
    const message = `${context}: ${error.message || JSON.stringify(error)}`;
    throw new Error(message);
  }
};

const isMissingAuditSchemaError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('invalid schema') && message.includes('mro_audit');
};

const maybeSingle = async (query, context) => {
  const { data, error } = await query.maybeSingle();
  ensureNoError(error, context);
  return data ?? null;
};

const applyFilters = (query, columns, payload) => {
  let scoped = query;
  for (const column of columns) {
    const value = payload[column];
    scoped = value === null ? scoped.is(column, null) : scoped.eq(column, value);
  }
  return scoped;
};

const upsertReturning = async (table, payload, onConflict, context) => {
  const client = tableClient(table);
  const conflictColumns = String(onConflict || '')
    .split(',')
    .map((column) => column.trim())
    .filter(Boolean);
  const hasConflictColumns = conflictColumns.length > 0 && conflictColumns.every((column) => Object.hasOwn(payload, column));

  if (!hasConflictColumns) {
    const { data, error } = await client.insert(payload).select().single();
    ensureNoError(error, context);
    return data;
  }

  const existing = await maybeSingle(
    applyFilters(client.select('*'), conflictColumns, payload),
    `${context} (resolve existing)`
  );

  if (!existing) {
    const { data, error } = await client.insert(payload).select().single();
    ensureNoError(error, context);
    return data;
  }

  const { data, error } = await applyFilters(client.update(payload).select(), conflictColumns, payload).single();
  ensureNoError(error, context);
  return data;
};

const tableClient = (table) => {
  if (table.includes('.')) {
    const [schemaName, tableName] = table.split('.', 2);
    return supabase.schema(schemaName).from(tableName);
  }
  return supabase.from(table);
};

const verifyCrud = async ({
  moduleId,
  moduleName,
  componentName,
  table,
  createPayload,
  updatePayload,
  readMatchField,
  deleteMode = 'mutable',
}) => {
  const client = tableClient(table);
  const result = {
    moduleId,
    moduleName,
    componentName: componentName ?? table,
    table,
    create: false,
    read: false,
    update: 'skipped',
    delete: false,
    failure: null,
  };

  try {
    const { data: created, error: createError } = await client.insert(createPayload).select().single();
    ensureNoError(createError, `[${moduleId}] create ${table}`);
    result.create = Boolean(created);

    const matchValue = created[readMatchField];
    const { data: readData, error: readError } = await client.select('*').eq(readMatchField, matchValue).maybeSingle();
    ensureNoError(readError, `[${moduleId}] read ${table}`);
    result.read = Boolean(readData);

    const hasUpdate = Boolean(updatePayload && Object.keys(updatePayload).length);
    let updated = null;
    if (hasUpdate) {
      const { data: updatedData, error: updateError } = await client
        .update(updatePayload)
        .eq(readMatchField, matchValue)
        .select()
        .single();
      ensureNoError(updateError, `[${moduleId}] update ${table}`);
      updated = updatedData;
      result.update = Boolean(updated);
    }

    if (deleteMode === 'immutable') {
      result.delete = 'immutable';
    } else {
      const { error: deleteError } = await client.delete().eq(readMatchField, matchValue);
      ensureNoError(deleteError, `[${moduleId}] delete ${table}`);
      result.delete = true;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.failure = message;
    crudFailures.push({
      moduleId,
      moduleName,
      componentName: componentName ?? table,
      table,
      error: message,
    });
  }

  moduleCrudResults.push(result);
};

const verifyScopeCounts = async ({ tenantId, franchiseId, table, matchColumn = 'franchise_id' }) => {
  const { count, error } = await tableClient(table)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq(matchColumn, franchiseId);
  ensureNoError(error, `Scope count check for ${table}`);
  scopeConsistencyResults.push({
    table,
    tenantId,
    franchiseId,
    count: count ?? 0,
    isConsistent: Number(count ?? 0) > 0,
  });
};

const runGapAudit = () => {
  const moduleCatalogPath = path.resolve(process.cwd(), 'src/pages/api/v2/amro/module-catalog-model.ts');
  const screenInventoryPath = path.resolve(process.cwd(), 'src/pages/api/v2/amro/screen-inventory-model.ts');
  const screenInventoryTestPath = path.resolve(process.cwd(), 'src/pages/api/v2/amro/screen-inventory.test.ts');
  const moduleCatalogSource = fs.readFileSync(moduleCatalogPath, 'utf8');
  const screenInventorySource = fs.readFileSync(screenInventoryPath, 'utf8');
  const screenInventoryTestSource = fs.readFileSync(screenInventoryTestPath, 'utf8');

  const missingModuleIds = requiredModuleIds.filter((moduleId) => !moduleCatalogSource.includes(moduleId));
  const missingScreenIds = requiredScreenIds.filter((screenId) => !screenInventorySource.includes(screenId));
  const missingLayoutContractIds = requiredScreenIds.filter((screenId) => {
    return !screenInventorySource.includes(`screenId: '${screenId}'`);
  });
  const missingScreenInventoryCoverageAssertions = requiredScreenIds.filter((screenId) => {
    return !screenInventoryTestSource.includes(screenId);
  });

  return {
    missingModuleIds,
    missingScreenIds,
    missingLayoutContractIds,
    missingScreenInventoryCoverageAssertions,
    hasBlockingGaps:
      missingModuleIds.length > 0 ||
      missingScreenIds.length > 0 ||
      missingLayoutContractIds.length > 0 ||
      missingScreenInventoryCoverageAssertions.length > 0,
  };
};

const listAllUsers = async () => {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    ensureNoError(error, 'List auth users');
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < 200) break;
    page += 1;
  }
  return users;
};

const ensureSeedUser = async ({ email, firstName, lastName }) => {
  const users = await listAllUsers();
  const existing = users.find((user) => String(user.email || '').toLowerCase() === email.toLowerCase());
  if (existing) return existing;

  const password = `Amro!${runSuffix}${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  });
  ensureNoError(error, `Create auth user ${email}`);
  return data.user;
};

const ensureUserRole = async ({ userId, role, tenantId, franchiseId }) => {
  const existing = await maybeSingle(
    supabase.from('user_roles').select('id,tenant_id,franchise_id').eq('user_id', userId).eq('role', role),
    `Resolve role ${role} for ${userId}`
  );
  if (existing) {
    const needsUpdate =
      existing.tenant_id !== tenantId ||
      (existing.franchise_id ?? null) !== (franchiseId ?? null);
    if (!needsUpdate) return existing;

    const { data: updated, error: updateError } = await supabase
      .from('user_roles')
      .update({
        tenant_id: tenantId,
        franchise_id: franchiseId ?? null,
      })
      .eq('id', existing.id)
      .select('id')
      .single();
    ensureNoError(updateError, `Update role ${role} for ${userId}`);
    return updated;
  }
  const { data, error } = await supabase
    .from('user_roles')
    .insert({
      user_id: userId,
      role,
      tenant_id: tenantId,
      franchise_id: franchiseId ?? null,
    })
    .select('id')
    .single();
  ensureNoError(error, `Insert role ${role} for ${userId}`);
  return data;
};

const isMissingRelationError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    (message.includes('relation') && message.includes('does not exist')) ||
    message.includes('could not find the table')
  );
};

const tableExistsCache = new Map();
const hasTable = async (table) => {
  if (tableExistsCache.has(table)) {
    return tableExistsCache.get(table);
  }
  const { error } = await tableClient(table).select('id').limit(1);
  if (error && isMissingRelationError(error)) {
    tableExistsCache.set(table, false);
    return false;
  }
  ensureNoError(error, `Resolve table existence for ${table}`);
  const exists = true;
  tableExistsCache.set(table, exists);
  return exists;
};

const seedOverviewAnalytics = async ({
  tenantId,
  franchiseId,
  workOrderId,
  heavyWorkOrderId,
  taskId,
  maintenanceEventId,
  complianceObligationId,
  generatedBy,
}) => {
  const requiredTables = [
    'amro_overview_kpi_snapshots',
    'amro_sla_definitions',
    'amro_operational_telemetry',
    'amro_compliance_events',
  ];
  const availability = await Promise.all(
    requiredTables.map(async (table) => ({
      table,
      exists: await hasTable(table),
    }))
  );
  const missingTables = availability.filter((entry) => !entry.exists).map((entry) => entry.table);
  if (missingTables.length > 0) {
    return {
      skipped: true,
      missingTables,
      seededSlaDefinitions: 0,
      seededTelemetryRows: 0,
      seededComplianceEvents: 0,
      seededSnapshots: 0,
      sampleSnapshotId: null,
    };
  }

  const dateRangeEnd = new Date();
  const dateRangeStart = new Date(dateRangeEnd.getTime() - 29 * 24 * 60 * 60 * 1000);
  const dateRangeStartIso = dateRangeStart.toISOString().slice(0, 10);
  const dateRangeEndIso = dateRangeEnd.toISOString().slice(0, 10);
  const snapshotAt = new Date(Date.UTC(dateRangeEnd.getUTCFullYear(), dateRangeEnd.getUTCMonth(), dateRangeEnd.getUTCDate(), 0, 0, 0)).toISOString();

  const snapshots = [
    { persona: 'management', openWorkOrders: 38, inProgressTasks: 246, deferredItems: 12, complianceAlerts: 19, aogCount: 3, slaBreachCount: 7 },
    { persona: 'planner', openWorkOrders: 28, inProgressTasks: 192, deferredItems: 9, complianceAlerts: 11, aogCount: 2, slaBreachCount: 5 },
    { persona: 'compliance_lead', openWorkOrders: 21, inProgressTasks: 134, deferredItems: 6, complianceAlerts: 23, aogCount: 1, slaBreachCount: 4 },
  ];
  let sampleSnapshot = null;
  for (const snapshot of snapshots) {
    const row = await upsertReturning(
      'amro_overview_kpi_snapshots',
      {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        persona: snapshot.persona,
        date_range_start: dateRangeStartIso,
        date_range_end: dateRangeEndIso,
        snapshot_at: snapshotAt,
        open_work_orders: snapshot.openWorkOrders,
        in_progress_tasks: snapshot.inProgressTasks,
        deferred_items: snapshot.deferredItems,
        compliance_alerts: snapshot.complianceAlerts,
        aog_count: snapshot.aogCount,
        sla_breach_count: snapshot.slaBreachCount,
        risk_heatmap: {
          station_blr: { medium: 6, high: 3 },
          station_hyd: { medium: 4, high: 1 },
        },
        trend_lines: [{ metric: 'task_completion', slope: 0.16 }, { metric: 'sla_breach_rate', slope: -0.08 }],
        anomaly_alerts: [{ metric: 'engine_vibration', count: 2 }, { metric: 'deferment_density', count: 1 }],
        cache_fresh_until: new Date(dateRangeEnd.getTime() + 5 * 60 * 1000).toISOString(),
        generated_by: generatedBy,
      },
      'tenant_id,franchise_id,persona,date_range_start,date_range_end,snapshot_at',
      `Upsert analytics snapshot (${snapshot.persona})`
    );
    if (!sampleSnapshot) {
      sampleSnapshot = row;
    }
  }

  const slaDefinitions = [
    ['DECCAN-SLA-TAT', 'turnaround', 'turnaround_hours', 'lte', 6, 360],
    ['DECCAN-SLA-AOG', 'aog', 'aog_recovery_hours', 'lte', 4, 240],
    ['DECCAN-SLA-COMPLIANCE', 'compliance', 'compliance_gate_pass_pct', 'gte', 99.5, 1440],
    ['DECCAN-SLA-DEFERRAL', 'reliability', 'deferred_item_ratio', 'lte', 2.0, 1440],
    ['DECCAN-SLA-ON_TIME_RELEASE', 'operations', 'release_on_time_pct', 'gte', 97.0, 1440],
    ['DECCAN-SLA-PART_FILL', 'materials', 'parts_fill_rate_pct', 'gte', 96.0, 1440],
  ];
  for (const [slaCode, serviceTier, metricKey, comparator, targetValue, windowMinutes] of slaDefinitions) {
    await upsertReturning(
      'amro_sla_definitions',
      {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        sla_code: slaCode,
        service_tier: serviceTier,
        metric_key: metricKey,
        comparator,
        target_value: targetValue,
        evaluation_window_minutes: windowMinutes,
        is_active: true,
        metadata: { source: 'seed', dashboard: true },
        created_by: generatedBy,
        updated_by: generatedBy,
      },
      'tenant_id,franchise_id,sla_code',
      `Upsert SLA definition (${slaCode})`
    );
  }

  const telemetryTarget = Math.max(0, Number(process.env.AMRO_TELEMETRY_TARGET || 50000));
  const telemetryWindowDays = Math.max(1, Number(process.env.AMRO_TELEMETRY_WINDOW_DAYS || 365));
  const telemetryMetricCatalog = [
    { key: 'engine_vibration', unit: 'mm/s', base: 2.2, variance: 0.9 },
    { key: 'hydraulic_pressure', unit: 'psi', base: 2800, variance: 240 },
    { key: 'oil_temperature', unit: 'C', base: 82, variance: 12 },
    { key: 'fuel_flow', unit: 'kg/h', base: 1800, variance: 220 },
    { key: 'egt_margin', unit: 'C', base: 48, variance: 9 },
  ];
  const telemetryBatchSize = 1000;
  const telemetryStartMs = Date.now() - telemetryWindowDays * 24 * 60 * 60 * 1000;
  for (let offset = 0; offset < telemetryTarget; offset += telemetryBatchSize) {
    const batchRows = [];
    const batchEnd = Math.min(offset + telemetryBatchSize, telemetryTarget);
    for (let index = offset; index < batchEnd; index += 1) {
      const metric = telemetryMetricCatalog[index % telemetryMetricCatalog.length];
      const eventTimeMs = telemetryStartMs + Math.floor((index / Math.max(telemetryTarget, 1)) * telemetryWindowDays * 24 * 60 * 60 * 1000);
      const seasonal = ['winter', 'spring', 'summer', 'monsoon', 'autumn'][index % 5];
      const value = Number((metric.base + ((index % 19) - 9) * (metric.variance / 20)).toFixed(4));
      batchRows.push({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        work_order_id: index % 7 === 0 ? heavyWorkOrderId : workOrderId,
        source_record_key: `deccan-telemetry-${index + 1}`,
        telemetry_source: index % 2 === 0 ? 'iot-gateway' : 'ops-import',
        metric_key: metric.key,
        metric_value: value,
        metric_unit: metric.unit,
        recorded_at: new Date(eventTimeMs).toISOString(),
        seasonal_bucket: seasonal,
        metadata: { source: 'seed', ordinal: index + 1 },
      });
    }
    const { error: telemetryError } = await supabase
      .from('amro_operational_telemetry')
      .upsert(batchRows, { onConflict: 'tenant_id,franchise_id,source_record_key' });
    ensureNoError(telemetryError, `Upsert telemetry batch ${offset}-${batchEnd}`);
  }

  const complianceEventsTarget = Math.max(0, Number(process.env.AMRO_COMPLIANCE_EVENTS_TARGET || 1000));
  const complianceBatchSize = 500;
  for (let offset = 0; offset < complianceEventsTarget; offset += complianceBatchSize) {
    const batchRows = [];
    const batchEnd = Math.min(offset + complianceBatchSize, complianceEventsTarget);
    for (let index = offset; index < batchEnd; index += 1) {
      const severity = ['low', 'medium', 'high', 'critical'][index % 4];
      const eventStatus = ['open', 'acknowledged', 'resolved', 'dismissed'][index % 4];
      const detectedAtMs = Date.now() - (index + 1) * 60 * 60 * 1000;
      batchRows.push({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        obligation_id: complianceObligationId,
        work_order_id: index % 9 === 0 ? heavyWorkOrderId : workOrderId,
        task_id: taskId,
        maintenance_event_id: maintenanceEventId,
        event_code: `DECCAN-COMP-EVT-${String(index + 1).padStart(5, '0')}`,
        event_type: index % 2 === 0 ? 'document_gap' : 'inspection_alert',
        severity,
        event_status: eventStatus,
        summary: `Compliance event ${index + 1}`,
        details: { source: 'seed', severity_index: index % 4 },
        detected_at: new Date(detectedAtMs).toISOString(),
        resolved_at: eventStatus === 'resolved' || eventStatus === 'dismissed' ? new Date(detectedAtMs + 30 * 60 * 1000).toISOString() : null,
        created_by: generatedBy,
        updated_by: generatedBy,
      });
    }
    const { error: complianceError } = await supabase
      .from('amro_compliance_events')
      .upsert(batchRows, { onConflict: 'tenant_id,franchise_id,event_code' });
    ensureNoError(complianceError, `Upsert compliance events batch ${offset}-${batchEnd}`);
  }

  return {
    skipped: false,
    missingTables: [],
    seededSlaDefinitions: slaDefinitions.length,
    seededTelemetryRows: telemetryTarget,
    seededComplianceEvents: complianceEventsTarget,
    seededSnapshots: snapshots.length,
    sampleSnapshotId: sampleSnapshot?.id ?? null,
  };
};

const run = async () => {
  const amroDomain = await upsertReturning(
    'platform_domains',
    {
      code: 'amro',
      name: 'Aircraft Maintenance, Repair and Overhaul',
      description: 'AMRO operational domain',
      is_active: true,
    },
    'code',
    'Upsert AMRO domain'
  );

  const tenant = await upsertReturning(
    'tenants',
    {
      name: 'Deccan Airways',
      slug: 'deccan-airways',
      domain: 'deccan-airways.local',
      domain_id: amroDomain.id,
      subscription_tier: 'enterprise',
      is_active: true,
      settings: { amro_enabled: true, timezone: 'Asia/Kolkata' },
    },
    'slug',
    'Upsert tenant'
  );

  const franchise = await upsertReturning(
    'franchises',
    {
      tenant_id: tenant.id,
      name: 'Deccan Fly',
      code: 'DECCAN-FLY',
      is_active: true,
      address: { city: 'Bengaluru', country: 'IN', station_code: 'BLR' },
    },
    'code',
    'Upsert franchise'
  );

  const heavyFranchise = await upsertReturning(
    'franchises',
    {
      tenant_id: tenant.id,
      name: 'Deccan Fly Heavy',
      code: 'DECCAN-FLY-HEAVY',
      is_active: true,
      address: { city: 'Hyderabad', country: 'IN', station_code: 'HYD' },
    },
    'code',
    'Upsert heavy franchise'
  );

  await upsertReturning(
    'tenant_domain_assignments',
    {
      tenant_id: tenant.id,
      domain_id: amroDomain.id,
      is_active: true,
    },
    'tenant_id,domain_id',
    'Upsert tenant domain assignment'
  );

  const usersByKey = {};
  for (const userDef of seedUsers) {
    const user = await ensureSeedUser(userDef);
    usersByKey[userDef.key] = user;

    await supabase.from('profiles').upsert(
      {
        id: user.id,
        email: user.email,
        first_name: userDef.firstName,
        last_name: userDef.lastName,
        is_active: true,
        must_change_password: false,
      },
      { onConflict: 'id' }
    );

    const roleFranchiseId =
      userDef.role === 'tenant_admin'
        ? null
        : userDef.key === 'heavyFranchiseAdmin'
          ? heavyFranchise.id
          : franchise.id;
    await ensureUserRole({
      userId: user.id,
      role: userDef.role,
      tenantId: tenant.id,
      franchiseId: roleFranchiseId,
    });

    if (userDef.role === 'user' && userDef.key !== 'ops') {
      await ensureUserRole({
        userId: user.id,
        role: 'user',
        tenantId: tenant.id,
        franchiseId: heavyFranchise.id,
      });
    }

    await upsertReturning(
      'user_domain_assignments',
      {
        user_id: user.id,
        tenant_id: tenant.id,
        domain_id: amroDomain.id,
        is_active: true,
      },
      'user_id,tenant_id,domain_id',
      `Upsert user domain assignment for ${user.email}`
    );
  }

  const policySnapshot = await upsertReturning(
    'policy_snapshots',
    {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      policy_type: 'compliance',
      version: Number(runSuffix.slice(-6)) || 1,
      policy_key: `deccan-compliance-baseline-${runSuffix}`,
      rules_json: { closure_gate_required: true, release_authority: 'DGCA' },
      effective_at: nowIso,
      checksum: `sha256:${crypto.createHash('sha256').update(`deccan-policy-${runSuffix}`).digest('hex')}`,
      created_by: usersByKey.compliance.id,
    },
    'tenant_id,franchise_id,policy_key',
    'Upsert policy snapshot'
  );

  const aircraft = await upsertReturning(
    'aircraft',
    {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      registration: 'VT-DCN',
      tail_number: 'VT-DCN',
      aircraft_type: 'A320',
      aircraft_model: 'A320-200',
      engine_type: 'CFM56',
      station_code: 'BLR',
      manufacturer: 'Airbus',
      model: 'A320-200',
      serial_number: 'DECCAN-A320-001',
      status: 'active',
      created_by: usersByKey.tenantAdmin.id,
      updated_by: usersByKey.tenantAdmin.id,
    },
    'serial_number',
    'Upsert aircraft'
  );

  const workOrder = await upsertReturning(
    'work_orders',
    {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      aircraft_id: aircraft.id,
      work_order_number: `WO-DECCAN-${runSuffix}`,
      work_order_number: `WP-DECCAN-${runSuffix}`,
      title: 'A-Check Deccan Fly',
      work_type: 'A-Check',
      maintenance_type: 'line',
      status: 'planning',
      priority: 2,
      planned_start_date: nowIso,
      planned_end_date: twoHoursLaterIso,
      planned_start: nowIso,
      planned_end: twoHoursLaterIso,
      assigned_to: usersByKey.planner.id,
      supervisor_id: usersByKey.franchiseAdmin.id,
      created_by: usersByKey.planner.id,
      updated_by: usersByKey.planner.id,
    },
    'work_order_number',
    'Upsert work package'
  );

  const component = await upsertReturning(
    'components',
    {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      aircraft_id: aircraft.id,
      part_number: 'PN-DCN-HYD-001',
      serial_number: 'SN-DCN-HYD-001',
      component_type: 'Hydraulic Pump',
      category: 'Hydraulics',
      manufacturer: 'HydroTech',
      model: 'HT-200',
      status: 'installed',
      work_order_id: workOrder.id,
      created_by: usersByKey.technician.id,
      updated_by: usersByKey.technician.id,
    },
    'serial_number',
    'Upsert component'
  );

  const task = await upsertReturning(
    'tasks',
    {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      work_order_id: workOrder.id,
      task_number: `TASK-DECCAN-${runSuffix}`,
      title: 'Inspect hydraulic lines',
      task_category: 'inspection',
      status: 'pending',
      sequence_order: 1,
      planned_start_date: nowIso,
      planned_end_date: oneHourLaterIso,
      assigned_to: usersByKey.technician.id,
      steps: [{ step_number: 1, description: 'Inspect line integrity', duration_minutes: 20 }],
      qualifications: { rating: 'A&P', scope: 'Hydraulics', currency_days: 365 },
      evidence_fields: [{ field_type: 'photo', required: true, field_name: 'inspection_photo' }],
      created_by: usersByKey.planner.id,
      updated_by: usersByKey.planner.id,
    },
    'task_number',
    'Upsert task'
  );

  const regulatorProfile = await upsertReturning(
    'regulator_profiles',
    {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      regulator_code: 'DGCA-IN',
      regulator_name: 'Directorate General of Civil Aviation',
      jurisdiction: 'India',
      policy_version: '2026.1',
      metadata: { source: 'seed' },
      created_by: usersByKey.compliance.id,
      updated_by: usersByKey.compliance.id,
    },
    'tenant_id,regulator_code',
    'Upsert regulator profile'
  );

  const staffQualification = await upsertReturning(
    'staff_qualifications',
    {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      staff_id: usersByKey.certifier.id,
      qualification_code: `QC-DECCAN-${runSuffix}`,
      qualification_name: 'Certifying Engineer Type A',
      issuing_authority: 'DGCA',
      issue_date: nowIso.slice(0, 10),
      expiration_date: nextWeekDateIso,
      rating: 'A&P',
      can_certify_release: true,
      regulator_profile_id: regulatorProfile.id,
      created_by: usersByKey.tenantAdmin.id,
      updated_by: usersByKey.tenantAdmin.id,
      license_number: `LIC-${runSuffix}`,
      certificate_number: `CERT-${runSuffix}`,
    },
    'qualification_code',
    'Upsert staff qualification'
  );

  const maintenanceEvent = await upsertReturning(
    'maintenance_events',
    {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      aircraft_id: aircraft.id,
      component_id: component.id,
      work_order_id: workOrder.id,
      task_id: task.id,
      event_type: 'task_execution',
      title: 'Hydraulic inspection started',
      performed_by: usersByKey.technician.id,
      data: { task_number: task.task_number },
      metadata: { source: 'seed-runner' },
      event_hash: `sha256:${crypto.createHash('sha256').update(`maintenance-event-${runSuffix}`).digest('hex')}`,
      previous_hash: `sha256:${crypto.createHash('sha256').update(`maintenance-event-prev-${runSuffix}`).digest('hex')}`,
      created_by: usersByKey.technician.id,
      updated_by: usersByKey.technician.id,
    },
    'id',
    'Insert maintenance event'
  );

  const supplier = await upsertReturning(
    'suppliers',
    {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      supplier_code: 'DCN-SUP-001',
      name: 'Deccan Aero Supplies',
      contact_name: 'Vendor Desk',
      email: 'vendor@deccanaero.local',
      lead_time_days: 5,
      rating: 4.6,
      metadata: { preferred: true },
      created_by: usersByKey.store.id,
      updated_by: usersByKey.store.id,
    },
    'tenant_id,supplier_code',
    'Upsert supplier'
  );

  const partsInventory = await upsertReturning(
    'parts_inventory',
    {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      part_number: 'PN-DCN-HYD-001',
      serial_number: 'INV-DCN-HYD-001',
      description: 'Hydraulic pump spare',
      component_id: component.id,
      supplier_id: supplier.id,
      warehouse_location: 'BLR-HGR-A1',
      quantity_on_hand: 10,
      quantity_reserved: 2,
      reorder_level: 3,
      reorder_quantity: 5,
      unit_cost: 1200.5,
      status: 'available',
      created_by: usersByKey.store.id,
      updated_by: usersByKey.store.id,
    },
    "tenant_id,part_number,serial_number,warehouse_location",
    'Upsert parts inventory'
  );

  const [workOrderMaterial, componentPosition, shiftCalendar, schedule, stockMovement, reservation, complianceObligation, certificationAction, integrationJob, integrationMapping, webhookOutbox, assetHealthSignal, forecastOutput, workOrderTemplate, syncConflict, regulatorDossier, forecastFeature, taskEvidence, taskQualificationRequirement] = await Promise.all([
    upsertReturning(
      'amro_work_order_materials',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        work_order_id: workOrder.id,
        part_number: partsInventory.part_number,
        description: partsInventory.description,
        component_id: component.id,
        action: 'install',
        quantity: 1,
        status: 'pending',
        created_by: usersByKey.store.id,
        updated_by: usersByKey.store.id,
      },
      'id',
      'Insert work package materials'
    ),
    upsertReturning(
      'component_positions',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        aircraft_id: aircraft.id,
        component_id: component.id,
        position_code: 'LH-HYD-01',
        station_code: 'BLR',
        installation_work_order_id: workOrder.id,
      },
      'component_id',
      'Upsert component position'
    ),
    upsertReturning(
      'shift_calendars',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        station_code: 'BLR',
        shift_name: 'Day Shift',
        shift_start_time: '08:00:00',
        shift_end_time: '16:00:00',
        capacity: 8,
        effective_from: nowIso.slice(0, 10),
      },
      'tenant_id,station_code,shift_name,effective_from',
      'Upsert shift calendar'
    ),
    upsertReturning(
      'schedules',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        work_order_id: workOrder.id,
        aircraft_id: aircraft.id,
        station_code: 'BLR',
        slot_start: nowIso,
        slot_end: twoHoursLaterIso,
        status: 'planned',
      },
      'tenant_id,work_order_id,slot_start',
      'Upsert schedule'
    ),
    upsertReturning(
      'stock_movements',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        inventory_id: partsInventory.id,
        movement_type: 'receipt',
        quantity: 10,
        to_location: 'BLR-HGR-A1',
        moved_by: usersByKey.store.id,
      },
      'id',
      'Insert stock movement'
    ),
    upsertReturning(
      'reservations',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        inventory_id: partsInventory.id,
        work_order_id: workOrder.id,
        task_id: task.id,
        reserved_quantity: 1,
        status: 'active',
        reserved_by: usersByKey.planner.id,
        expires_at: tomorrowIso,
      },
      'id',
      'Insert reservation'
    ),
    upsertReturning(
      'compliance_obligations',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        regulator_profile_id: regulatorProfile.id,
        aircraft_id: aircraft.id,
        work_order_id: workOrder.id,
        obligation_code: `OBL-DECCAN-${runSuffix}`,
        obligation_type: 'inspection',
        title: 'Hydraulic safety compliance',
        due_date: nextWeekDateIso,
        status: 'open',
        created_by: usersByKey.compliance.id,
        updated_by: usersByKey.compliance.id,
      },
      'tenant_id,obligation_code',
      'Upsert compliance obligation'
    ),
    upsertReturning(
      'certification_actions',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        staff_qualification_id: staffQualification.id,
        work_order_id: workOrder.id,
        task_id: task.id,
        action_type: 'defer',
        action_status: 'pending',
        policy_snapshot_id: policySnapshot.id,
        created_by: usersByKey.certifier.id,
        updated_by: usersByKey.certifier.id,
      },
      'id',
      'Insert certification action'
    ),
    upsertReturning(
      'integration_jobs',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        job_type: 'supplier_sync',
        source_system: 'erp',
        target_system: 'amro',
        status: 'queued',
        idempotency_key: `amro-sync-${runSuffix}`,
        payload: { supplier_code: supplier.supplier_code },
        created_by: usersByKey.integration.id,
        updated_by: usersByKey.integration.id,
      },
      'tenant_id,idempotency_key',
      'Upsert integration job'
    ),
    upsertReturning(
      'integration_mappings',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        source_system: 'erp',
        source_entity: 'supplier',
        source_key: 'supplier_code',
        target_table: 'suppliers',
        target_column: 'supplier_code',
        mapping_rule: { mode: 'direct' },
        created_by: usersByKey.integration.id,
        updated_by: usersByKey.integration.id,
      },
      'tenant_id,source_system,source_entity,source_key,target_table,target_column',
      'Upsert integration mapping'
    ),
    upsertReturning(
      'webhook_outbox',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        integration_job_id: null,
        event_type: 'supplier.updated',
        endpoint_url: 'https://example.local/amro/webhook',
        payload: { supplier_code: supplier.supplier_code },
        status: 'pending',
        created_by: usersByKey.integration.id,
        updated_by: usersByKey.integration.id,
      },
      'id',
      'Insert webhook outbox'
    ),
    upsertReturning(
      'asset_health_signals',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        aircraft_id: aircraft.id,
        component_id: component.id,
        signal_type: 'vibration',
        signal_source: 'iot-gateway',
        value_numeric: 2.5,
        unit: 'mm/s',
        quality_score: 98.5,
        metadata: { channel: 'HYD_01' },
        created_by: usersByKey.integration.id,
        updated_by: usersByKey.integration.id,
      },
      'id',
      'Insert asset health signal'
    ),
    upsertReturning(
      'forecast_outputs',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        aircraft_id: aircraft.id,
        component_id: component.id,
        signal_id: null,
        forecast_type: 'failure_risk',
        prediction_window_hours: 72,
        risk_score: 42.5,
        confidence_score: 88.2,
        recommendation: 'Inspect hydraulic couplings',
        rationale: { model: 'amro-v1', feature: 'vibration' },
        model_version: 'amro-forecast-v1',
        created_by: usersByKey.management.id,
        updated_by: usersByKey.management.id,
      },
      'id',
      'Insert forecast output'
    ),
    upsertReturning(
      'work_order_templates',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        template_code: 'TPL-DECCAN-A-CHECK',
        version: 1,
        template_name: 'Deccan A-Check Template',
        maintenance_type: 'line',
        scope_json: [{ section: 'Hydraulics' }],
        tasks_json: [{ task_number: 'INSPECT-HYD', title: 'Inspect hydraulic lines' }],
        policy_snapshot_id: policySnapshot.id,
        created_by: usersByKey.planner.id,
        updated_by: usersByKey.planner.id,
      },
      'tenant_id,franchise_id,template_code,version',
      'Upsert work package template'
    ),
    upsertReturning(
      'sync_conflicts',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        entity_type: 'work_orders',
        entity_id: workOrder.id,
        conflict_ref: `SYNC-DECCAN-${runSuffix}`,
        conflict_class: 'version_mismatch',
        local_payload: { status: 'planning' },
        remote_payload: { status: 'approved' },
        resolution: 'pending',
        created_by: usersByKey.integration.id,
        updated_by: usersByKey.integration.id,
      },
      'tenant_id,franchise_id,conflict_ref',
      'Upsert sync conflict'
    ),
    upsertReturning(
      'regulator_dossiers',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        work_order_id: workOrder.id,
        regulator_code: regulatorProfile.regulator_code,
        dossier_ref: `DOS-DECCAN-${runSuffix}`,
        status: 'draft',
        created_by: usersByKey.compliance.id,
        updated_by: usersByKey.compliance.id,
      },
      'tenant_id,franchise_id,regulator_code,dossier_ref',
      'Upsert regulator dossier'
    ),
    upsertReturning(
      'forecast_features',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        asset_id: aircraft.id,
        feature_vector: { vibration: 2.5, temp: 67.2 },
        inference_time: nowIso,
        feature_hash: `ff-${runSuffix}`,
        model_version: 'amro-forecast-v1',
        created_by: usersByKey.management.id,
      },
      'tenant_id,franchise_id,asset_id,inference_time',
      'Upsert forecast feature'
    ),
    upsertReturning(
      'task_evidence',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        task_id: task.id,
        maintenance_event_id: maintenanceEvent.id,
        evidence_type: 'photo',
        uri: `s3://amro/evidence/${runSuffix}.jpg`,
        checksum: `sha256:${crypto.createHash('sha256').update(`evidence-${runSuffix}`).digest('hex')}`,
        metadata: { angle: 'left-hydraulic' },
        captured_by: usersByKey.technician.id,
        created_by: usersByKey.technician.id,
      },
      'id,captured_at',
      'Insert task evidence'
    ),
    upsertReturning(
      'task_qualification_requirements',
      {
        tenant_id: tenant.id,
        franchise_id: franchise.id,
        task_id: task.id,
        staff_qualification_id: staffQualification.id,
        requirement_scope: 'Hydraulics',
        is_mandatory: true,
        created_by: usersByKey.planner.id,
        updated_by: usersByKey.planner.id,
      },
      'task_id,staff_qualification_id',
      'Upsert task qualification requirement'
    ),
  ]);

  const scheduleConstraint = await upsertReturning(
    'schedule_constraints',
    {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      schedule_id: schedule.id,
      constraint_type: 'capacity',
      severity: 'warning',
      rule_expression: { max_staff: 8 },
      is_satisfied: true,
      updated_by: usersByKey.planner.id,
    },
    'id',
    'Insert schedule constraint'
  );

  const complianceRecord = await upsertReturning(
    'compliance_records',
    {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      obligation_id: complianceObligation.id,
      maintenance_event_id: maintenanceEvent.id,
      task_id: task.id,
      decision_status: 'pending',
      reviewed_by: usersByKey.inspector.id,
      policy_snapshot_id: policySnapshot.id,
      created_by: usersByKey.inspector.id,
      updated_by: usersByKey.inspector.id,
    },
    'id',
    'Insert compliance record'
  );

  const { error: updateIntegrationJobError } = await supabase
    .from('integration_jobs')
    .update({ status: 'running', updated_by: usersByKey.integration.id })
    .eq('id', integrationJob.id);
  ensureNoError(updateIntegrationJobError, 'Update integration job status');

  const { error: updateWebhookError } = await supabase
    .from('webhook_outbox')
    .update({ integration_job_id: integrationJob.id, updated_by: usersByKey.integration.id })
    .eq('id', webhookOutbox.id);
  ensureNoError(updateWebhookError, 'Link webhook outbox to integration job');

  const { error: updateForecastOutputError } = await supabase
    .from('forecast_outputs')
    .update({ signal_id: assetHealthSignal.id, updated_by: usersByKey.management.id })
    .eq('id', forecastOutput.id);
  ensureNoError(updateForecastOutputError, 'Link forecast output to signal');

  const forecastDecision = await upsertReturning(
    'forecast_decisions',
    {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      recommendation_id: forecastOutput.id,
      policy_snapshot_id: policySnapshot.id,
      accepted: true,
      outcome_metric: 97.4,
      outcome_notes: 'Preemptive inspection accepted',
      decided_by: usersByKey.management.id,
      created_by: usersByKey.management.id,
    },
    'id',
    'Insert forecast decision'
  );

  const heavyPolicySnapshot = await upsertReturning(
    'policy_snapshots',
    {
      tenant_id: tenant.id,
      franchise_id: heavyFranchise.id,
      policy_type: 'compliance',
      version: (Number(runSuffix.slice(-6)) || 1) + 1,
      policy_key: `deccan-heavy-compliance-baseline-${runSuffix}`,
      rules_json: { closure_gate_required: true, release_authority: 'DGCA', heavy_maintenance_mode: true },
      effective_at: nowIso,
      checksum: `sha256:${crypto.createHash('sha256').update(`deccan-heavy-policy-${runSuffix}`).digest('hex')}`,
      created_by: usersByKey.compliance.id,
    },
    'tenant_id,franchise_id,policy_key',
    'Upsert heavy policy snapshot'
  );

  const heavyAircraft = await upsertReturning(
    'aircraft',
    {
      tenant_id: tenant.id,
      franchise_id: heavyFranchise.id,
      registration: 'VT-DHY',
      tail_number: 'VT-DHY',
      aircraft_type: 'B737',
      aircraft_model: 'B737-800',
      engine_type: 'CFM56',
      station_code: 'HYD',
      manufacturer: 'Boeing',
      model: '737-800',
      serial_number: `DECCAN-B737-${runSuffix}`,
      status: 'active',
      created_by: usersByKey.tenantAdmin.id,
      updated_by: usersByKey.tenantAdmin.id,
    },
    'tenant_id,tail_number',
    'Upsert heavy aircraft'
  );

  const heavyWorkOrder = await upsertReturning(
    'work_orders',
    {
      tenant_id: tenant.id,
      franchise_id: heavyFranchise.id,
      aircraft_id: heavyAircraft.id,
      work_order_number: `WO-DECCAN-HEAVY-${runSuffix}`,
      work_order_number: `WP-DECCAN-HEAVY-${runSuffix}`,
      title: 'C-Check Deccan Fly Heavy',
      work_type: 'C-Check',
      maintenance_type: 'overhaul',
      status: 'planning',
      priority: 1,
      planned_start_date: tomorrowIso,
      planned_end_date: new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString(),
      planned_start: tomorrowIso,
      planned_end: new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString(),
      assigned_to: usersByKey.planner.id,
      supervisor_id: usersByKey.heavyFranchiseAdmin.id,
      created_by: usersByKey.planner.id,
      updated_by: usersByKey.planner.id,
    },
    'work_order_number',
    'Upsert heavy work package'
  );

  const heavyTask = await upsertReturning(
    'tasks',
    {
      tenant_id: tenant.id,
      franchise_id: heavyFranchise.id,
      work_order_id: heavyWorkOrder.id,
      task_number: `TASK-DECCAN-HEAVY-${runSuffix}`,
      title: 'Borescope engine inspection',
      task_category: 'inspection',
      status: 'pending',
      sequence_order: 1,
      planned_start_date: tomorrowIso,
      planned_end_date: new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString(),
      assigned_to: usersByKey.technician.id,
      steps: [{ step_number: 1, description: 'Inspect engine borescope images', duration_minutes: 45 }],
      qualifications: { rating: 'B1', scope: 'Powerplant', currency_days: 365 },
      evidence_fields: [{ field_type: 'report', required: true, field_name: 'borescope_report' }],
      created_by: usersByKey.planner.id,
      updated_by: usersByKey.planner.id,
    },
    'task_number',
    'Upsert heavy task'
  );

  const heavyRegulatorProfile = await upsertReturning(
    'regulator_profiles',
    {
      tenant_id: tenant.id,
      franchise_id: heavyFranchise.id,
      regulator_code: 'DGCA-IN-HEAVY',
      regulator_name: 'Directorate General of Civil Aviation Heavy Ops',
      jurisdiction: 'India',
      policy_version: '2026.1-heavy',
      metadata: { source: 'seed-heavy' },
      created_by: usersByKey.compliance.id,
      updated_by: usersByKey.compliance.id,
    },
    'tenant_id,regulator_code',
    'Upsert heavy regulator profile'
  );

  const heavyStaffQualification = await upsertReturning(
    'staff_qualifications',
    {
      tenant_id: tenant.id,
      franchise_id: heavyFranchise.id,
      staff_id: usersByKey.certifier.id,
      qualification_code: `QC-DECCAN-HEAVY-${runSuffix}`,
      qualification_name: 'Certifying Engineer Type B1',
      issuing_authority: 'DGCA',
      issue_date: nowIso.slice(0, 10),
      expiration_date: nextWeekDateIso,
      rating: 'B1',
      can_certify_release: true,
      regulator_profile_id: heavyRegulatorProfile.id,
      created_by: usersByKey.tenantAdmin.id,
      updated_by: usersByKey.tenantAdmin.id,
      license_number: `LIC-H-${runSuffix}`,
      certificate_number: `CERT-H-${runSuffix}`,
    },
    'qualification_code',
    'Upsert heavy staff qualification'
  );

  const heavyComplianceObligation = await upsertReturning(
    'compliance_obligations',
    {
      tenant_id: tenant.id,
      franchise_id: heavyFranchise.id,
      regulator_profile_id: heavyRegulatorProfile.id,
      aircraft_id: heavyAircraft.id,
      work_order_id: heavyWorkOrder.id,
      obligation_code: `OBL-DECCAN-HEAVY-${runSuffix}`,
      obligation_type: 'inspection',
      title: 'Engine borescope mandatory compliance',
      due_date: nextWeekDateIso,
      status: 'open',
      created_by: usersByKey.compliance.id,
      updated_by: usersByKey.compliance.id,
    },
    'tenant_id,obligation_code',
    'Upsert heavy compliance obligation'
  );

  const heavyIntegrationJob = await upsertReturning(
    'integration_jobs',
    {
      tenant_id: tenant.id,
      franchise_id: heavyFranchise.id,
      job_type: 'telemetry_sync',
      source_system: 'iot',
      target_system: 'amro',
      status: 'queued',
      idempotency_key: `amro-heavy-sync-${runSuffix}`,
      payload: { fleet_type: 'heavy' },
      created_by: usersByKey.integration.id,
      updated_by: usersByKey.integration.id,
    },
    'tenant_id,idempotency_key',
    'Upsert heavy integration job'
  );

  const heavyAssetHealthSignal = await upsertReturning(
    'asset_health_signals',
    {
      tenant_id: tenant.id,
      franchise_id: heavyFranchise.id,
      aircraft_id: heavyAircraft.id,
      signal_type: 'engine_vibration',
      signal_source: 'iot-gateway',
      value_numeric: 3.2,
      unit: 'mm/s',
      quality_score: 96.4,
      metadata: { channel: 'ENG_01' },
      created_by: usersByKey.integration.id,
      updated_by: usersByKey.integration.id,
    },
    'id',
    'Insert heavy asset health signal'
  );

  const heavyForecastOutput = await upsertReturning(
    'forecast_outputs',
    {
      tenant_id: tenant.id,
      franchise_id: heavyFranchise.id,
      aircraft_id: heavyAircraft.id,
      signal_id: heavyAssetHealthSignal.id,
      forecast_type: 'failure_risk',
      prediction_window_hours: 96,
      risk_score: 61.5,
      confidence_score: 84.6,
      recommendation: 'Perform proactive engine borescope and vibration balancing',
      rationale: { model: 'amro-v1-heavy', feature: 'engine_vibration' },
      model_version: 'amro-forecast-v1-heavy',
      created_by: usersByKey.management.id,
      updated_by: usersByKey.management.id,
    },
    'id',
    'Insert heavy forecast output'
  );

  await upsertReturning(
    'forecast_decisions',
    {
      tenant_id: tenant.id,
      franchise_id: heavyFranchise.id,
      recommendation_id: heavyForecastOutput.id,
      policy_snapshot_id: heavyPolicySnapshot.id,
      accepted: true,
      outcome_metric: 94.8,
      outcome_notes: 'Heavy maintenance recommendation accepted',
      decided_by: usersByKey.management.id,
      created_by: usersByKey.management.id,
    },
    'id',
    'Insert heavy forecast decision'
  );

  await upsertReturning(
    'certification_actions',
    {
      tenant_id: tenant.id,
      franchise_id: heavyFranchise.id,
      staff_qualification_id: heavyStaffQualification.id,
      work_order_id: heavyWorkOrder.id,
      task_id: heavyTask.id,
      action_type: 'approve',
      action_status: 'executed',
      policy_snapshot_id: heavyPolicySnapshot.id,
      created_by: usersByKey.certifier.id,
      updated_by: usersByKey.certifier.id,
    },
    'id',
    'Insert heavy certification action'
  );

  await upsertReturning(
    'compliance_records',
    {
      tenant_id: tenant.id,
      franchise_id: heavyFranchise.id,
      obligation_id: heavyComplianceObligation.id,
      work_order_id: heavyWorkOrder.id,
      task_id: heavyTask.id,
      decision_status: 'approved',
      reviewed_by: usersByKey.inspector.id,
      approving_authority: usersByKey.certifier.id,
      approving_authority_profile_id: heavyRegulatorProfile.id,
      policy_snapshot_id: heavyPolicySnapshot.id,
      created_by: usersByKey.inspector.id,
      updated_by: usersByKey.inspector.id,
    },
    'id',
    'Insert heavy compliance record'
  );

  const analyticsSeedSummary = await seedOverviewAnalytics({
    tenantId: tenant.id,
    franchiseId: franchise.id,
    workOrderId: workOrder.id,
    heavyWorkOrderId: heavyWorkOrder.id,
    taskId: task.id,
    maintenanceEventId: maintenanceEvent.id,
    complianceObligationId: complianceObligation.id,
    generatedBy: usersByKey.management.id,
  });

  let auditSchemaAvailable = true;
  const { error: insertAuditRecordError } = await supabase.schema('mro_audit').from('records').insert({
    tenant_id: tenant.id,
    record_type: 'maintenance_completion',
    related_entity_id: workOrder.id,
    related_entity_type: 'work_order',
    actor_id: usersByKey.technician.id,
    actor_role: 'technician',
    action: 'Seeded maintenance completion record',
    context: { work_order_number: workOrder.work_order_number },
    signature,
    previous_hash: previousHash,
  });
  if (insertAuditRecordError) {
    if (isMissingAuditSchemaError(insertAuditRecordError)) {
      auditSchemaAvailable = false;
    } else {
      ensureNoError(insertAuditRecordError, 'Insert mro_audit.records row');
    }
  }

  if (auditSchemaAvailable) {
    const { error: insertAuditTrailError } = await supabase.schema('mro_audit').from('trails').insert({
      tenant_id: tenant.id,
      event_type: 'work_order_completed',
      entity_type: 'work_order',
      entity_id: workOrder.id,
      user_id: usersByKey.technician.id,
      user_email: usersByKey.technician.email,
      timestamp: nowIso,
      action_description: 'Seeded trail event for AMRO validation',
      regulatory_context: { regulation: 'DGCA MRO Rulebook', section: 'Part M' },
    });
    ensureNoError(insertAuditTrailError, 'Insert mro_audit.trails row');
  }

  await verifyCrud({
    moduleId: 'MOD-AMRO-01',
    moduleName: 'Overview and KPI Intelligence',
    componentName: 'Forecast outputs',
    table: 'forecast_outputs',
    createPayload: {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      aircraft_id: aircraft.id,
      component_id: component.id,
      forecast_type: 'risk_spike',
      prediction_window_hours: 24,
      risk_score: 40,
      confidence_score: 70,
      recommendation: `Temp recommendation ${runSuffix}`,
      rationale: { source: 'crud' },
      model_version: 'crud-v1',
    },
    updatePayload: { recommendation: `Updated recommendation ${runSuffix}` },
    readMatchField: 'id',
  });

  await verifyCrud({
    moduleId: 'MOD-AMRO-02',
    moduleName: 'Work Package Management',
    componentName: 'Work packages',
    table: 'work_orders',
    createPayload: {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      aircraft_id: aircraft.id,
      work_order_number: `CRUD-WO-${runSuffix}`,
      work_order_number: `CRUD-WP-${runSuffix}`,
      title: 'CRUD Work Package',
      work_type: 'inspection',
      maintenance_type: 'line',
      status: 'planning',
    },
    updatePayload: { status: 'approved' },
    readMatchField: 'work_order_number',
  });

  await verifyCrud({
    moduleId: 'MOD-AMRO-03',
    moduleName: 'Task Execution and Evidence',
    componentName: 'Tasks',
    table: 'tasks',
    createPayload: {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      work_order_id: workOrder.id,
      task_number: `CRUD-TASK-${runSuffix}`,
      title: 'CRUD Task',
      task_category: 'inspection',
      status: 'pending',
    },
    updatePayload: { status: 'in_progress' },
    readMatchField: 'task_number',
  });

  await verifyCrud({
    moduleId: 'MOD-AMRO-04',
    moduleName: 'Maintenance Scheduling',
    componentName: 'Schedules',
    table: 'schedules',
    createPayload: {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      work_order_id: workOrder.id,
      aircraft_id: aircraft.id,
      shift_calendar_id: shiftCalendar.id,
      station_code: 'BLR',
      slot_start: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      slot_end: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      status: 'planned',
    },
    updatePayload: { status: 'confirmed' },
    readMatchField: 'id',
  });

  await verifyCrud({
    moduleId: 'MOD-AMRO-05',
    moduleName: 'Parts and Materials',
    componentName: 'Suppliers',
    table: 'suppliers',
    createPayload: {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      supplier_code: `CRUD-SUP-${runSuffix}`,
      name: 'CRUD Supplier',
      email: `crud-supplier-${runSuffix}@example.local`,
    },
    updatePayload: { name: 'CRUD Supplier Updated' },
    readMatchField: 'supplier_code',
  });

  await verifyCrud({
    moduleId: 'MOD-AMRO-06',
    moduleName: 'Compliance and Airworthiness',
    componentName: 'Compliance obligations',
    table: 'compliance_obligations',
    createPayload: {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      work_order_id: workOrder.id,
      obligation_code: `CRUD-OBL-${runSuffix}`,
      obligation_type: 'check',
      title: 'CRUD Compliance Obligation',
      due_date: nextWeekDateIso,
      status: 'open',
    },
    updatePayload: { status: 'in_progress' },
    readMatchField: 'obligation_code',
  });

  await verifyCrud({
    moduleId: 'MOD-AMRO-07',
    moduleName: 'Certification and Authority',
    componentName: 'Certification actions',
    table: 'certification_actions',
    createPayload: {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      staff_qualification_id: staffQualification.id,
      work_order_id: workOrder.id,
      action_type: 'defer',
      action_status: 'pending',
      policy_snapshot_id: policySnapshot.id,
    },
    updatePayload: { action_notes: 'CRUD update note' },
    readMatchField: 'id',
  });

  await verifyCrud({
    moduleId: 'MOD-AMRO-08',
    moduleName: 'Integration and Partner Hub',
    componentName: 'Integration jobs',
    table: 'integration_jobs',
    createPayload: {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      job_type: 'crud_job',
      source_system: 'erp',
      target_system: 'amro',
      status: 'queued',
      idempotency_key: `crud-job-${runSuffix}`,
      payload: { mode: 'crud' },
    },
    updatePayload: { status: 'running' },
    readMatchField: 'idempotency_key',
  });

  await verifyCrud({
    moduleId: 'MOD-AMRO-09',
    moduleName: 'Forecast and Reliability',
    componentName: 'Asset health signals',
    table: 'asset_health_signals',
    createPayload: {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      aircraft_id: aircraft.id,
      component_id: component.id,
      signal_type: 'temperature',
      signal_source: 'crud',
      value_numeric: 55,
      unit: 'C',
    },
    updatePayload: { value_numeric: 57 },
    readMatchField: 'id',
  });

  await verifyCrud({
    moduleId: 'MOD-AMRO-02',
    moduleName: 'Work Package Management',
    componentName: 'Work package templates',
    table: 'work_order_templates',
    createPayload: {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      template_code: `CRUD-TPL-${runSuffix}`,
      template_name: 'CRUD Template',
      version: 1,
      maintenance_type: 'inspection',
      scope_json: [{ section: 'CRUD' }],
      tasks_json: [{ task_number: 'CRUD-STEP', title: 'Perform CRUD template validation' }],
      policy_snapshot_id: policySnapshot.id,
    },
    updatePayload: { template_name: 'CRUD Template Updated' },
    readMatchField: 'template_code',
  });

  await verifyCrud({
    moduleId: 'MOD-AMRO-03',
    moduleName: 'Task Execution and Evidence',
    componentName: 'Task evidence',
    table: 'task_evidence',
    createPayload: {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      task_id: task.id,
      maintenance_event_id: maintenanceEvent.id,
      evidence_type: 'note',
      uri: `s3://amro/evidence/crud-${runSuffix}.txt`,
      checksum: `sha256:${crypto.createHash('sha256').update(`crud-evidence-${runSuffix}`).digest('hex')}`,
      metadata: { source: 'crud-verification' },
      captured_by: usersByKey.technician.id,
      created_by: usersByKey.technician.id,
    },
    updatePayload: {},
    readMatchField: 'id',
    deleteMode: 'immutable',
  });

  await verifyCrud({
    moduleId: 'MOD-AMRO-05',
    moduleName: 'Parts and Materials',
    componentName: 'Part reservations',
    table: 'reservations',
    createPayload: {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      inventory_id: partsInventory.id,
      work_order_id: workOrder.id,
      task_id: task.id,
      reserved_quantity: 1,
      status: 'active',
      reserved_by: usersByKey.store.id,
    },
    updatePayload: { status: 'fulfilled' },
    readMatchField: 'id',
  });

  await verifyCrud({
    moduleId: 'MOD-AMRO-06',
    moduleName: 'Compliance and Airworthiness',
    componentName: 'Compliance records',
    table: 'compliance_records',
    createPayload: {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      obligation_id: complianceObligation.id,
      task_id: task.id,
      decision_status: 'pending',
      policy_snapshot_id: policySnapshot.id,
      reviewed_by: usersByKey.inspector.id,
      created_by: usersByKey.inspector.id,
      updated_by: usersByKey.inspector.id,
    },
    updatePayload: { decision_status: 'deferred' },
    readMatchField: 'id',
  });

  await verifyCrud({
    moduleId: 'MOD-AMRO-07',
    moduleName: 'Certification and Authority',
    componentName: 'Staff qualifications',
    table: 'staff_qualifications',
    createPayload: {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      staff_id: usersByKey.certifier.id,
      qualification_code: `CRUD-QUAL-${runSuffix}`,
      qualification_name: 'CRUD Certifying Engineer',
      issuing_authority: 'DGCA',
      issue_date: nowIso.slice(0, 10),
      expiration_date: nextWeekDateIso,
      rating: 'A&P',
      can_certify_release: true,
      regulator_profile_id: regulatorProfile.id,
      license_number: `CRUD-LIC-${runSuffix}`,
      certificate_number: `CRUD-CERT-${runSuffix}`,
      created_by: usersByKey.tenantAdmin.id,
      updated_by: usersByKey.tenantAdmin.id,
    },
    updatePayload: { rating: 'B1' },
    readMatchField: 'qualification_code',
  });

  await verifyCrud({
    moduleId: 'MOD-AMRO-08',
    moduleName: 'Integration and Partner Hub',
    componentName: 'Webhook outbox',
    table: 'webhook_outbox',
    createPayload: {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      event_type: 'crud_event',
      endpoint_url: 'https://example.local/amro-crud',
      payload: { runSuffix },
      status: 'pending',
      created_by: usersByKey.integration.id,
      updated_by: usersByKey.integration.id,
    },
    updatePayload: { status: 'delivered' },
    readMatchField: 'id',
  });

  await verifyCrud({
    moduleId: 'MOD-AMRO-09',
    moduleName: 'Forecast and Reliability',
    componentName: 'Forecast features',
    table: 'forecast_features',
    createPayload: {
      tenant_id: tenant.id,
      franchise_id: franchise.id,
      asset_id: aircraft.id,
      feature_vector: { vibration: 1.4, pressure: 22.1 },
      inference_time: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      feature_hash: `crud-ff-${runSuffix}`,
      model_version: 'crud-forecast-v1',
      created_by: usersByKey.management.id,
    },
    updatePayload: { model_version: 'crud-forecast-v2' },
    readMatchField: 'id',
  });

  if (auditSchemaAvailable) {
    const auditRecordKey = `CRUD-AUDIT-${runSuffix}`;
    const { data: auditCreated, error: auditCreateError } = await supabase.schema('mro_audit').from('records').insert({
      tenant_id: tenant.id,
      record_type: 'system_action',
      related_entity_id: auditRecordKey,
      related_entity_type: 'batch_operation',
      actor_id: usersByKey.management.id,
      actor_role: 'system',
      action: 'CRUD create/read verification for audit module',
      context: { runSuffix },
    }).select().single();
    ensureNoError(auditCreateError, '[MOD-AMRO-10] create mro_audit.records');
    const { data: auditRead, error: auditReadError } = await supabase.schema('mro_audit').from('records').select('*').eq('id', auditCreated.id).maybeSingle();
    ensureNoError(auditReadError, '[MOD-AMRO-10] read mro_audit.records');
    moduleCrudResults.push({
      moduleId: 'MOD-AMRO-10',
      moduleName: 'Audit and Evidence Ledger',
      table: 'mro_audit.records',
      create: Boolean(auditCreated),
      read: Boolean(auditRead),
      update: 'immutable',
      delete: 'immutable',
    });
  } else {
    moduleCrudResults.push({
      moduleId: 'MOD-AMRO-10',
      moduleName: 'Audit and Evidence Ledger',
      table: 'mro_audit.records',
      create: 'skipped',
      read: 'skipped',
      update: 'immutable',
      delete: 'immutable',
    });
  }

  const crudDomainUser = await ensureSeedUser({
    email: `crud.domain.${runSuffix}@amro.local`,
    firstName: 'Crud',
    lastName: 'Domain',
  });

  await verifyCrud({
    moduleId: 'MOD-AMRO-08',
    moduleName: 'Integration and Partner Hub',
    componentName: 'User domain assignments',
    table: 'user_domain_assignments',
    createPayload: {
      user_id: crudDomainUser.id,
      tenant_id: tenant.id,
      domain_id: amroDomain.id,
      is_active: true,
    },
    updatePayload: { is_active: false },
    readMatchField: 'id',
  });

  await Promise.all([
    verifyScopeCounts({ tenantId: tenant.id, franchiseId: franchise.id, table: 'work_orders' }),
    verifyScopeCounts({ tenantId: tenant.id, franchiseId: franchise.id, table: 'tasks' }),
    verifyScopeCounts({ tenantId: tenant.id, franchiseId: franchise.id, table: 'policy_snapshots' }),
    verifyScopeCounts({ tenantId: tenant.id, franchiseId: heavyFranchise.id, table: 'work_orders' }),
    verifyScopeCounts({ tenantId: tenant.id, franchiseId: heavyFranchise.id, table: 'tasks' }),
    verifyScopeCounts({ tenantId: tenant.id, franchiseId: heavyFranchise.id, table: 'policy_snapshots' }),
  ]);

  const moduleAndScreenGapAudit = runGapAudit();

  const report = {
    generatedAt: new Date().toISOString(),
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    franchise: { id: franchise.id, code: franchise.code, name: franchise.name },
    secondaryFranchise: { id: heavyFranchise.id, code: heavyFranchise.code, name: heavyFranchise.name },
    amroDomain: { id: amroDomain.id, code: amroDomain.code },
    seedReferences: {
      aircraftId: aircraft.id,
      componentId: component.id,
      workOrderId: workOrder.id,
      taskId: task.id,
      supplierId: supplier.id,
      partsInventoryId: partsInventory.id,
      maintenanceEventId: maintenanceEvent.id,
      policySnapshotId: policySnapshot.id,
      taskEvidenceId: taskEvidence.id,
      taskEvidenceCapturedAt: taskEvidence.captured_at,
      regulatorProfileId: regulatorProfile.id,
      complianceObligationId: complianceObligation.id,
      complianceRecordId: complianceRecord.id,
      certificationActionId: certificationAction.id,
      integrationJobId: integrationJob.id,
      integrationMappingId: integrationMapping.id,
      webhookOutboxId: webhookOutbox.id,
      assetHealthSignalId: assetHealthSignal.id,
      forecastOutputId: forecastOutput.id,
      forecastFeatureId: forecastFeature.id,
      forecastDecisionId: forecastDecision.id,
      workOrderTemplateId: workOrderTemplate.id,
      syncConflictId: syncConflict.id,
      regulatorDossierId: regulatorDossier.id,
      taskQualificationRequirementId: taskQualificationRequirement.id,
      reservationId: reservation.id,
      stockMovementId: stockMovement.id,
      componentPositionId: componentPosition.id,
      shiftCalendarId: shiftCalendar.id,
      scheduleId: schedule.id,
      scheduleConstraintId: scheduleConstraint.id,
      workOrderMaterialId: workOrderMaterial.id,
      heavyPolicySnapshotId: heavyPolicySnapshot.id,
      heavyAircraftId: heavyAircraft.id,
      heavyWorkOrderId: heavyWorkOrder.id,
      heavyTaskId: heavyTask.id,
      heavyRegulatorProfileId: heavyRegulatorProfile.id,
      heavyStaffQualificationId: heavyStaffQualification.id,
      heavyComplianceObligationId: heavyComplianceObligation.id,
      heavyIntegrationJobId: heavyIntegrationJob.id,
      heavyAssetHealthSignalId: heavyAssetHealthSignal.id,
      heavyForecastOutputId: heavyForecastOutput.id,
      overviewKpiSnapshotId: analyticsSeedSummary.sampleSnapshotId,
    },
    analyticsSeedSummary,
    seededUsers: seedUsers.map((user) => ({
      key: user.key,
      email: user.email,
      userId: usersByKey[user.key].id,
      role: user.role,
    })),
    crudVerification: moduleCrudResults,
    crudFailures,
    scopeConsistencyChecks: scopeConsistencyResults,
    moduleAndScreenGapAudit,
    verificationSummary: {
      moduleCoverageTarget: requiredModuleIds.length,
      screenCoverageTarget: requiredScreenIds.length,
      crudChecksExecuted: moduleCrudResults.length,
      crudFailures: crudFailures.length,
      scopeConsistencyFailures: scopeConsistencyResults.filter((entry) => !entry.isConsistent).length,
      hasBlockingGaps: moduleAndScreenGapAudit.hasBlockingGaps,
    },
  };

  const reportDir = path.resolve(process.cwd(), 'artifacts/mro/analysis');
  const reportPath = path.resolve(reportDir, 'amro-remote-seed-and-verify-report.json');
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`AMRO remote seed and CRUD verification completed. Report: ${reportPath}`);
};

run().catch((error) => {
  console.error('AMRO remote seed and verification failed.');
  console.error(error.message);
  process.exit(1);
});
