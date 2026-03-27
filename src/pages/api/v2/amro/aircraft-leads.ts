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

type JsonRecord = Record<string, unknown>;
type SupabaseClient = ReturnType<typeof getSupabaseAdminClient>;
type CacheEntry = {
  expiresAt: number;
  payload: JsonRecord;
};
type AircraftLeadRecord = {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  aircraft_id: string;
  aircraft_registration: string;
  aircraft_type: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  source: string;
  score: number;
  assigned_to: string;
  maintenance_due_at: string;
  next_action_due_at: string;
  compliance_state: string;
  regulatory_authority: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  metadata: JsonRecord;
};

const LEADS_CACHE = new Map<string, CacheEntry>();
const LEADS_CACHE_TTL_MS = Math.max(5_000, Number(process.env.AMRO_AIRCRAFT_LEADS_CACHE_TTL_MS || 20_000));
const MAX_PAGE_SIZE = 250;
const MAX_FALLBACK_ROWS = 10_000;

function parseBody(body: unknown): JsonRecord {
  if (body && typeof body === 'object') {
    return body as JsonRecord;
  }
  return {};
}

function parseString(value: unknown, fallbackValue = ''): string {
  return String(value ?? fallbackValue).trim();
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => parseString(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseIntInRange(value: unknown, fallbackValue: number, minValue: number, maxValue: number) {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }
  return Math.max(minValue, Math.min(maxValue, parsed));
}

function parseNumber(value: unknown, fallbackValue = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }
  return parsed;
}

function toDateISOString(value: unknown): string {
  const normalized = parseString(value);
  if (!normalized) return '';
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    return '';
  }
  return new Date(parsed).toISOString();
}

function toLeadRecord(row: JsonRecord, source: 'aircraft_leads' | 'maintenance_events', aircraftLookup: Map<string, JsonRecord>): AircraftLeadRecord {
  if (source === 'aircraft_leads') {
    const aircraftId = parseString(row.aircraft_id);
    const aircraft = aircraftLookup.get(aircraftId) || {};
    return {
      id: parseString(row.id),
      tenant_id: parseString(row.tenant_id),
      franchise_id: parseString(row.franchise_id) || null,
      aircraft_id: aircraftId,
      aircraft_registration: parseString(row.aircraft_registration || aircraft.registration),
      aircraft_type: parseString(row.aircraft_type || aircraft.aircraft_type),
      title: parseString(row.title),
      description: parseString(row.description),
      status: parseString(row.status || 'new') || 'new',
      priority: parseString(row.priority || 'medium') || 'medium',
      source: parseString(row.source || 'manual') || 'manual',
      score: parseNumber(row.score, 0),
      assigned_to: parseString(row.assigned_to),
      maintenance_due_at: toDateISOString(row.maintenance_due_at || row.due_at),
      next_action_due_at: toDateISOString(row.next_action_due_at),
      compliance_state: parseString(row.compliance_state || 'monitoring') || 'monitoring',
      regulatory_authority: parseString(row.regulatory_authority || 'DGCA'),
      tags: parseStringArray(row.tags),
      created_at: toDateISOString(row.created_at),
      updated_at: toDateISOString(row.updated_at),
      metadata: (row.metadata && typeof row.metadata === 'object' ? (row.metadata as JsonRecord) : {}) || {},
    };
  }
  const data = row.data && typeof row.data === 'object' ? (row.data as JsonRecord) : {};
  const aircraftId = parseString(row.aircraft_id || data.aircraft_id);
  const aircraft = aircraftLookup.get(aircraftId) || {};
  return {
    id: parseString(row.id),
    tenant_id: parseString(row.tenant_id),
    franchise_id: parseString(row.franchise_id) || null,
    aircraft_id: aircraftId,
    aircraft_registration: parseString(data.aircraft_registration || aircraft.registration),
    aircraft_type: parseString(data.aircraft_type || aircraft.aircraft_type),
    title: parseString(row.title || data.title),
    description: parseString(row.description || data.description),
    status: parseString(row.status || data.status || 'new') || 'new',
    priority: parseString(row.severity || data.priority || 'medium') || 'medium',
    source: parseString(data.source || 'manual') || 'manual',
    score: parseNumber(data.score, 0),
    assigned_to: parseString(data.assigned_to || row.performed_by),
    maintenance_due_at: toDateISOString(row.due_at || data.maintenance_due_at),
    next_action_due_at: toDateISOString(data.next_action_due_at),
    compliance_state: parseString(data.compliance_state || 'monitoring') || 'monitoring',
    regulatory_authority: parseString(row.compliance_authority || data.regulatory_authority || 'DGCA'),
    tags: parseStringArray(data.tags),
    created_at: toDateISOString(row.created_at || row.reported_at),
    updated_at: toDateISOString(row.updated_at || row.reported_at),
    metadata: (row.metadata && typeof row.metadata === 'object' ? (row.metadata as JsonRecord) : {}) || {},
  };
}

