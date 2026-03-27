import type { ApiRequest, ApiResponse } from '../../_utils/types';
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
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';
import { buildAmroServiceBoundaryEnvelope, createAmroIsolationScope } from './anti-corruption-adapter';

type DashboardRole = 'technician' | 'engineer' | 'manager';
type JsonRecord = Record<string, unknown>;
type SupabaseClient = ReturnType<typeof getSupabaseAdminClient>;
type CacheEntry = {
  expiresAt: number;
  payload: JsonRecord;
};

const DASHBOARD_CACHE = new Map<string, CacheEntry>();
const DASHBOARD_CACHE_TTL_MS = Math.max(10_000, Number(process.env.AMRO_AIRCRAFT_DASHBOARD_CACHE_TTL_MS || 60_000));
const MAX_ROWS = 250;

function parsePositiveInteger(value: unknown, fallbackValue: number, minValue: number, maxValue: number): number {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }
  return Math.min(maxValue, Math.max(minValue, parsed));
}

function parseStringValue(value: unknown): string {
  return String(value || '').trim();
}

function parseNumberValue(value: unknown, fallbackValue = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }
  return parsed;
}

function resolveDashboardRole(permissions: string[]): DashboardRole {
  const normalized = new Set(permissions.map((permission) => String(permission || '').trim()));
  if (normalized.has('approve_work_orders') || normalized.has('delete_flight_logs') || normalized.has('dashboards.manage')) {
    return 'manager';
  }
  if (normalized.has('edit_aircraft_records') || normalized.has('view_amro_dashboard')) {
    return 'engineer';
  }
  return 'technician';
}

function isStatusMatch(status: string, statusFilter: string): boolean {
  if (!statusFilter || statusFilter === 'all') return true;
  return status.toLowerCase() === statusFilter.toLowerCase();
}

function matchesSearchTokens(row: JsonRecord, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const indexText = Object.values(row)
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
  return tokens.every((token) => indexText.includes(token));
}

