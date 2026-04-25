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
import {
  persistCreateWorkPackage,
  fetchWorkPackageList,
  checkPersistenceHealth,
  type MaintenanceType,
} from '../work-package-persistence-db';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isEnabled(): boolean {
  return parseBoolean(process.env.AMRO_WORK_ORDERS_V2_ENABLED, true);
}

function parseBody(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function assertNonEmpty(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${fieldName} is required`);
  return normalized;
}

function parsePositiveInt(value: unknown, fallback = 1): number {
  const num = Number(value || fallback);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : fallback;
}

const VALID_MAINTENANCE_TYPES: Record<string, boolean> = {
  line: true, base: true, component: true, inspection: true,
  overhaul: true, repair: true, upgrade: true, modification: true,
};

function parseOptionalDate(value: unknown, fieldName: string): string | undefined {
  const normalized = String(value || '').trim();
  if (!normalized) return undefined;
  const parsed = Date.parse(normalized.length === 10 ? `${normalized}T00:00:00.000Z` : normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid date`);
  }
  return new Date(parsed).toISOString();
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);

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
    const authUser = await authenticateRequest(req);
    ctx.userId = authUser.userId;
    ctx.role = authUser.role;
    enforceAnyPermission(authUser.permissions, ['dashboards.view']);
    const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(scopedAccess, { correlationId: ctx.correlationId });
    const tenantId = String(scopedAccess.tenantId || '');
    const franchiseId = scopedAccess.franchiseId ? String(scopedAccess.franchiseId) : null;

    // ── Health check ────────────────────────────────────────────────────────
    if (req.method === 'GET' && req.query.health === 'true') {
      const health = await checkPersistenceHealth();
      res.status(health.ok ? 200 : 503).json({
        version: 'v2',
        interface: 'work-orders-health',
        correlationId: ctx.correlationId,
        output: { persistence: health.ok ? 'healthy' : 'unhealthy', error: health.error || null },
      });
      return;
    }

    // ── GET: list work orders ───────────────────────────────────────────────
    if (req.method === 'GET') {
      const page = parsePositiveInt(req.query.page, 1);
      const pageSize = Math.min(parsePositiveInt(req.query.page_size, 20), 100);
      const status = String(req.query.status || '').trim() || undefined;
      const maintenanceType = String(req.query.maintenance_type || '').trim() || undefined;
      const aircraftId = String(req.query.aircraft_id || '').trim() || undefined;
      const assignedTo = String(req.query.assigned_to || '').trim() || undefined;
      const priority = req.query.priority ? Number(req.query.priority) : undefined;
      const search = String(req.query.search || '').trim() || undefined;

      if (maintenanceType && !VALID_MAINTENANCE_TYPES[maintenanceType]) {
        throw new Error(`Invalid maintenance_type: ${maintenanceType}`);
      }

      const { rows, total } = await fetchWorkPackageList({
        tenantId,
        franchiseId,
        page,
        pageSize,
        status,
        maintenanceType,
        aircraftId,
        assignedTo,
        priority,
        search,
      });

      const records = rows.map((wp) => ({
        id: wp.id,
        work_order_number: wp.work_package_number,
        title: wp.title,
        aircraft_id: wp.aircraft_id,
        aircraft_registration: null, // Would join aircraft table in production
        status: wp.status,
        priority: wp.priority as 1 | 2 | 3 | 4 | 5,
        maintenance_type: wp.maintenance_type,
        planned_start_date: wp.planned_start_date,
        planned_end_date: wp.planned_end_date,
        actual_start_date: wp.actual_start_date,
        actual_end_date: wp.actual_end_date,
        estimated_cost: wp.estimated_cost,
        actual_cost: wp.actual_cost,
        assigned_to: wp.assigned_to,
        source: wp.source,
        created_at: wp.created_at,
      }));

      res.status(200).json({
        version: 'v2',
        interface: 'list-work-orders',
        correlationId: ctx.correlationId,
        output: {
          records,
          total,
          page,
          page_size: pageSize,
        },
      });
      return;
    }

    // ── POST: create work order ─────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = parseBody(req.body);
      const aircraftId = body.aircraft_id ? String(body.aircraft_id).trim() : null;
      const workPackageTitleId = body.work_order_title_id ? String(body.work_order_title_id).trim() : undefined;
      const title = workPackageTitleId
        ? String(body.title || '').trim() || undefined
        : assertNonEmpty(body.title, 'title');
      const maintenanceType = assertNonEmpty(body.maintenance_type, 'maintenance_type').toLowerCase();
      const priority = Math.min(5, Math.max(1, Number(body.priority || 3)));

      if (!VALID_MAINTENANCE_TYPES[maintenanceType]) {
        throw new Error(`Invalid maintenance_type: ${maintenanceType}`);
      }

      // work_type is NOT NULL in DB; default to maintenance_type if not provided
      const workType = body.work_type ? String(body.work_type).trim() : maintenanceType;
      const workPackageTemplateId = body.work_order_template_id ? String(body.work_order_template_id).trim() : undefined;
      const description = body.description ? String(body.description).trim() : undefined;
      const source = body.source ? String(body.source).trim() : undefined;
      const plannedStartDate = parseOptionalDate(body.planned_start_date, 'planned_start_date');
      const plannedEndDate = parseOptionalDate(body.planned_end_date, 'planned_end_date');
      const estimatedLaborHours = body.estimated_labor_hours ? Number(body.estimated_labor_hours) : undefined;
      const estimatedCost = body.estimated_cost ? Number(body.estimated_cost) : undefined;
      const assignedTo = body.assigned_to ? String(body.assigned_to).trim() : undefined;
      const supervisorId = body.supervisor_id ? String(body.supervisor_id).trim() : undefined;
      const notes = body.notes ? String(body.notes).trim() : undefined;
      const externalReference = body.external_reference ? String(body.external_reference).trim() : undefined;
      const referenceDocuments = body.reference_documents
        ? (Array.isArray(body.reference_documents) ? body.reference_documents : [String(body.reference_documents)])
        : undefined;

      const persisted = await persistCreateWorkPackage({
        tenantId,
        franchiseId,
        userId: authUser.userId,
        aircraftId,
        title,
        description,
        workType,
        maintenanceType: maintenanceType as MaintenanceType,
        priority,
        source,
        plannedStartDate,
        plannedEndDate,
        estimatedLaborHours,
        estimatedCost,
        assignedTo,
        supervisorId,
        notes,
        referenceDocuments,
        externalReference,
        workPackageTitleId,
        workPackageTemplateId,
      });

      res.status(201).json({
        version: 'v2',
        interface: 'create-work-order',
        correlationId: ctx.correlationId,
        output: {
          id: persisted.id,
          work_order_number: persisted.work_package_number,
          status: persisted.status,
          created_at: persisted.created_at,
          generated_tasks_count: Number(persisted.generated_tasks_count || 0),
        },
      });
      return;
    }
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
