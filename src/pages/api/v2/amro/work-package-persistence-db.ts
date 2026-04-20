import { getSupabaseAdminClient } from '@/pages/api/_utils/supabaseAdmin';
import { logger } from '@/lib/logger';

export type WorkPackageStatus = 'planning' | 'approved' | 'scheduled' | 'in_progress' | 'on_hold' | 'completed' | 'closed' | 'cancelled';
export type MaintenanceType = 'line' | 'base' | 'component' | 'inspection' | 'overhaul' | 'repair' | 'upgrade' | 'modification';

export interface PersistedWorkPackage {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  aircraft_id: string | null;
  work_order_number: string;
  work_package_number: string;
  title: string;
  description: string | null;
  work_type: string | null;
  maintenance_type: MaintenanceType;
  priority: number;
  source: string | null;
  work_package_template_id: string | null;
  work_package_title_id: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  estimated_labor_hours: number | null;
  estimated_cost: number | null;
  actual_labor_hours: number | null;
  actual_cost: number | null;
  status: WorkPackageStatus;
  assigned_to: string | null;
  supervisor_id: string | null;
  reference_documents: string[] | null;
  notes: string | null;
  external_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkPackageTitleCatalogItem {
  id: string;
  title: string;
  wp_title: string;
  tenant_id: string;
  franchise_id: string | null;
}

export interface PersistedTask {
  id: string;
  task_number: string;
  title: string;
  description: string | null;
  task_category: string | null;
  estimated_duration_hours: number | null;
  complexity_level: string | null;
  sequence_order: number | null;
  status: string;
  progress_percentage: number | null;
  assigned_to: string | null;
  qa_verified_by: string | null;
  qa_verified_at: string | null;
  notes: string | null;
}

export interface PersistedMaterial {
  id: string;
  part_number: string;
  description: string | null;
  manufacturer: string | null;
  action: string;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  status: string;
  supplier_name: string | null;
  is_critical: boolean;
}

function generateWorkOrderNumber(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `WP-${yyyy}${mm}${dd}-${rand}`;
}

// ── Generate next work order number for tenant ──────────────────────────────

async function resolveAircraftRegistration(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  aircraftId: string | null,
): Promise<string> {
  if (!aircraftId) return 'UNKNOWN';
  const { data, error } = await supabase
    .from('aircraft')
    .select('registration,tail_number')
    .eq('id', aircraftId)
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.warn('amro-work-package-aircraft-registration-lookup-failed', { message: error.message, aircraftId });
    return 'UNKNOWN';
  }
  const registration = String(data?.registration || data?.tail_number || '').trim().toUpperCase();
  return registration || 'UNKNOWN';
}

type WorkPackageTitleRecord = { id: string; title: string; wp_title: string };

async function resolveWorkPackageTitleRecord(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  params: {
    tenantId: string;
    franchiseId: string | null;
    workPackageTitleId?: string;
    fallbackTitle: string;
  },
): Promise<WorkPackageTitleRecord> {
  const selectedTitleId = String(params.workPackageTitleId || '').trim();
  if (selectedTitleId) {
    let titleQuery = supabase
      .from('work_packages_title')
      .select('id,title,wp_title,franchise_id')
      .eq('tenant_id', params.tenantId)
      .eq('id', selectedTitleId)
      .limit(1);
    if (params.franchiseId) {
      titleQuery = titleQuery.or(`franchise_id.is.null,franchise_id.eq.${params.franchiseId}`);
    }
    const { data, error } = await titleQuery.maybeSingle();
    if (error) {
      throw new Error(`Failed to resolve work package title: ${error.message}`);
    }
    if (!data) {
      throw new Error('Selected work package title is not available in current tenant scope');
    }
    return {
      id: String(data.id || ''),
      title: String(data.title || '').trim(),
      wp_title: String(data.wp_title || '').trim().toUpperCase(),
    };
  }

  const fallback = String(params.fallbackTitle || '').trim();
  if (!fallback) {
    throw new Error('title or work_package_title_id is required');
  }
  return {
    id: '',
    title: fallback,
    wp_title: fallback.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16) || 'GENERAL',
  };
}