function parseDateMs(value: unknown): number {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function withinDueWindow(targetDate: unknown, dueWithinDays: number): boolean {
  if (dueWithinDays <= 0) return true;
  const ms = parseDateMs(targetDate);
  if (!ms) return true;
  const now = Date.now();
  const diffDays = Math.round((ms - now) / (24 * 60 * 60 * 1000));
  return diffDays <= dueWithinDays;
}

function computeDueInDays(targetDate: unknown): number | null {
  const ms = parseDateMs(targetDate);
  if (!ms) return null;
  return Math.round((ms - Date.now()) / (24 * 60 * 60 * 1000));
}

async function selectRowsFromCandidates(args: {
  supabase: SupabaseClient;
  candidateTables: string[];
  columns: string;
  tenantId: string;
  franchiseId: string | null;
  limit: number;
  orderBy?: string;
}): Promise<{ rows: JsonRecord[]; source: string }> {
  const {
    supabase,
    candidateTables,
    columns,
    tenantId,
    franchiseId,
    limit,
    orderBy = 'updated_at',
  } = args;
  for (const table of candidateTables) {
    try {
      let query = supabase
        .from(table)
        .select(columns)
        .eq('tenant_id', tenantId)
        .order(orderBy, { ascending: false })
        .limit(limit);
      if (franchiseId) {
        query = query.eq('franchise_id', franchiseId);
      }
      const { data, error } = await query;
      if (error) {
        continue;
      }
      const rows = Array.isArray(data)
        ? (data as unknown[]).filter((row): row is JsonRecord => Boolean(row) && typeof row === 'object')
        : [];
      return {
        rows,
        source: table,
      };
    } catch {
      continue;
    }
  }
  return {
    rows: [],
    source: 'none',
  };
}

async function loadAircraftRows(supabase: SupabaseClient, tenantId: string, franchiseId: string | null, limit: number) {
  return selectRowsFromCandidates({
    supabase,
    tenantId,
    franchiseId,
    limit,
    candidateTables: ['aircraft'],
    columns: 'id,tail_number,registration,status,current_flight_hours,current_cycles,defect_count,updated_at',
  });
}

async function loadWorkPackageRows(supabase: SupabaseClient, tenantId: string, franchiseId: string | null, limit: number) {
  return selectRowsFromCandidates({
    supabase,
    tenantId,
    franchiseId,
    limit,
    candidateTables: ['work_packages', 'work_package_master'],
    columns: 'id,aircraft_id,work_package_number,title,status,priority,planned_start,planned_end,due_at,compliance_state,updated_at',
  });
}

async function loadFlightLogRows(supabase: SupabaseClient, tenantId: string, franchiseId: string | null, limit: number) {
  return selectRowsFromCandidates({
    supabase,
    tenantId,
    franchiseId,
    limit,
    candidateTables: ['flight_logs'],
    columns: 'id,aircraft_id,flight_date,flight_number,departure_airport,arrival_airport,flight_hours,flight_cycles,pilot_name,regulatory_authority,updated_at',
  });
}

async function loadDefectRows(supabase: SupabaseClient, tenantId: string, franchiseId: string | null, limit: number) {
  return selectRowsFromCandidates({
    supabase,
    tenantId,
    franchiseId,
    limit,
    candidateTables: ['maintenance_events'],
    columns: 'id,aircraft_id,event_type,title,description,status,severity,due_at,reported_at,created_at,updated_at,data',
  });
}

async function loadSignalRows(supabase: SupabaseClient, tenantId: string, franchiseId: string | null, limit: number) {
  return selectRowsFromCandidates({
    supabase,
    tenantId,
    franchiseId,
    limit,
    candidateTables: ['asset_health_signals', 'forecast_outputs'],
    columns: 'id,aircraft_id,signal_type,severity,value,recorded_at,updated_at',
  });
}

async function loadAircraftLeadRows(supabase: SupabaseClient, tenantId: string, franchiseId: string | null, limit: number) {
  const aircraftLeads = await selectRowsFromCandidates({
    supabase,
    tenantId,
    franchiseId,
    limit,
    candidateTables: ['aircraft_leads'],
    columns: 'id,aircraft_id,title,status,priority,compliance_state,maintenance_due_at,next_action_due_at,aircraft_type,updated_at',
  });
  if (aircraftLeads.rows.length > 0) {
    return aircraftLeads;
  }
  return selectRowsFromCandidates({
    supabase,
    tenantId,
    franchiseId,
    limit,
    candidateTables: ['maintenance_events'],
    columns: 'id,aircraft_id,event_type,title,status,severity,due_at,data,updated_at',
  });
}

function buildTrendBuckets(days: number): string[] {
  return Array.from({ length: days }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return date.toISOString().slice(0, 10);
  });
}

function buildFlightHoursTrend(flightLogs: JsonRecord[], days: number) {
  const buckets = buildTrendBuckets(days);
  const map = new Map<string, { day: string; flight_hours: number; cycles: number }>();
  buckets.forEach((day) => {
    map.set(day, { day, flight_hours: 0, cycles: 0 });
  });
  flightLogs.forEach((row) => {
    const day = parseStringValue(row.flight_date || row.updated_at).slice(0, 10);
    if (!map.has(day)) return;
    const bucket = map.get(day);
    if (!bucket) return;
    bucket.flight_hours += parseNumberValue(row.flight_hours);
    bucket.cycles += parseNumberValue(row.flight_cycles);
  });
  return Array.from(map.values());
}

function buildDefectTrend(defectRows: JsonRecord[], days: number) {
  const buckets = buildTrendBuckets(days);
  const map = new Map<string, { day: string; opened: number; resolved: number }>();
  buckets.forEach((day) => {
    map.set(day, { day, opened: 0, resolved: 0 });
  });
  defectRows.forEach((row) => {
    const day = parseStringValue(row.reported_at || row.created_at || row.updated_at).slice(0, 10);
    const status = parseStringValue(row.status || '');
    const bucket = map.get(day);
    if (!bucket) return;
    if (status === 'closed' || status === 'resolved') {
      bucket.resolved += 1;
    } else {
      bucket.opened += 1;
    }
  });
  return Array.from(map.values());
}