function matchesLead(lead: AircraftLeadRecord, tokens: string[], filters: Record<string, string>): boolean {
  if (filters.status && filters.status !== 'all' && lead.status !== filters.status) return false;
  if (filters.priority && filters.priority !== 'all' && lead.priority !== filters.priority) return false;
  if (filters.aircraft_type && filters.aircraft_type !== 'all' && lead.aircraft_type !== filters.aircraft_type) return false;
  if (filters.compliance_state && filters.compliance_state !== 'all' && lead.compliance_state !== filters.compliance_state) return false;
  if (filters.assigned_to && filters.assigned_to !== 'all' && lead.assigned_to !== filters.assigned_to) return false;
  if (!tokens.length) return true;
  const indexText = [
    lead.title,
    lead.description,
    lead.aircraft_registration,
    lead.aircraft_type,
    lead.assigned_to,
    ...lead.tags,
  ]
    .join(' ')
    .toLowerCase();
  return tokens.every((token) => indexText.includes(token));
}

function sortLeads(rows: AircraftLeadRecord[], sortBy: string, sortDirection: 'asc' | 'desc') {
  const sorted = [...rows];
  sorted.sort((left, right) => {
    const leftValue = String((left as unknown as JsonRecord)[sortBy] ?? '').toLowerCase();
    const rightValue = String((right as unknown as JsonRecord)[sortBy] ?? '').toLowerCase();
    if (leftValue < rightValue) return sortDirection === 'asc' ? -1 : 1;
    if (leftValue > rightValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

async function checkTableExists(supabase: SupabaseClient, tableName: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(tableName).select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function loadAircraftLookup(supabase: SupabaseClient, tenantId: string, franchiseId: string | null) {
  let query = supabase
    .from('aircraft')
    .select('id,registration,aircraft_type')
    .eq('tenant_id', tenantId)
    .limit(MAX_FALLBACK_ROWS);
  if (franchiseId) {
    query = query.eq('franchise_id', franchiseId);
  }
  const { data } = await query;
  const lookup = new Map<string, JsonRecord>();
  (Array.isArray(data) ? data : []).forEach((row) => {
    if (row && typeof row === 'object') {
      const id = parseString((row as JsonRecord).id);
      if (id) {
        lookup.set(id, row as JsonRecord);
      }
    }
  });
  return lookup;
}

async function loadLeadRows(
  supabase: SupabaseClient,
  tenantId: string,
  franchiseId: string | null,
): Promise<{ rows: JsonRecord[]; source: 'aircraft_leads' | 'maintenance_events' }> {
  const aircraftLeadsTableExists = await checkTableExists(supabase, 'aircraft_leads');
  if (aircraftLeadsTableExists) {
    let query = supabase
      .from('aircraft_leads')
      .select('*')
      .eq('tenant_id', tenantId)
      .limit(MAX_FALLBACK_ROWS);
    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }
    const { data, error } = await query;
    if (!error) {
      return { rows: Array.isArray(data) ? (data as JsonRecord[]) : [], source: 'aircraft_leads' };
    }
  }

  let maintenanceEventsQuery = supabase
    .from('maintenance_events')
    .select('id,tenant_id,franchise_id,aircraft_id,event_type,title,description,status,severity,due_at,reported_at,performed_by,compliance_authority,data,metadata,created_at,updated_at')
    .eq('tenant_id', tenantId)
    .in('event_type', ['amro.aircraft.lead', 'lead', 'prospect'])
    .limit(MAX_FALLBACK_ROWS);
  if (franchiseId) {
    maintenanceEventsQuery = maintenanceEventsQuery.eq('franchise_id', franchiseId);
  }
  const { data } = await maintenanceEventsQuery;
  return { rows: Array.isArray(data) ? (data as JsonRecord[]) : [], source: 'maintenance_events' };
}

function buildCacheKey(args: {
  tenantId: string;
  franchiseId: string | null;
  search: string;
  status: string;
  priority: string;
  aircraftType: string;
  complianceState: string;
  assignedTo: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
}): string {
  return [
    args.tenantId,
    args.franchiseId || 'all',
    args.search,
    args.status,
    args.priority,
    args.aircraftType,
    args.complianceState,
    args.assignedTo,
    String(args.page),
    String(args.pageSize),
    args.sortBy,
    args.sortDirection,
  ].join('|');
}

function normalizeAutocomplete(leads: AircraftLeadRecord[], query: string): string[] {
  const q = query.toLowerCase();
  const set = new Set<string>();
  leads.forEach((lead) => {
    [lead.title, lead.aircraft_registration, lead.aircraft_type, lead.assigned_to, ...lead.tags].forEach((value) => {
      const normalized = parseString(value);
      if (!normalized) return;
      if (normalized.toLowerCase().includes(q)) {
        set.add(normalized);
      }
    });
  });
  return Array.from(set).slice(0, 10);
}

function parseLeadInput(body: JsonRecord): Omit<AircraftLeadRecord, 'id' | 'tenant_id' | 'franchise_id' | 'created_at' | 'updated_at'> {
  const title = parseString(body.title);
  const aircraftId = parseString(body.aircraft_id);
  if (!title) {
    throw new Error('title is required');
  }
  if (!aircraftId) {
    throw new Error('aircraft_id is required');
  }
  return {
    aircraft_id: aircraftId,
    aircraft_registration: parseString(body.aircraft_registration),
    aircraft_type: parseString(body.aircraft_type),
    title,
    description: parseString(body.description),
    status: parseString(body.status || 'new') || 'new',
    priority: parseString(body.priority || 'medium') || 'medium',
    source: parseString(body.source || 'manual') || 'manual',
    score: parseNumber(body.score, 0),
    assigned_to: parseString(body.assigned_to),
    maintenance_due_at: toDateISOString(body.maintenance_due_at),
    next_action_due_at: toDateISOString(body.next_action_due_at),
    compliance_state: parseString(body.compliance_state || 'monitoring') || 'monitoring',
    regulatory_authority: parseString(body.regulatory_authority || 'DGCA') || 'DGCA',
    tags: parseStringArray(body.tags),
    metadata: body.metadata && typeof body.metadata === 'object' ? (body.metadata as JsonRecord) : {},
  };
}

async function createLead(
  supabase: SupabaseClient,
  tenantId: string,
  franchiseId: string | null,
  userId: string,
  leadInput: Omit<AircraftLeadRecord, 'id' | 'tenant_id' | 'franchise_id' | 'created_at' | 'updated_at'>,
) {
  const aircraftLeadsTableExists = await checkTableExists(supabase, 'aircraft_leads');
  if (aircraftLeadsTableExists) {
    const { data, error } = await supabase
      .from('aircraft_leads')
      .insert({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        aircraft_id: leadInput.aircraft_id,
        aircraft_registration: leadInput.aircraft_registration,
        aircraft_type: leadInput.aircraft_type,
        title: leadInput.title,
        description: leadInput.description,
        status: leadInput.status,
        priority: leadInput.priority,
        source: leadInput.source,
        score: leadInput.score,
        assigned_to: leadInput.assigned_to,
        maintenance_due_at: leadInput.maintenance_due_at || null,
        next_action_due_at: leadInput.next_action_due_at || null,
        compliance_state: leadInput.compliance_state,
        regulatory_authority: leadInput.regulatory_authority,
        tags: leadInput.tags,
        metadata: leadInput.metadata,
        created_by: userId,
        updated_by: userId,
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message || 'Failed to create aircraft lead');
    }
    return data as JsonRecord;
  }
  const { data, error } = await supabase
    .from('maintenance_events')
    .insert({
      tenant_id: tenantId,
      franchise_id: franchiseId,
      aircraft_id: leadInput.aircraft_id,
      event_type: 'amro.aircraft.lead',
      title: leadInput.title,
      description: leadInput.description,
      status: leadInput.status,
      severity: leadInput.priority,
      due_at: leadInput.maintenance_due_at || null,
      performed_by: userId,
      compliance_authority: leadInput.regulatory_authority || null,
      data: {
        source: leadInput.source,
        score: leadInput.score,
        assigned_to: leadInput.assigned_to,
        aircraft_registration: leadInput.aircraft_registration,
        aircraft_type: leadInput.aircraft_type,
        next_action_due_at: leadInput.next_action_due_at || null,
        compliance_state: leadInput.compliance_state,
        tags: leadInput.tags,
      },
      metadata: leadInput.metadata,
    })
    .select('*')
    .single();
  if (error) {
    throw new Error(error.message || 'Failed to create aircraft lead');
  }
  return data as JsonRecord;
}

async function updateLead(
  supabase: SupabaseClient,
  tenantId: string,
  franchiseId: string | null,
  userId: string,
  leadId: string,
  leadInput: Omit<AircraftLeadRecord, 'id' | 'tenant_id' | 'franchise_id' | 'created_at' | 'updated_at'>,
) {
  const aircraftLeadsTableExists = await checkTableExists(supabase, 'aircraft_leads');
  if (aircraftLeadsTableExists) {
    let query = supabase
      .from('aircraft_leads')
      .update({
        aircraft_id: leadInput.aircraft_id,
        aircraft_registration: leadInput.aircraft_registration,
        aircraft_type: leadInput.aircraft_type,
        title: leadInput.title,
        description: leadInput.description,
        status: leadInput.status,
        priority: leadInput.priority,
        source: leadInput.source,
        score: leadInput.score,
        assigned_to: leadInput.assigned_to,
        maintenance_due_at: leadInput.maintenance_due_at || null,
        next_action_due_at: leadInput.next_action_due_at || null,
        compliance_state: leadInput.compliance_state,
        regulatory_authority: leadInput.regulatory_authority,
        tags: leadInput.tags,
        metadata: leadInput.metadata,
        updated_by: userId,
      })
      .eq('id', leadId)
      .eq('tenant_id', tenantId);
    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }
    const { data, error } = await query.select('*').single();
    if (error) {
      throw new Error(error.message || 'Failed to update aircraft lead');
    }
    return data as JsonRecord;
  }
  let query = supabase
    .from('maintenance_events')
    .update({
      aircraft_id: leadInput.aircraft_id,
      title: leadInput.title,
      description: leadInput.description,
      status: leadInput.status,
      severity: leadInput.priority,
      due_at: leadInput.maintenance_due_at || null,
      performed_by: userId,
      compliance_authority: leadInput.regulatory_authority || null,
      data: {
        source: leadInput.source,
        score: leadInput.score,
        assigned_to: leadInput.assigned_to,
        aircraft_registration: leadInput.aircraft_registration,
        aircraft_type: leadInput.aircraft_type,
        next_action_due_at: leadInput.next_action_due_at || null,
        compliance_state: leadInput.compliance_state,
        tags: leadInput.tags,
      },
      metadata: leadInput.metadata,
    })
    .eq('id', leadId)
    .eq('tenant_id', tenantId)
    .eq('event_type', 'amro.aircraft.lead');
  if (franchiseId) {
    query = query.eq('franchise_id', franchiseId);
  }
  const { data, error } = await query.select('*').single();
  if (error) {
    throw new Error(error.message || 'Failed to update aircraft lead');
  }
  return data as JsonRecord;
}

async function bulkUpdateLeadStatus(
  supabase: SupabaseClient,
  tenantId: string,
  franchiseId: string | null,
  userId: string,
  ids: string[],
  status: string,
) {
  const aircraftLeadsTableExists = await checkTableExists(supabase, 'aircraft_leads');
  if (aircraftLeadsTableExists) {
    let query = supabase
      .from('aircraft_leads')
      .update({ status, updated_by: userId })
      .eq('tenant_id', tenantId)
      .in('id', ids);
    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }
    const { error } = await query;
    if (error) {
      throw new Error(error.message || 'Failed to update aircraft leads');
    }
    return;
  }
  let query = supabase
    .from('maintenance_events')
    .update({ status, performed_by: userId })
    .eq('tenant_id', tenantId)
    .eq('event_type', 'amro.aircraft.lead')
    .in('id', ids);
  if (franchiseId) {
    query = query.eq('franchise_id', franchiseId);
  }
  const { error } = await query;
  if (error) {
    throw new Error(error.message || 'Failed to update aircraft leads');
  }
}

async function bulkDeleteLeads(
  supabase: SupabaseClient,
  tenantId: string,
  franchiseId: string | null,
  ids: string[],
) {
  const aircraftLeadsTableExists = await checkTableExists(supabase, 'aircraft_leads');
  if (aircraftLeadsTableExists) {
    let query = supabase
      .from('aircraft_leads')
      .delete()
      .eq('tenant_id', tenantId)
      .in('id', ids);
    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }
    const { error } = await query;
    if (error) {
      throw new Error(error.message || 'Failed to delete aircraft leads');
    }
    return;
  }
  let query = supabase
    .from('maintenance_events')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('event_type', 'amro.aircraft.lead')
    .in('id', ids);
  if (franchiseId) {
    query = query.eq('franchise_id', franchiseId);
  }
  const { error } = await query;
  if (error) {
    throw new Error(error.message || 'Failed to delete aircraft leads');
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

  try {
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(String(req.method || ''))) {
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
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
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });

    const tenantId = parseString(access.tenantId);
    const franchiseId = parseString(access.franchiseId) || null;
    const userId = parseString(auth.userId);
    const method = String(req.method || 'GET');
    const supabase = getSupabaseAdminClient();
    const aircraftLookup = await loadAircraftLookup(supabase, tenantId, franchiseId);

    if (method === 'GET') {
      enforceAnyPermission(auth.permissions || [], ['view_amro_dashboard', 'edit_aircraft_records', 'create_maintenance_request']);
      const page = parseIntInRange(req.query.page, 1, 1, 1000);
      const pageSize = parseIntInRange(req.query.page_size, 50, 1, MAX_PAGE_SIZE);
      const sortBy = parseString(req.query.sort_by || 'updated_at');
      const sortDirection = parseString(req.query.sort_dir || 'desc') === 'asc' ? 'asc' : 'desc';
      const search = parseString(req.query.search).toLowerCase();
      const status = parseString(req.query.status || 'all');
      const priority = parseString(req.query.priority || 'all');
      const aircraftType = parseString(req.query.aircraft_type || 'all');
      const complianceState = parseString(req.query.compliance_state || 'all');
      const assignedTo = parseString(req.query.assigned_to || 'all');
      const detailId = parseString(req.query.id);
      const autocomplete = parseString(req.query.autocomplete) === '1';
      const cacheKey = buildCacheKey({
        tenantId,
        franchiseId,
        search,
        status,
        priority,
        aircraftType,
        complianceState,
        assignedTo,
        page,
        pageSize,
        sortBy,
        sortDirection,
      });
      const now = Date.now();
      const cached = LEADS_CACHE.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return res.status(200).json({
          version: 'v2',
          correlationId: ctx.correlationId,
          output: {
            ...cached.payload,
            metadata: {
              ...(cached.payload.metadata as JsonRecord),
              cache: 'hit',
            },
          },
        });
      }

      const { rows, source } = await loadLeadRows(supabase, tenantId, franchiseId);
      let leads = rows.map((row) => toLeadRecord(row, source, aircraftLookup));
      if (detailId) {
        leads = leads.filter((lead) => lead.id === detailId);
      }
      const tokens = search.split(/\s+/).map((token) => token.trim()).filter(Boolean);
      const filtered = leads.filter((lead) =>
        matchesLead(lead, tokens, {
          status,
          priority,
          aircraft_type: aircraftType,
          compliance_state: complianceState,
          assigned_to: assignedTo,
        }),
      );

      if (autocomplete) {
        return res.status(200).json({
          version: 'v2',
          correlationId: ctx.correlationId,
          output: {
            suggestions: normalizeAutocomplete(filtered, search),
            source,
          },
        });
      }

      const sorted = sortLeads(filtered, sortBy, sortDirection);
      const from = (page - 1) * pageSize;
      const paginated = sorted.slice(from, from + pageSize);
      const payload: JsonRecord = {
        records: paginated,
        total_count: sorted.length,
        page,
        page_size: pageSize,
        source,
        metadata: {
          cache: 'miss',
          sort_by: sortBy,
          sort_dir: sortDirection,
          performance_target_ms: 1000,
        },
      };
      LEADS_CACHE.set(cacheKey, {
        expiresAt: now + LEADS_CACHE_TTL_MS,
        payload,
      });
      if (LEADS_CACHE.size > 500) {
        const stale = Array.from(LEADS_CACHE.entries())
          .filter(([, value]) => value.expiresAt <= now)
          .map(([key]) => key);
        stale.forEach((key) => LEADS_CACHE.delete(key));
      }

      return res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: payload,
      });
    }

    const body = parseBody(req.body);

    if (method === 'POST') {
      enforceAnyPermission(auth.permissions || [], ['edit_aircraft_records', 'create_maintenance_request']);
      const operation = parseString(body.operation || 'create');
      if (operation === 'bulk_update_status') {
        const ids = parseStringArray(body.ids);
        const status = parseString(body.status);
        if (!ids.length || !status) {
          throw new Error('ids and status are required');
        }
        await bulkUpdateLeadStatus(supabase, tenantId, franchiseId, userId, ids, status);
        LEADS_CACHE.clear();
        return res.status(200).json({
          version: 'v2',
          correlationId: ctx.correlationId,
          output: {
            updated_count: ids.length,
          },
        });
      }
      if (operation === 'bulk_delete') {
        enforceAnyPermission(auth.permissions || [], ['approve_work_orders', 'delete_flight_logs']);
        const ids = parseStringArray(body.ids);
        if (!ids.length) {
          throw new Error('ids are required');
        }
        await bulkDeleteLeads(supabase, tenantId, franchiseId, ids);
        LEADS_CACHE.clear();
        return res.status(200).json({
          version: 'v2',
          correlationId: ctx.correlationId,
          output: {
            deleted_count: ids.length,
          },
        });
      }
      const leadInput = parseLeadInput(body);
      const created = await createLead(supabase, tenantId, franchiseId, userId, leadInput);
      const normalized = toLeadRecord(created, (await checkTableExists(supabase, 'aircraft_leads')) ? 'aircraft_leads' : 'maintenance_events', aircraftLookup);
      LEADS_CACHE.clear();
      return res.status(201).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          record: normalized,
        },
      });
    }

    if (method === 'PUT') {
      enforceAnyPermission(auth.permissions || [], ['edit_aircraft_records', 'create_maintenance_request']);
      const leadId = parseString(body.id || req.query.id);
      if (!leadId) {
        throw new Error('id is required');
      }
      const leadInput = parseLeadInput(body);
      const updated = await updateLead(supabase, tenantId, franchiseId, userId, leadId, leadInput);
      const normalized = toLeadRecord(updated, (await checkTableExists(supabase, 'aircraft_leads')) ? 'aircraft_leads' : 'maintenance_events', aircraftLookup);
      LEADS_CACHE.clear();
      return res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          record: normalized,
        },
      });
    }

    enforceAnyPermission(auth.permissions || [], ['approve_work_orders', 'delete_flight_logs']);
    const ids = parseStringArray(req.query.ids);
    if (!ids.length) {
      throw new Error('ids are required');
    }
    await bulkDeleteLeads(supabase, tenantId, franchiseId, ids);
    LEADS_CACHE.clear();
    return res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      output: {
        deleted_count: ids.length,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