function toSafeWorkPackageSegment(value: string): string {
  const normalized = String(value || '').trim().toUpperCase();
  const compact = normalized.replace(/[^A-Z0-9-]/g, '');
  return compact || 'NA';
}

function parseWorkPackageNumberSequence(workPackageNumber: string, year: number): number {
  const pattern = /^WP-(.+)-(\d{4})-(\d+)-([A-Z0-9-]+)$/;
  const match = String(workPackageNumber || '').match(pattern);
  if (!match) return 0;
  const parsedYear = Number.parseInt(match[2], 10);
  const parsedSeq = Number.parseInt(match[3], 10);
  if (parsedYear !== year || !Number.isFinite(parsedSeq)) return 0;
  return parsedSeq;
}

async function getNextWorkOrderNumber(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  params: {
    tenantId: string;
    aircraftRegistration: string;
    wpTitleCode: string;
    year: number;
  },
): Promise<string> {
  const likePattern = `WP-%-${params.year}-%`;
  const { data, error } = await supabase
    .from('work_packages')
    .select('work_package_number')
    .eq('tenant_id', params.tenantId)
    .ilike('work_package_number', likePattern);
  if (error) {
    throw new Error(`Failed to generate work package sequence: ${error.message}`);
  }
  const maxSeq = (Array.isArray(data) ? data : []).reduce((max, row) => {
    const current = parseWorkPackageNumberSequence(String((row as Record<string, unknown>).work_package_number || ''), params.year);
    return current > max ? current : max;
  }, 0);
  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `WP-${toSafeWorkPackageSegment(params.aircraftRegistration)}-${params.year}-${nextSeq}-${toSafeWorkPackageSegment(params.wpTitleCode)}`;
}

// ── Create work package ─────────────────────────────────────────────────────

export async function persistCreateWorkPackage(params: {
  tenantId: string;
  franchiseId: string | null;
  userId: string;
  aircraftId: string | null;
  title?: string;
  description?: string;
  workType?: string;
  maintenanceType: MaintenanceType;
  priority: number;
  source?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  estimatedLaborHours?: number;
  estimatedCost?: number;
  assignedTo?: string;
  supervisorId?: string;
  notes?: string;
  referenceDocuments?: string[];
  externalReference?: string;
  workPackageTemplateId?: string;
  workPackageTitleId?: string;
}): Promise<PersistedWorkPackage> {
  const supabase = getSupabaseAdminClient();
  const titleRecord = await resolveWorkPackageTitleRecord(supabase, {
    tenantId: params.tenantId,
    franchiseId: params.franchiseId,
    workPackageTitleId: params.workPackageTitleId,
    fallbackTitle: params.title,
  });
  const aircraftRegistration = await resolveAircraftRegistration(supabase, params.aircraftId);
  const year = new Date().getUTCFullYear();
  const workOrderNumber = await getNextWorkOrderNumber(supabase, {
    tenantId: params.tenantId,
    aircraftRegistration,
    wpTitleCode: titleRecord.wp_title,
    year,
  });

  const { data, error } = await supabase
    .from('work_packages')
    .insert({
      tenant_id: params.tenantId,
      franchise_id: params.franchiseId,
      aircraft_id: params.aircraftId,
      work_package_number: workOrderNumber,
      title: titleRecord.title,
      description: params.description || null,
      work_type: params.workType || params.maintenanceType, // NOT NULL in DB; default to maintenance type
      maintenance_type: params.maintenanceType,
      priority: params.priority,
      source: params.source || null,
      work_package_template_id: params.workPackageTemplateId || null,
      work_package_title_id: titleRecord.id || null,
      planned_start_date: params.plannedStartDate || null,
      planned_end_date: params.plannedEndDate || null,
      estimated_labor_hours: params.estimatedLaborHours || null,
      estimated_cost: params.estimatedCost || null,
      status: 'planning',
      assigned_to: params.assignedTo || null,
      supervisor_id: params.supervisorId || null,
      notes: params.notes || null,
      reference_documents: params.referenceDocuments || null,
      external_reference: params.externalReference || null,
      created_by: params.userId,
      updated_by: params.userId,
    })
    .select('*')
    .single();

  if (error) {
    logger.error('amro-work-package-persist-create-failed', {
      message: error.message,
      code: error.code,
      tenantId: params.tenantId,
    });
    throw new Error(`Failed to persist work package: ${error.message}`);
  }

  logger.info('amro-work-package-created', {
    id: data.id,
    workOrderNumber: data.work_order_number,
    tenantId: params.tenantId,
  });

  return mapRowToWorkPackage(data);
}