function buildRoleScopedOutput(args: {
  role: DashboardRole;
  allData: JsonRecord;
}): JsonRecord {
  const { role, allData } = args;
  const baseOutput: JsonRecord = {
    aircraft_status: allData.aircraft_status,
    maintenance_schedule: allData.maintenance_schedule,
    aircraft_leads: allData.aircraft_leads,
    flight_logs: allData.flight_logs,
    kpis: allData.kpis,
    performance_metrics: allData.performance_metrics,
    compliance_status: allData.compliance_status,
    defect_tracking: allData.defect_tracking,
  };
  if (role === 'manager') {
    return {
      ...baseOutput,
      manager_summary: {
        fleet_size: Number((allData.kpis as JsonRecord).fleet_size || 0),
        open_work_packages: Number((allData.kpis as JsonRecord).open_work_packages || 0),
        compliance_ready_pct: Number((allData.kpis as JsonRecord).compliance_ready_pct || 0),
      },
    };
  }
  if (role === 'engineer') {
    return {
      ...baseOutput,
      manager_summary: null,
    };
  }
  return {
    aircraft_status: allData.aircraft_status,
    maintenance_schedule: (allData.maintenance_schedule as JsonRecord[]).map((item) => ({
      work_package_number: item.work_package_number,
      status: item.status,
      due_in_days: item.due_in_days,
      priority: item.priority,
    })),
    flight_logs: (allData.flight_logs as JsonRecord[]).map((item) => ({
      aircraft_id: item.aircraft_id,
      flight_number: item.flight_number,
      flight_date: item.flight_date,
      flight_hours: item.flight_hours,
      flight_cycles: item.flight_cycles,
      route: item.route,
    })),
    kpis: {
      assigned_aircraft: Number((allData.kpis as JsonRecord).fleet_size || 0),
      due_soon_tasks: Number((allData.kpis as JsonRecord).due_within_window || 0),
      active_defects: Number((allData.kpis as JsonRecord).open_defects || 0),
    },
    performance_metrics: {
      flight_hours_trend: (allData.performance_metrics as JsonRecord).flight_hours_trend,
    },
    compliance_status: {
      compliance_ready_pct: Number((allData.kpis as JsonRecord).compliance_ready_pct || 0),
    },
    aircraft_leads: (allData.aircraft_leads as JsonRecord[]).map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      priority: item.priority,
      compliance_state: item.compliance_state,
      due_in_days: item.due_in_days,
    })),
    defect_tracking: (allData.defect_tracking as JsonRecord[]).map((item) => ({
      title: item.title,
      severity: item.severity,
      status: item.status,
      due_in_days: item.due_in_days,
    })),
    manager_summary: null,
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    const access = await resolveAndApplyAccessContext(req, ctx);
    const compatibilityDecision = resolveGatewayCompatibility(req, {
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    applyCompatibilityResponseHeaders(res, compatibilityDecision, ctx.correlationId);
    const amroAccess = await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    enforceAnyPermission(auth.permissions || [], [
      'view_amro_dashboard',
      'edit_aircraft_records',
      'create_maintenance_request',
      'approve_work_orders',
    ]);

    const tenantId = parseStringValue(access.tenantId);
    const franchiseId = parseStringValue(access.franchiseId) || null;
    const role = resolveDashboardRole((auth.permissions || []) as string[]);
    const scope = createAmroIsolationScope(tenantId, franchiseId);
    const serviceBoundaries = buildAmroServiceBoundaryEnvelope({
      capability: 'work-packages',
      scope,
      subscriptionStatus: amroAccess.subscriptionStatus,
      validatedAt: amroAccess.validatedAt,
    });

    const rowLimit = parsePositiveInteger(req.query.limit, 120, 10, MAX_ROWS);
    const dueWithinDays = parsePositiveInteger(req.query.due_within_days, 30, 0, 365);
    const statusFilter = parseStringValue(req.query.status || 'all').toLowerCase();
    const aircraftFilter = parseStringValue(req.query.aircraft_id).toLowerCase();
    const searchTokens = parseStringValue(req.query.search)
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const trendDays = parsePositiveInteger(req.query.trend_days, 14, 7, 90);

    const cacheKey = [
      tenantId,
      franchiseId || 'global',
      role,
      rowLimit,
      dueWithinDays,
      statusFilter,
      aircraftFilter,
      searchTokens.join('|'),
      trendDays,
    ].join(':');
    const now = Date.now();
    const cached = DASHBOARD_CACHE.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return res.status(200).json({
        version: 'v2',
        interface: 'load-aircraft-lead-dashboard',
        correlationId: ctx.correlationId,
        compatMode: compatibilityDecision.compatMode,
        serviceBoundaries,
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        output: {
          ...cached.payload,
          metadata: {
            ...(cached.payload.metadata as JsonRecord),
            cache: 'hit',
          },
        },
      });
    }

    const supabase = getSupabaseAdminClient();
    const [aircraftData, workPackageData, flightLogData, defectData, signalData, aircraftLeadData] = await Promise.all([
      loadAircraftRows(supabase, tenantId, franchiseId, rowLimit),
      loadWorkPackageRows(supabase, tenantId, franchiseId, rowLimit),
      loadFlightLogRows(supabase, tenantId, franchiseId, rowLimit),
      loadDefectRows(supabase, tenantId, franchiseId, rowLimit),
      loadSignalRows(supabase, tenantId, franchiseId, rowLimit),
      loadAircraftLeadRows(supabase, tenantId, franchiseId, rowLimit),
    ]);

    const aircraftRows = aircraftData.rows.filter((row) => {
      const status = parseStringValue(row.status || 'unknown');
      if (!isStatusMatch(status, statusFilter)) return false;
      if (aircraftFilter) {
        const aircraftId = parseStringValue(row.id).toLowerCase();
        const registration = parseStringValue(row.registration || row.tail_number).toLowerCase();
        if (!aircraftId.includes(aircraftFilter) && !registration.includes(aircraftFilter)) {
          return false;
        }
      }
      return matchesSearchTokens(row, searchTokens);
    });

    const maintenanceRows = workPackageData.rows
      .filter((row) => {
        if (!withinDueWindow(row.due_at || row.planned_end, dueWithinDays)) return false;
        if (!matchesSearchTokens(row, searchTokens)) return false;
        if (!aircraftFilter) return true;
        return parseStringValue(row.aircraft_id).toLowerCase().includes(aircraftFilter);
      })
      .map((row) => {
        const dueDate = row.due_at || row.planned_end || row.planned_start;
        return {
          work_package_id: parseStringValue(row.id),
          aircraft_id: parseStringValue(row.aircraft_id),
          work_package_number: parseStringValue(row.work_package_number || row.id),
          title: parseStringValue(row.title || row.work_package_number || 'Maintenance package'),
          status: parseStringValue(row.status || 'open'),
          priority: parseStringValue(row.priority || 'medium'),
          planned_start: parseStringValue(row.planned_start),
          planned_end: parseStringValue(row.planned_end),
          due_at: parseStringValue(dueDate),
          due_in_days: computeDueInDays(dueDate),
          compliance_state: parseStringValue(row.compliance_state || 'pending'),
        };
      })
      .slice(0, rowLimit);

    const flightLogRows = flightLogData.rows
      .filter((row) => {
        if (!matchesSearchTokens(row, searchTokens)) return false;
        if (!aircraftFilter) return true;
        return parseStringValue(row.aircraft_id).toLowerCase().includes(aircraftFilter);
      })
      .map((row) => ({
        id: parseStringValue(row.id),
        aircraft_id: parseStringValue(row.aircraft_id),
        flight_date: parseStringValue(row.flight_date),
        flight_number: parseStringValue(row.flight_number || row.id),
        route: `${parseStringValue(row.departure_airport)}-${parseStringValue(row.arrival_airport)}`,
        pilot_name: parseStringValue(row.pilot_name || 'Unassigned'),
        flight_hours: Number(parseNumberValue(row.flight_hours).toFixed(2)),
        flight_cycles: Math.trunc(parseNumberValue(row.flight_cycles)),
        regulatory_authority: parseStringValue(row.regulatory_authority || 'N/A'),
      }))
      .slice(0, rowLimit);

    const defectRows = defectData.rows
      .filter((row) => {
        const eventType = parseStringValue(row.event_type || '').toLowerCase();
        if (eventType && !eventType.includes('defect') && !eventType.includes('discrepancy')) {
          return false;
        }
        if (!matchesSearchTokens(row, searchTokens)) return false;
        if (!aircraftFilter) return true;
        return parseStringValue(row.aircraft_id).toLowerCase().includes(aircraftFilter);
      })
      .map((row) => ({
        id: parseStringValue(row.id),
        aircraft_id: parseStringValue(row.aircraft_id),
        title: parseStringValue(row.title || 'Open defect'),
        description: parseStringValue(row.description || ''),
        severity: parseStringValue(row.severity || 'medium'),
        status: parseStringValue(row.status || 'open'),
        due_at: parseStringValue(row.due_at || ''),
        due_in_days: computeDueInDays(row.due_at),
        reported_at: parseStringValue(row.reported_at || row.created_at || row.updated_at),
      }))
      .slice(0, rowLimit);

    const aircraftLeadRows = aircraftLeadData.rows
      .filter((row) => {
        const eventType = parseStringValue(row.event_type || '').toLowerCase();
        if (aircraftLeadData.source === 'maintenance_events' && eventType && !eventType.includes('lead') && !eventType.includes('prospect')) {
          return false;
        }
        if (!matchesSearchTokens(row, searchTokens)) return false;
        if (statusFilter !== 'all') {
          const status = parseStringValue(row.status || '');
          if (status.toLowerCase() !== statusFilter) return false;
        }
        if (!aircraftFilter) return true;
        return parseStringValue(row.aircraft_id).toLowerCase().includes(aircraftFilter);
      })
      .map((row) => {
        const data = row.data && typeof row.data === 'object' ? (row.data as JsonRecord) : {};
        const dueDate = row.maintenance_due_at || row.due_at || data.maintenance_due_at || data.next_action_due_at;
        return {
          id: parseStringValue(row.id),
          aircraft_id: parseStringValue(row.aircraft_id),
          aircraft_type: parseStringValue(row.aircraft_type || data.aircraft_type),
          title: parseStringValue(row.title || data.title || 'Aircraft Lead'),
          status: parseStringValue(row.status || data.status || 'new'),
          priority: parseStringValue(row.priority || row.severity || data.priority || 'medium'),
          compliance_state: parseStringValue(row.compliance_state || data.compliance_state || 'monitoring'),
          due_at: parseStringValue(dueDate),
          due_in_days: computeDueInDays(dueDate),
          next_action_due_at: parseStringValue(row.next_action_due_at || data.next_action_due_at || ''),
        };
      })
      .slice(0, rowLimit);

    const complianceReadyCount = maintenanceRows.filter((row) => row.compliance_state === 'ready').length;
    const openWorkPackages = maintenanceRows.filter((row) => ['open', 'planning', 'scheduled', 'in_progress', 'blocked'].includes(row.status)).length;
    const overdueCount = maintenanceRows.filter((row) => (row.due_in_days ?? 1) < 0).length;
    const openDefects = defectRows.filter((row) => !['closed', 'resolved'].includes(row.status)).length;
    const totalFlightHours = flightLogRows.reduce((sum, row) => sum + row.flight_hours, 0);
    const totalCycles = flightLogRows.reduce((sum, row) => sum + row.flight_cycles, 0);
    const openAircraftLeads = aircraftLeadRows.filter((row) => !['closed', 'won', 'lost'].includes(String(row.status || '').toLowerCase())).length;
    const leadsAtRisk = aircraftLeadRows.filter((row) => String(row.compliance_state || '').toLowerCase() === 'at_risk').length;
    const signalSeverityIndex = signalData.rows.reduce((sum, row) => {
      const severity = parseStringValue(row.severity || '').toLowerCase();
      if (severity === 'critical') return sum + 3;
      if (severity === 'high') return sum + 2;
      if (severity === 'medium') return sum + 1;
      return sum;
    }, 0);

    const flightHoursTrend = buildFlightHoursTrend(flightLogRows as unknown as JsonRecord[], trendDays);
    const defectTrend = buildDefectTrend(defectRows as unknown as JsonRecord[], trendDays);

    const aircraftStatusRows = aircraftRows.map((row) => ({
      aircraft_id: parseStringValue(row.id),
      registration: parseStringValue(row.registration || row.tail_number || row.id),
      status: parseStringValue(row.status || 'unknown'),
      defect_count: Math.trunc(parseNumberValue(row.defect_count, 0)),
      current_flight_hours: Number(parseNumberValue(row.current_flight_hours, 0).toFixed(2)),
      current_cycles: Math.trunc(parseNumberValue(row.current_cycles, 0)),
      health_score: Math.max(0, Math.min(100, Math.round(100 - parseNumberValue(row.defect_count, 0) * 8))),
      updated_at: parseStringValue(row.updated_at),
    }));

    const allData: JsonRecord = {
      aircraft_status: aircraftStatusRows,
      maintenance_schedule: maintenanceRows,
      aircraft_leads: aircraftLeadRows,
      flight_logs: flightLogRows,
      defect_tracking: defectRows,
      compliance_status: {
        ready_count: complianceReadyCount,
        total_count: maintenanceRows.length,
        overdue_count: overdueCount,
      },
      performance_metrics: {
        flight_hours_trend: flightHoursTrend,
        defect_trend: defectTrend,
        signal_severity_index: signalSeverityIndex,
      },
      kpis: {
        fleet_size: aircraftStatusRows.length,
        open_work_packages: openWorkPackages,
        due_within_window: maintenanceRows.length,
        overdue_work_packages: overdueCount,
        open_defects: openDefects,
        aircraft_leads_open: openAircraftLeads,
        aircraft_leads_total: aircraftLeadRows.length,
        aircraft_leads_at_risk: leadsAtRisk,
        total_flight_hours: Number(totalFlightHours.toFixed(2)),
        total_cycles: totalCycles,
        compliance_ready_pct: maintenanceRows.length > 0 ? Math.round((complianceReadyCount / maintenanceRows.length) * 100) : 100,
      },
    };

    const roleScopedOutput = buildRoleScopedOutput({
      role,
      allData,
    });

    const payload: JsonRecord = {
      metadata: {
        generated_at: new Date().toISOString(),
        role_view: role,
        cache: 'miss',
        sources: {
          aircraft: aircraftData.source,
          maintenance: workPackageData.source,
          aircraft_leads: aircraftLeadData.source,
          flight_logs: flightLogData.source,
          defects: defectData.source,
          iot_signals: signalData.source,
        },
      },
      filters: {
        status: statusFilter || 'all',
        aircraft_id: aircraftFilter || null,
        due_within_days: dueWithinDays,
        trend_days: trendDays,
        search: searchTokens.join(' ') || null,
      },
      ...roleScopedOutput,
    };

    DASHBOARD_CACHE.set(cacheKey, {
      expiresAt: now + DASHBOARD_CACHE_TTL_MS,
      payload,
    });

    if (DASHBOARD_CACHE.size > 500) {
      const staleKeys = Array.from(DASHBOARD_CACHE.entries())
        .filter(([, value]) => value.expiresAt <= Date.now())
        .map(([key]) => key);
      staleKeys.forEach((key) => DASHBOARD_CACHE.delete(key));
    }

    return res.status(200).json({
      version: 'v2',
      interface: 'load-aircraft-lead-dashboard',
      correlationId: ctx.correlationId,
      compatMode: compatibilityDecision.compatMode,
      domainAccess: {
        subscriptionStatus: amroAccess.subscriptionStatus,
        source: amroAccess.source,
        validatedAt: amroAccess.validatedAt,
      },
      serviceBoundaries,
      output: payload,
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