// ── Update work package ─────────────────────────────────────────────────────

export async function persistUpdateWorkPackage(params: {
  id: string;
  tenantId: string;
  userId: string;
  patch: Record<string, unknown>;
}): Promise<PersistedWorkPackage> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('work_packages')
    .update({
      ...params.patch,
      updated_by: params.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('tenant_id', params.tenantId)
    .select('*')
    .single();

  if (error) {
    logger.error('amro-work-package-persist-update-failed', {
      message: error.message,
      code: error.code,
      id: params.id,
      tenantId: params.tenantId,
    });
    throw new Error(`Failed to update work package: ${error.message}`);
  }

  return mapRowToWorkPackage(data);
}

// ── Transition work package status ──────────────────────────────────────────

export async function persistTransitionWorkPackage(params: {
  id: string;
  tenantId: string;
  userId: string;
  targetStatus: WorkPackageStatus;
  complianceNotes?: string;
}): Promise<PersistedWorkPackage> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status: params.targetStatus,
    updated_by: params.userId,
    updated_at: now,
  };

  // Auto-set actual dates on status change
  if (params.targetStatus === 'in_progress') {
    updates.actual_start_date = now;
  }
  if (params.targetStatus === 'completed' || params.targetStatus === 'closed') {
    updates.actual_end_date = now;
  }

  const { data, error } = await supabase
    .from('work_packages')
    .update(updates)
    .eq('id', params.id)
    .eq('tenant_id', params.tenantId)
    .select('*')
    .single();

  if (error) {
    logger.error('amro-work-package-transition-failed', {
      message: error.message,
      code: error.code,
      id: params.id,
      targetStatus: params.targetStatus,
      tenantId: params.tenantId,
    });
    throw new Error(`Failed to transition work package: ${error.message}`);
  }

  logger.info('amro-work-package-transitioned', {
    id: data.id,
    workOrderNumber: data.work_order_number,
    newStatus: data.status,
    tenantId: params.tenantId,
  });

  return mapRowToWorkPackage(data);
}

// ── Delete work package ─────────────────────────────────────────────────────

export async function persistDeleteWorkPackage(params: {
  id: string;
  tenantId: string;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from('work_packages')
    .delete()
    .eq('id', params.id)
    .eq('tenant_id', params.tenantId);

  if (error) {
    logger.error('amro-work-package-delete-failed', {
      message: error.message,
      code: error.code,
      id: params.id,
      tenantId: params.tenantId,
    });
    throw new Error(`Failed to delete work package: ${error.message}`);
  }

  logger.info('amro-work-package-deleted', {
    id: params.id,
    tenantId: params.tenantId,
  });
}

// ── Fetch work package list ─────────────────────────────────────────────────

export async function fetchWorkPackageList(params: {
  tenantId: string;
  franchiseId: string | null;
  page: number;
  pageSize: number;
  status?: string;
  priority?: number;
  maintenanceType?: string;
  aircraftId?: string;
  assignedTo?: string;
  search?: string;
}): Promise<{ rows: PersistedWorkPackage[]; total: number }> {
  const supabase = getSupabaseAdminClient();
  const offset = (params.page - 1) * params.pageSize;

  let query = supabase
    .from('work_packages')
    .select('*', { count: 'exact', head: false });

  // Only filter by tenant if a valid UUID is provided
  if (params.tenantId) {
    query = query.eq('tenant_id', params.tenantId);
  }

  if (params.franchiseId) {
    query = query.eq('franchise_id', params.franchiseId);
  }
  if (params.status) {
    query = query.eq('status', params.status);
  }
  if (params.priority) {
    query = query.eq('priority', params.priority);
  }
  if (params.maintenanceType) {
    query = query.eq('maintenance_type', params.maintenanceType);
  }
  if (params.aircraftId) {
    query = query.eq('aircraft_id', params.aircraftId);
  }
  if (params.assignedTo) {
    query = query.eq('assigned_to', params.assignedTo);
  }
  if (params.search) {
    query = query.or(
      `title.ilike.%${params.search}%,work_package_number.ilike.%${params.search}%,notes.ilike.%${params.search}%`
    );
  }

  query = query.order('created_at', { ascending: false }).range(offset, offset + params.pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    logger.error('amro-work-package-list-failed', {
      message: error.message,
      code: error.code,
      tenantId: params.tenantId,
    });
    throw new Error(`Failed to fetch work packages: ${error.message}`);
  }

  return {
    rows: (data || []).map(mapRowToWorkPackage),
    total: count || 0,
  };
}

// ── Fetch single work package with tasks, materials, events ─────────────────

export async function fetchWorkPackageDetail(params: {
  id: string;
  tenantId: string;
}): Promise<{
  workPackage: PersistedWorkPackage;
  tasks: PersistedTask[];
  materials: PersistedMaterial[];
  events: MaintenanceEventRow[];
} | null> {
  const supabase = getSupabaseAdminClient();

  // Fetch work package
  let wpQuery = supabase.from('work_packages').select('*').eq('id', params.id);
  if (params.tenantId) wpQuery = wpQuery.eq('tenant_id', params.tenantId);
  const { data: wp, error: wpError } = await wpQuery.single();

  if (wpError || !wp) return null;

  // Fetch tasks
  let tasksQuery = supabase.from('tasks').select('*').eq('work_package_id', params.id);
  if (params.tenantId) tasksQuery = tasksQuery.eq('tenant_id', params.tenantId);
  const { data: tasks, error: tasksError } = await tasksQuery.order('sequence_order', { ascending: true });

  if (tasksError) {
    logger.warn('amro-work-package-tasks-fetch-failed', {
      message: tasksError.message,
      workPackageId: params.id,
    });
  }

  // Fetch materials
  let matQuery = supabase.from('work_package_materials').select('*').eq('work_package_id', params.id);
  if (params.tenantId) matQuery = matQuery.eq('tenant_id', params.tenantId);
  const { data: materials, error: materialsError } = await matQuery;

  if (materialsError) {
    logger.warn('amro-work-package-materials-fetch-failed', {
      message: materialsError.message,
      workPackageId: params.id,
    });
  }

  // Fetch maintenance events
  let evtQuery = supabase.from('maintenance_events').select('*').eq('work_package_id', params.id);
  if (params.tenantId) evtQuery = evtQuery.eq('tenant_id', params.tenantId);
  const { data: events, error: eventsError } = await evtQuery.order('event_timestamp', { ascending: false });

  if (eventsError) {
    logger.warn('amro-work-package-events-fetch-failed', {
      message: eventsError.message,
      workPackageId: params.id,
    });
  }

  return {
    workPackage: mapRowToWorkPackage(wp),
    tasks: (tasks || []).map(mapRowToTask),
    materials: (materials || []).map(mapRowToMaterial),
    events: events || [],
  };
}

// ── Maintenance event row (raw DB shape) ─────────────────────────────────────

interface MaintenanceEventRow {
  id: string;
  event_type: string;
  event_code: string | null;
  title: string;
  description: string | null;
  performed_by: string | null;
  approved_by: string | null;
  event_timestamp: string;
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapRowToWorkPackage(row: Record<string, unknown>): PersistedWorkPackage {
  return {
    id: String(row.id || ''),
    tenant_id: String(row.tenant_id || ''),
    franchise_id: row.franchise_id ? String(row.franchise_id) : null,
    aircraft_id: row.aircraft_id ? String(row.aircraft_id) : null,
    // work_package_number is the sole identifier; work_order_number column was dropped
    work_order_number: String(row.work_package_number || ''),
    work_package_number: String(row.work_package_number || ''),
    title: String(row.title || ''),
    description: row.description ? String(row.description) : null,
    work_type: row.work_type ? String(row.work_type) : null,
    maintenance_type: (row.maintenance_type as MaintenanceType) || 'line',
    priority: Number(row.priority || 3),
    source: row.source ? String(row.source) : null,
    work_package_template_id: row.work_package_template_id ? String(row.work_package_template_id) : null,
    work_package_title_id: row.work_package_title_id ? String(row.work_package_title_id) : null,
    planned_start_date: row.planned_start_date ? String(row.planned_start_date) : null,
    planned_end_date: row.planned_end_date ? String(row.planned_end_date) : null,
    actual_start_date: row.actual_start_date ? String(row.actual_start_date) : null,
    actual_end_date: row.actual_end_date ? String(row.actual_end_date) : null,
    estimated_labor_hours: row.estimated_labor_hours ? Number(row.estimated_labor_hours) : null,
    estimated_cost: row.estimated_cost ? Number(row.estimated_cost) : null,
    actual_labor_hours: row.actual_labor_hours ? Number(row.actual_labor_hours) : null,
    actual_cost: row.actual_cost ? Number(row.actual_cost) : null,
    status: (row.status as WorkPackageStatus) || 'planning',
    assigned_to: row.assigned_to ? String(row.assigned_to) : null,
    supervisor_id: row.supervisor_id ? String(row.supervisor_id) : null,
    reference_documents: Array.isArray(row.reference_documents) ? row.reference_documents as string[] : null,
    notes: row.notes ? String(row.notes) : null,
    external_reference: row.external_reference ? String(row.external_reference) : null,
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

function mapRowToTask(row: Record<string, unknown>): PersistedTask {
  return {
    id: String(row.id || ''),
    task_number: String(row.task_number || ''),
    title: String(row.title || ''),
    description: row.description ? String(row.description) : null,
    task_category: row.task_category ? String(row.task_category) : null,
    estimated_duration_hours: row.estimated_duration_hours ? Number(row.estimated_duration_hours) : null,
    complexity_level: row.complexity_level ? String(row.complexity_level) : null,
    sequence_order: row.sequence_order ? Number(row.sequence_order) : null,
    status: String(row.status || 'planning'),
    progress_percentage: row.progress_percentage != null ? Number(row.progress_percentage) : null,
    assigned_to: row.assigned_to ? String(row.assigned_to) : null,
    qa_verified_by: row.qa_verified_by ? String(row.qa_verified_by) : null,
    qa_verified_at: row.qa_verified_at ? String(row.qa_verified_at) : null,
    notes: row.notes ? String(row.notes) : null,
  };
}

function mapRowToMaterial(row: Record<string, unknown>): PersistedMaterial {
  return {
    id: String(row.id || ''),
    part_number: String(row.part_number || ''),
    description: row.description ? String(row.description) : null,
    manufacturer: row.manufacturer ? String(row.manufacturer) : null,
    action: String(row.action || ''),
    quantity: Number(row.quantity || 0),
    unit_cost: row.unit_cost ? Number(row.unit_cost) : null,
    total_cost: row.total_cost ? Number(row.total_cost) : null,
    status: String(row.status || 'planned'),
    supplier_name: row.supplier_name ? String(row.supplier_name) : null,
    is_critical: Boolean(row.is_critical),
  };
}

// ── Health check ─────────────────────────────────────────────────────────────

export async function checkPersistenceHealth(): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('work_packages').select('id').limit(1);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function fetchWorkPackageTitleCatalog(params: {
  tenantId: string;
  franchiseId: string | null;
}): Promise<{ items: WorkPackageTitleCatalogItem[]; total: number }> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('work_packages_title')
    .select('id,title,wp_title,tenant_id,franchise_id')
    .eq('tenant_id', params.tenantId)
    .order('title', { ascending: true });

  if (params.franchiseId) {
    query = query.or(`franchise_id.is.null,franchise_id.eq.${params.franchiseId}`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch work package title catalog: ${error.message}`);
  }

  const items = (Array.isArray(data) ? data : [])
    .map((row) => ({
      id: String((row as Record<string, unknown>).id || ''),
      title: String((row as Record<string, unknown>).title || ''),
      wp_title: String((row as Record<string, unknown>).wp_title || ''),
      tenant_id: String((row as Record<string, unknown>).tenant_id || ''),
      franchise_id: (row as Record<string, unknown>).franchise_id
        ? String((row as Record<string, unknown>).franchise_id)
        : null,
    }))
    .filter((item) => item.id && item.title && item.wp_title);

  return {
    items,
    total: items.length,
  };
}
