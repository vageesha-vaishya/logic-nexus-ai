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
  logApiEvent,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import {
  adaptLegacyWorkPackages,
  adaptModuleWorkPackagesFromLegacy,
  buildAmroIntegrationContractEnvelope,
  buildAmroServiceBoundaryEnvelope,
  createAmroIsolationScope,
  enforceAmroScopedLegacyRows,
  type LegacyWorkPackageRow,
  type WorkPackageItem,
} from './anti-corruption-adapter';
import {
  buildHistoricalBackfillMetadata,
  drainAmroReconciliationQueueForFallback,
  enqueueAmroDualWriteOperation,
  enqueueAmroReconciliationSnapshot,
} from './reconciliation-queue';
import { appendAmroAuditLedgerRecord } from './audit-ledger';
import { resolveAmroAuditLedgerCutoverState, resolveAmroV2EndpointRolloutState } from './audit-ledger-cutover';
import { enforceAmroSequentialMilestoneForWorkPackageInterface } from './phase-plan-model';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_WORK_PACKAGES_V2_ENABLED, false);
}

function isDualRunEnabled(): boolean {
  return parseBoolean(process.env.AMRO_WORK_PACKAGES_DUAL_RUN, true);
}

function isLegacyFallbackEnabled(): boolean {
  return parseBoolean(process.env.AMRO_V2_LEGACY_FALLBACK_ENABLED, false)
    || parseBoolean(process.env.AMRO_WORK_PACKAGES_LEGACY_FALLBACK_ENABLED, false);
}

function buildLegacyRows(tenantId: string, franchiseId: string | null): LegacyWorkPackageRow[] {
  return [
    {
      legacy_id: 'legacy-wp-001',
      legacy_code: 'WP-001',
      legacy_title: 'Legacy Structural Inspection',
      legacy_status: 'planned',
      tenant_id: tenantId,
      franchise_id: franchiseId,
      domain_id: 'amro',
      version: 'v2',
    },
    {
      legacy_id: 'legacy-wp-002',
      legacy_code: 'WP-002',
      legacy_title: 'Legacy Avionics Reliability Check',
      legacy_status: 'in_progress',
      tenant_id: tenantId,
      franchise_id: franchiseId,
      domain_id: 'amro',
      version: 'v2',
    },
  ];
}

function buildReconciliation(legacyItems: WorkPackageItem[], moduleItems: WorkPackageItem[]) {
  const legacyCodes = new Set(legacyItems.map((item) => item.code));
  const moduleCodes = new Set(moduleItems.map((item) => item.code));
  const missingInModule = legacyItems.filter((item) => !moduleCodes.has(item.code)).map((item) => item.code);
  const missingInLegacy = moduleItems.filter((item) => !legacyCodes.has(item.code)).map((item) => item.code);
  return {
    legacyCount: legacyItems.length,
    moduleCount: moduleItems.length,
    deltaCount: Math.abs(legacyItems.length - moduleItems.length) + missingInLegacy.length + missingInModule.length,
    missingInModule,
    missingInLegacy,
  };
}

type WorkPackageStatus = 'planning' | 'scheduled' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
type ReplanWorkPackageState = 'planning' | 'scheduled' | 'blocked';
type ShortageAction = 'backorder' | 'substitute' | 'escalate';
type TraceabilityAction = 'verify' | 'quarantine' | 'release';

const ALLOWED_MAINTENANCE_TYPES = new Set(['line', 'base', 'component', 'a-check', 'c-check']);
const ALLOWED_PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);
const ALLOWED_SHORTAGE_ACTIONS = new Set(['backorder', 'substitute', 'escalate']);
const ALLOWED_TRACEABILITY_ACTIONS = new Set(['verify', 'quarantine', 'release']);
const TRUSTED_SUPPLIER_ADAPTERS = new Set(['sap-pm', 'maximo', 'oracle-eam']);
const TRUSTED_PROCUREMENT_ADAPTERS = new Set(['sap-pm', 'oracle-eam', 'maximo', 'ariba', 'coupa']);
const REPLAN_APPROVER_ROLES = new Set(['tenant_admin', 'planner']);
const REPLANNABLE_STATES = new Set<ReplanWorkPackageState>(['planning', 'scheduled', 'blocked']);
const ROLE_TRANSITION_POLICY: Record<string, ReadonlyArray<WorkPackageStatus>> = {
  tenant_admin: ['planning', 'scheduled', 'in_progress', 'completed', 'blocked', 'cancelled'],
  planner: ['planning', 'scheduled', 'blocked'],
  engineer: ['scheduled', 'in_progress', 'blocked'],
  technician: ['in_progress'],
  inspector: ['completed', 'blocked'],
};
const ALLOWED_TRANSITIONS: Record<WorkPackageStatus, ReadonlyArray<WorkPackageStatus>> = {
  planning: ['scheduled', 'blocked', 'cancelled'],
  scheduled: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['completed', 'blocked', 'cancelled'],
  completed: [],
  blocked: ['planning', 'scheduled', 'in_progress', 'cancelled'],
  cancelled: [],
};
const ALLOWED_FILTER_STATUSES = new Set(['all', 'planning', 'scheduled', 'in_progress', 'completed', 'blocked', 'cancelled']);
const SAVED_WORK_PACKAGE_VIEWS: ReadonlyArray<{
  id: string;
  name: string;
  filters: { status: string; search: string };
}> = [
  { id: 'default-all', name: 'All Work Packages', filters: { status: 'all', search: '' } },
  { id: 'scheduled-only', name: 'Scheduled Today', filters: { status: 'scheduled', search: '' } },
  { id: 'blocked-items', name: 'Blocked Items', filters: { status: 'blocked', search: '' } },
];

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') {
    return body as Record<string, unknown>;
  }
  return {};
}

function parseStatusFilter(req: ApiRequest): string {
  const raw = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
  const normalized = String(raw || 'all').trim().toLowerCase() || 'all';
  if (!ALLOWED_FILTER_STATUSES.has(normalized)) {
    throw new Error('Bad Request: status filter is invalid');
  }
  return normalized;
}

function parseSearchFilter(req: ApiRequest): string {
  const raw = Array.isArray(req.query.search) ? req.query.search[0] : req.query.search;
  return String(raw || '').trim().toLowerCase();
}

function parseSavedViewId(req: ApiRequest): string | null {
  const raw = Array.isArray(req.query.saved_view) ? req.query.saved_view[0] : req.query.saved_view;
  const normalized = String(raw || '').trim();
  return normalized || null;
}

function applyWorkPackageFilters(items: WorkPackageItem[], status: string, search: string): WorkPackageItem[] {
  return items.filter((item) => {
    const statusMatch = status === 'all' ? true : item.status.toLowerCase() === status;
    const searchMatch = !search
      ? true
      : item.code.toLowerCase().includes(search) || item.title.toLowerCase().includes(search);
    return statusMatch && searchMatch;
  });
}

function parseDateWindow(value: unknown): { from: string; to: string } {
  const raw = String(value || '').trim();
  if (!raw) {
    throw new Error('planned_window is required');
  }
  let from = '';
  let to = '';
  if (raw.includes('|')) {
    const parts = raw.split('|');
    from = String(parts[0] || '').trim();
    to = String(parts[1] || '').trim();
  } else if (raw.includes(',')) {
    const parts = raw.split(',');
    from = String(parts[0] || '').trim();
    to = String(parts[1] || '').trim();
  } else if (raw.includes('Z:')) {
    const [left = '', right = ''] = raw.split('Z:');
    from = `${String(left || '').trim()}Z`;
    to = String(right || '').trim();
  }
  const fromDate = Date.parse(from);
  const toDate = Date.parse(to);
  if (!Number.isFinite(fromDate) || !Number.isFinite(toDate) || fromDate > toDate) {
    throw new Error('planned_window must be a valid ISO start/end range');
  }
  return { from, to };
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseNumber(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  return parsed;
}

function parseIsoTimestamp(value: unknown, fieldName: string): string {
  const normalized = assertNonEmpty(value, fieldName);
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid ISO timestamp`);
  }
  return new Date(parsed).toISOString();
}

function parseScheduleWindow(start: unknown, end: unknown): { slotStart: string; slotEnd: string } {
  const slotStart = parseIsoTimestamp(start, 'slot_start');
  const slotEnd = parseIsoTimestamp(end, 'slot_end');
  if (Date.parse(slotStart) >= Date.parse(slotEnd)) {
    throw new Error('slot_start must be earlier than slot_end');
  }
  return { slotStart, slotEnd };
}

function assertNoOverlap(window: { slotStart: string; slotEnd: string }, existingSlots: Array<Record<string, unknown>>) {
  const start = Date.parse(window.slotStart);
  const end = Date.parse(window.slotEnd);
  const hasOverlap = existingSlots.some((slot) => {
    const existingStart = Date.parse(String(slot.slot_start || ''));
    const existingEnd = Date.parse(String(slot.slot_end || ''));
    if (!Number.isFinite(existingStart) || !Number.isFinite(existingEnd)) return false;
    return start < existingEnd && existingStart < end;
  });
  if (hasOverlap) {
    throw new Error('No overlap allowed');
  }
}

function assertStationCapacity(assignedTeamCount: number, stationCapacity: number) {
  if (stationCapacity <= 0) {
    throw new Error('station capacity must be positive');
  }
  if (assignedTeamCount > stationCapacity) {
    throw new Error('station capacity check failed');
  }
}

function parseObjectArray(value: unknown, fieldName: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
  return value.map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {}));
}

function assertTeamQualifications(assignedTeam: Array<Record<string, unknown>>, stationCode: string) {
  const normalizedStation = stationCode.trim().toLowerCase();
  const unqualified = assignedTeam.some((member) => {
    const qualifications = parseStringArray(member.qualifications);
    return !qualifications.map((item) => item.toLowerCase()).includes(normalizedStation);
  });
  if (unqualified) {
    throw new Error('qualification checks required');
  }
}

function assertActiveConstraintsAndTenantCalendar(
  activeConstraints: Array<Record<string, unknown>>,
  tenantCalendarId: string,
  tenantId: string
) {
  if (activeConstraints.length === 0) {
    throw new Error('simulation must include active constraints');
  }
  if (!tenantCalendarId.startsWith(`${tenantId}:`)) {
    throw new Error('simulation must include tenant-specific calendars');
  }
}

function assertReplannableStates(affectedWorkPackages: Array<Record<string, unknown>>) {
  const invalidPackage = affectedWorkPackages.find((workPackage) => {
    const state = String(workPackage.current_state || '').trim().toLowerCase() as ReplanWorkPackageState;
    return !REPLANNABLE_STATES.has(state);
  });
  if (invalidPackage) {
    throw new Error('all affected packages must be in re-plannable states');
  }
}

function parseDemandLines(value: unknown, tenantId: string): Array<{ partNumber: string; quantity: number; serial: string | null }> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('demand_lines must include at least one line');
  }
  const serialRegistry = new Set<string>();
  return value.map((line, index) => {
    const record = line && typeof line === 'object' ? (line as Record<string, unknown>) : {};
    const partNumber = assertNonEmpty(record.part_number, `demand_lines[${index}].part_number`);
    const quantity = parseNumber(record.quantity, `demand_lines[${index}].quantity`);
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }
    const serialRaw = String(record.serial || '').trim();
    const serial = serialRaw || null;
    if (serial) {
      const tenantScopedSerial = `${tenantId}:${serial}`;
      if (serialRegistry.has(tenantScopedSerial)) {
        throw new Error('serialized parts must be unique per tenant');
      }
      serialRegistry.add(tenantScopedSerial);
    }
    return { partNumber, quantity, serial };
  });
}

function assertNonEmpty(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

function assertScopeRequired(tenantId: string, franchiseId: string | null) {
  if (!tenantId || !franchiseId) {
    throw new Error('Tenant/franchise scope required');
  }
}

function assertOptionalScopedIdentifier(value: string, tenantId: string, fieldName: string) {
  const normalized = String(value || '').trim();
  if (!normalized.includes(':')) return;
  const [scopedTenant = ''] = normalized.split(':');
  if (scopedTenant !== tenantId) {
    throw new Error(`${fieldName} violates tenant scope`);
  }
}

function assertOptionalScopeContext(body: Record<string, unknown>, tenantId: string, franchiseId: string | null) {
  const scope = parseBody(body.scope);
  if (!Object.keys(scope).length) return;
  const scopeTenantId = String(scope.tenant_id || '').trim();
  const scopeFranchiseId = String(scope.franchise_id || '').trim();
  if (scopeTenantId && scopeTenantId !== tenantId) {
    throw new Error('data scope violation detected');
  }
  if (scopeFranchiseId && scopeFranchiseId !== String(franchiseId || '')) {
    throw new Error('data scope violation detected');
  }
}

function assertAircraftActive(aircraftId: string) {
  const normalized = aircraftId.trim().toLowerCase();
  if (normalized.includes('inactive') || normalized.includes('retired')) {
    throw new Error('aircraft must be active');
  }
}

function ensureTemplateTenantVisible(templateId: string, tenantId: string) {
  const normalized = templateId.trim();
  if (normalized.includes('inactive')) {
    throw new Error('template version must be active');
  }
  const scopedMatch = normalized.match(/^([^:]+):/);
  if (scopedMatch && scopedMatch[1] !== tenantId) {
    throw new Error('template must be tenant-visible');
  }
}

function appendWorkPackageAuditRecord(params: {
  tenantId: string;
  franchiseId: string | null;
  correlationId: string;
  compatMode: string;
  mode: 'dual-run' | 'module' | 'legacy-fallback';
  legacyItems: WorkPackageItem[];
  moduleItems: WorkPackageItem[];
  queueMode: 'redis' | 'memory' | 'disabled' | null;
  snapshotCheckpoint: string | null;
}) {
  const reconciliation = buildReconciliation(params.legacyItems, params.moduleItems);
  const historicalBackfill = buildHistoricalBackfillMetadata({
    capability: 'work-packages',
    correlationId: params.correlationId,
    tenantId: params.tenantId,
    franchiseId: params.franchiseId,
    compatMode: params.compatMode,
    requestedFilters: {},
    reconciliation,
  });

  return appendAmroAuditLedgerRecord({
    tenantId: params.tenantId,
    franchiseId: params.franchiseId,
    capability: 'work-packages',
    eventType: 'amro.audit.recorded.v1',
    entityType: 'work-package',
    entityId: 'scope:all',
    correlationId: params.correlationId,
    action: `${params.mode}.read`,
    compatMode: params.compatMode,
    sourceHash: historicalBackfill.sourceHash,
    migrationBatchId: historicalBackfill.migrationBatchId,
    replayCheckpoint: params.snapshotCheckpoint || historicalBackfill.replayCheckpoint,
    context: {
      mode: params.mode,
      queueMode: params.queueMode,
      reconciliation,
    },
  });
}

async function enqueueWorkPackageDualWriteOperations(params: {
  tenantId: string;
  franchiseId: string | null;
  correlationId: string;
  compatMode: string;
  workPackages: WorkPackageItem[];
}) {
  const createdWorkPackages = params.workPackages.filter((item) => item.status === 'planned');
  const operations = await Promise.all(
    createdWorkPackages.map(async (item) => {
      const result = await enqueueAmroDualWriteOperation({
        capability: 'work-packages',
        tenantId: params.tenantId,
        franchiseId: params.franchiseId,
        compatMode: params.compatMode,
        correlationId: params.correlationId,
        entityType: 'work-package',
        entityId: item.id,
        eventType: 'amro.work_package.created.v1',
        action: 'upsert',
      });
      return {
        entityId: item.id,
        eventType: 'amro.work_package.created.v1',
        idempotencyKey: result.idempotencyKey,
        queueMode: result.queueMode,
      };
    })
  );
  return {
    enabled: true,
    approvedEntityCount: createdWorkPackages.length,
    operations,
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId, version: 'v2' });
    }

    if (!isV2Enabled()) {
      return res.status(404).json({
        error: 'AMRO work packages v2 endpoint is disabled',
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
    const compatDecision = resolveGatewayCompatibility(req, {
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    applyCompatibilityResponseHeaders(res, compatDecision, ctx.correlationId);

    const amroAccess = await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    const tenantId = String(access.tenantId || '');
    const franchiseId = access.franchiseId ? String(access.franchiseId) : null;
    const isolationScope = createAmroIsolationScope(tenantId, franchiseId);
    const serviceBoundaries = buildAmroServiceBoundaryEnvelope({
      capability: 'work-packages',
      scope: isolationScope,
      subscriptionStatus: amroAccess.subscriptionStatus,
      validatedAt: amroAccess.validatedAt,
    });
    const rolloutState = resolveAmroV2EndpointRolloutState({
      tenantId,
      franchiseId,
      capability: 'work-packages',
    });
    if (!rolloutState.enabled) {
      return res.status(404).json({
        error: 'AMRO work packages v2 endpoint is not enabled for this rollout cohort',
        endpointRollout: rolloutState,
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }
    const cutoverState = resolveAmroAuditLedgerCutoverState({
      tenantId,
      franchiseId,
      capability: 'work-packages',
    });
    const interfaceName = String(req.query.interface || '').trim().toLowerCase();
    if (req.method === 'POST') {
      enforceAmroSequentialMilestoneForWorkPackageInterface(interfaceName);
    }

    if (req.method === 'POST' && interfaceName === 'create-work-package') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      assertScopeRequired(tenantId, franchiseId);
      const body = parseBody(req.body);
      const aircraftId = assertNonEmpty(body.aircraft_id, 'aircraft_id');
      assertAircraftActive(aircraftId);
      const maintenanceType = assertNonEmpty(body.maintenance_type, 'maintenance_type').toLowerCase();
      if (!ALLOWED_MAINTENANCE_TYPES.has(maintenanceType)) {
        throw new Error('maintenance_type is not supported');
      }
      const plannedWindow = parseDateWindow(body.planned_window);
      const station = assertNonEmpty(body.station, 'station');
      const priority = assertNonEmpty(body.priority, 'priority').toLowerCase();
      if (!ALLOWED_PRIORITIES.has(priority)) {
        throw new Error('priority is not supported');
      }
      const scopeItems = parseStringArray(body.scope_items);
      if (scopeItems.length === 0) {
        throw new Error('scope_items must include at least one item');
      }
      const createdAt = new Date().toISOString();
      return res.status(200).json({
        version: 'v2',
        interface: 'create-work-package',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          aircraft_id: aircraftId,
          maintenance_type: maintenanceType,
          planned_window: plannedWindow,
          station: `${tenantId}:${station}`,
          priority,
          scope_items: scopeItems,
        },
        output: {
          work_package_id: `${tenantId}-${franchiseId}-wp-${Date.now()}`,
          status: 'planning',
          created_at: createdAt,
          created_by: ctx.userId,
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'save-work-package-view') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      const viewName = assertNonEmpty(body.view_name, 'view_name');
      const filters = parseBody(body.filters);
      const statusFilter = String(filters.status || 'all').trim().toLowerCase();
      if (!ALLOWED_FILTER_STATUSES.has(statusFilter)) {
        throw new Error('filters.status is invalid');
      }
      const searchFilter = String(filters.search || '').trim().toLowerCase();
      return res.status(200).json({
        version: 'v2',
        interface: 'save-work-package-view',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        output: {
          saved_view_id: `${tenantId}-${franchiseId}-view-${Date.now()}`,
          view_name: viewName,
          filters: {
            status: statusFilter,
            search: searchFilter,
          },
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'transition-work-package') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      const workPackageId = assertNonEmpty(body.work_package_id, 'work_package_id');
      const targetStatus = assertNonEmpty(body.target_status, 'target_status').toLowerCase() as WorkPackageStatus;
      const reasonCode = assertNonEmpty(body.reason_code, 'reason_code');
      const actorSignature = assertNonEmpty(body.actor_signature, 'actor_signature');
      const currentStatus = String(body.current_status || 'planning').trim().toLowerCase() as WorkPackageStatus;
      if (!Object.keys(ALLOWED_TRANSITIONS).includes(currentStatus)) {
        throw new Error('current_status is invalid for policy matrix');
      }
      if (!Object.keys(ALLOWED_TRANSITIONS).includes(targetStatus)) {
        throw new Error('target_status is invalid for policy matrix');
      }
      if (!ALLOWED_TRANSITIONS[currentStatus].includes(targetStatus)) {
        throw new Error('transition is not allowed by policy matrix');
      }
      const roleAllowedStatuses = ROLE_TRANSITION_POLICY[String(ctx.role || '').trim().toLowerCase()] || [];
      if (!roleAllowedStatuses.includes(targetStatus)) {
        throw new Error('transition is not allowed for role');
      }
      return res.status(200).json({
        version: 'v2',
        interface: 'transition-work-package',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          work_package_id: workPackageId,
          current_status: currentStatus,
          target_status: targetStatus,
          reason_code: reasonCode,
          actor_signature: actorSignature,
        },
        output: {
          updated_status: targetStatus,
          transition_id: `${tenantId}-${workPackageId}-${Date.now()}`,
          gate_results: [
            { gate: 'policy-matrix', status: 'passed' },
            { gate: 'role-authorization', status: 'passed' },
          ],
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'clone-template') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      assertScopeRequired(tenantId, franchiseId);
      const body = parseBody(req.body);
      const templateId = assertNonEmpty(body.template_id, 'template_id');
      ensureTemplateTenantVisible(templateId, tenantId);
      const aircraftId = assertNonEmpty(body.aircraft_id, 'aircraft_id');
      assertAircraftActive(aircraftId);
      const overrideFields = parseBody(body.override_fields);
      return res.status(200).json({
        version: 'v2',
        interface: 'clone-template',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          template_id: templateId,
          aircraft_id: aircraftId,
          override_fields: overrideFields,
        },
        output: {
          new_work_package_id: `${tenantId}-${franchiseId}-wp-clone-${Date.now()}`,
          inherited_tasks_count: 14,
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'assign-maintenance-slot') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      assertScopeRequired(tenantId, franchiseId);
      const body = parseBody(req.body);
      const workPackageId = assertNonEmpty(body.work_package_id, 'work_package_id');
      const stationCode = assertNonEmpty(body.station_code, 'station_code');
      const window = parseScheduleWindow(body.slot_start, body.slot_end);
      const assignedTeam = parseObjectArray(body.assigned_team, 'assigned_team');
      const existingSlots = parseObjectArray(body.existing_slots || [], 'existing_slots');
      assertNoOverlap(window, existingSlots);
      assertStationCapacity(assignedTeam.length, parseNumber(body.station_capacity || assignedTeam.length, 'station_capacity'));
      assertTeamQualifications(assignedTeam, stationCode);
      return res.status(200).json({
        version: 'v2',
        interface: 'assign-maintenance-slot',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          work_package_id: workPackageId,
          station_code: `${tenantId}:${stationCode}`,
          slot_start: window.slotStart,
          slot_end: window.slotEnd,
          assigned_team: assignedTeam,
        },
        output: {
          schedule_id: `${tenantId}-${franchiseId}-schedule-${Date.now()}`,
          assignment_status: 'assigned',
          conflict_flags: [],
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'run-replan-simulation') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      assertScopeRequired(tenantId, franchiseId);
      const body = parseBody(req.body);
      const disruptedSlots = parseObjectArray(body.disrupted_slots, 'disrupted_slots');
      if (disruptedSlots.length === 0) {
        throw new Error('disrupted_slots must include at least one slot');
      }
      const priorityRules = parseBody(body.priority_rules);
      const planningHorizon = assertNonEmpty(body.planning_horizon, 'planning_horizon');
      const activeConstraints = parseObjectArray(body.active_constraints, 'active_constraints');
      const tenantCalendarId = assertNonEmpty(body.tenant_calendar_id, 'tenant_calendar_id');
      assertActiveConstraintsAndTenantCalendar(activeConstraints, tenantCalendarId, tenantId);
      const replanOptions = [
        {
          option_id: `${tenantId}-${franchiseId}-replan-opt-1`,
          title: 'Shift non-critical packages',
          impact_score: 0.18,
        },
        {
          option_id: `${tenantId}-${franchiseId}-replan-opt-2`,
          title: 'Split station windows',
          impact_score: 0.27,
        },
      ];
      return res.status(200).json({
        version: 'v2',
        interface: 'run-replan-simulation',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          disrupted_slots: disruptedSlots,
          priority_rules: priorityRules,
          planning_horizon: planningHorizon,
        },
        output: {
          replan_options: replanOptions,
          impact_summary: {
            constrained_by: activeConstraints.map((constraint) => String(constraint.id || '')).filter(Boolean),
            tenant_calendar_id: tenantCalendarId,
            delayed_packages: disruptedSlots.length,
          },
          recommended_option: replanOptions[0],
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'confirm-replan') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const role = String(ctx.role || '').trim().toLowerCase();
      if (!REPLAN_APPROVER_ROLES.has(role)) {
        throw new Error('Approval role required');
      }
      const body = parseBody(req.body);
      const selectedOptionId = assertNonEmpty(body.selected_option_id, 'selected_option_id');
      const approverId = assertNonEmpty(body.approver_id, 'approver_id');
      const reason = assertNonEmpty(body.reason, 'reason');
      const affectedWorkPackages = parseObjectArray(body.affected_work_packages, 'affected_work_packages');
      assertReplannableStates(affectedWorkPackages);
      return res.status(200).json({
        version: 'v2',
        interface: 'confirm-replan',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          selected_option_id: selectedOptionId,
          approver_id: approverId,
          reason,
        },
        output: {
          updated_schedule: {
            schedule_id: `${tenantId}-${franchiseId}-schedule-${Date.now()}`,
            applied_option_id: selectedOptionId,
            approved_by: approverId,
          },
          affected_work_packages: affectedWorkPackages.map((workPackage) => ({
            work_package_id: String(workPackage.work_package_id || ''),
            new_state: 'scheduled',
          })),
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'reserve-parts') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      assertScopeRequired(tenantId, franchiseId);
      const body = parseBody(req.body);
      const workPackageId = assertNonEmpty(body.work_package_id, 'work_package_id');
      assertOptionalScopedIdentifier(workPackageId, tenantId, 'work_package_id');
      assertOptionalScopeContext(body, tenantId, franchiseId);
      const demandLines = parseDemandLines(body.demand_lines, tenantId);
      const reservations = demandLines.map((line) => ({
        reservation_id: `${tenantId}-${line.partNumber}-${Date.now()}`,
        part_number: line.partNumber,
        quantity: line.quantity,
        serial: line.serial,
      }));
      return res.status(200).json({
        version: 'v2',
        interface: 'reserve-parts',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          work_package_id: workPackageId,
          demand_lines: demandLines,
        },
        output: {
          reservations,
          reservation_status: 'reserved',
          shortages: [],
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'process-shortage-response') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      assertScopeRequired(tenantId, franchiseId);
      const body = parseBody(req.body);
      assertOptionalScopeContext(body, tenantId, franchiseId);
      const shortageId = assertNonEmpty(body.shortage_id, 'shortage_id');
      assertOptionalScopedIdentifier(shortageId, tenantId, 'shortage_id');
      const action = assertNonEmpty(body.action, 'action').toLowerCase() as ShortageAction;
      if (!ALLOWED_SHORTAGE_ACTIONS.has(action)) {
        throw new Error('action must be backorder, substitute, or escalate');
      }
      const supplierRef = assertNonEmpty(body.supplier_ref, 'supplier_ref');
      if (action === 'substitute' && body.compatibility_mapping_approved !== true) {
        throw new Error('Substitute must pass approved compatibility mapping');
      }
      return res.status(200).json({
        version: 'v2',
        interface: 'process-shortage-response',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          shortage_id: shortageId,
          action,
          supplier_ref: supplierRef,
        },
        output: {
          shortage_status: action === 'escalate' ? 'escalated' : action === 'substitute' ? 'substitute-approved' : 'backordered',
          procurement_trigger_id: `${tenantId}-${shortageId}-proc-${Date.now()}`,
          procurement_trigger: {
            tenant_id: tenantId,
            franchise_id: franchiseId,
            source_shortage_id: shortageId,
            supplier_ref: supplierRef,
          },
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'sync-supplier-eta') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      assertScopeRequired(tenantId, franchiseId);
      const body = parseBody(req.body);
      assertOptionalScopeContext(body, tenantId, franchiseId);
      const supplierEventId = assertNonEmpty(body.supplier_event_id, 'supplier_event_id');
      const partNumber = assertNonEmpty(body.part_number, 'part_number');
      const eta = parseIsoTimestamp(body.eta, 'eta');
      const quantityConfirmed = parseNumber(body.quantity_confirmed, 'quantity_confirmed');
      if (quantityConfirmed < 0) {
        throw new Error('quantity_confirmed must be zero or greater');
      }
      const supplierSource = assertNonEmpty(body.supplier_source, 'supplier_source').toLowerCase();
      if (!TRUSTED_SUPPLIER_ADAPTERS.has(supplierSource)) {
        throw new Error('Supplier source must be trusted adapter');
      }
      const impactedWorkPackages = parseStringArray(body.impacted_work_packages);
      impactedWorkPackages.forEach((workPackageId) => {
        assertOptionalScopedIdentifier(workPackageId, tenantId, 'impacted_work_packages');
      });
      return res.status(200).json({
        version: 'v2',
        interface: 'sync-supplier-eta',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          supplier_event_id: supplierEventId,
          part_number: partNumber,
          eta,
          quantity_confirmed: quantityConfirmed,
        },
        output: {
          updated_eta: eta,
          impacted_work_packages: impactedWorkPackages,
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'trace-rotable-llp') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      assertScopeRequired(tenantId, franchiseId);
      const body = parseBody(req.body);
      assertOptionalScopeContext(body, tenantId, franchiseId);
      const componentId = assertNonEmpty(body.component_id, 'component_id');
      assertOptionalScopedIdentifier(componentId, tenantId, 'component_id');
      const partNumber = assertNonEmpty(body.part_number, 'part_number');
      const serialNumber = assertNonEmpty(body.serial_number, 'serial_number');
      const rotableStatus = assertNonEmpty(body.rotable_status, 'rotable_status').toLowerCase();
      if (!['serviceable', 'unserviceable', 'quarantined'].includes(rotableStatus)) {
        throw new Error('rotable_status must be serviceable, unserviceable, or quarantined');
      }
      const llpRemainingCycles = parseNumber(body.llp_remaining_cycles, 'llp_remaining_cycles');
      if (llpRemainingCycles < 0) {
        throw new Error('llp_remaining_cycles must be zero or greater');
      }
      const traceabilityAction = assertNonEmpty(body.traceability_action, 'traceability_action').toLowerCase() as TraceabilityAction;
      if (!ALLOWED_TRACEABILITY_ACTIONS.has(traceabilityAction)) {
        throw new Error('traceability_action must be verify, quarantine, or release');
      }
      return res.status(200).json({
        version: 'v2',
        interface: 'trace-rotable-llp',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          component_id: componentId,
          part_number: partNumber,
          serial_number: serialNumber,
          rotable_status: rotableStatus,
          llp_remaining_cycles: llpRemainingCycles,
          traceability_action: traceabilityAction,
        },
        output: {
          traceability_status: traceabilityAction === 'verify'
            ? 'verified'
            : traceabilityAction === 'quarantine'
              ? 'quarantined'
              : 'released',
          llp_control: {
            threshold_cycles: 500,
            within_threshold: llpRemainingCycles <= 500,
          },
          component_history_ref: `${tenantId}-${componentId}-history`,
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'run-inventory-optimization') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      assertScopeRequired(tenantId, franchiseId);
      const body = parseBody(req.body);
      assertOptionalScopeContext(body, tenantId, franchiseId);
      const workPackageId = assertNonEmpty(body.work_package_id, 'work_package_id');
      assertOptionalScopedIdentifier(workPackageId, tenantId, 'work_package_id');
      const forecastSignalIds = parseStringArray(body.forecast_signal_ids);
      const optimizationWindow = assertNonEmpty(body.optimization_window, 'optimization_window');
      return res.status(200).json({
        version: 'v2',
        interface: 'run-inventory-optimization',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          work_package_id: workPackageId,
          forecast_signal_ids: forecastSignalIds,
          optimization_window: optimizationWindow,
        },
        output: {
          optimization_run_id: `${tenantId}-${workPackageId}-inventory-opt-${Date.now()}`,
          recommendations: [
            { part_number: 'PN-ATA72-889', action: 'reserve-now', confidence: 0.92 },
            { part_number: 'PN-ATA27-190', action: 'expedite-supplier', confidence: 0.86 },
          ],
          forecast_signal_count: forecastSignalIds.length,
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'sync-supplier-asn-erp') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      assertScopeRequired(tenantId, franchiseId);
      const body = parseBody(req.body);
      assertOptionalScopeContext(body, tenantId, franchiseId);
      const asnEventId = assertNonEmpty(body.asn_event_id, 'asn_event_id');
      const procurementSource = assertNonEmpty(body.procurement_source, 'procurement_source').toLowerCase();
      if (!TRUSTED_PROCUREMENT_ADAPTERS.has(procurementSource)) {
        throw new Error('procurement_source must be trusted adapter');
      }
      const poNumber = assertNonEmpty(body.po_number, 'po_number');
      const lineItems = parseObjectArray(body.line_items, 'line_items');
      if (lineItems.length === 0) {
        throw new Error('line_items must include at least one line');
      }
      const impactedWorkPackages = parseStringArray(body.impacted_work_packages);
      impactedWorkPackages.forEach((workPackageId) => {
        assertOptionalScopedIdentifier(workPackageId, tenantId, 'impacted_work_packages');
      });
      return res.status(200).json({
        version: 'v2',
        interface: 'sync-supplier-asn-erp',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          asn_event_id: asnEventId,
          procurement_source: procurementSource,
          po_number: poNumber,
          line_item_count: lineItems.length,
        },
        output: {
          sync_status: 'applied',
          procurement_sync_id: `${tenantId}-${asnEventId}-proc-sync-${Date.now()}`,
          impacted_work_packages: impactedWorkPackages,
        },
      });
    }

    if (req.method === 'POST') {
      return res.status(400).json({
        error: 'Unsupported interface. Use create-work-package, save-work-package-view, transition-work-package, clone-template, assign-maintenance-slot, run-replan-simulation, confirm-replan, reserve-parts, process-shortage-response, sync-supplier-eta, trace-rotable-llp, run-inventory-optimization, or sync-supplier-asn-erp.',
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }

    const selectedSavedViewId = parseSavedViewId(req);
    const selectedSavedView = selectedSavedViewId
      ? SAVED_WORK_PACKAGE_VIEWS.find((item) => item.id === selectedSavedViewId) || null
      : null;
    if (selectedSavedViewId && !selectedSavedView) {
      throw new Error('Bad Request: saved_view is invalid');
    }
    const queryStatusFilter = parseStatusFilter(req);
    const querySearchFilter = parseSearchFilter(req);
    const activeStatusFilter = selectedSavedView?.filters.status || queryStatusFilter;
    const activeSearchFilter = selectedSavedView?.filters.search || querySearchFilter;
    const legacyRows = enforceAmroScopedLegacyRows(buildLegacyRows(tenantId, franchiseId), isolationScope);
    const unfilteredModuleItems = adaptModuleWorkPackagesFromLegacy(legacyRows);
    const moduleItems = applyWorkPackageFilters(unfilteredModuleItems, activeStatusFilter, activeSearchFilter);
    const integrationContracts = buildAmroIntegrationContractEnvelope({
      capability: 'work-packages',
      tenantId,
      franchiseId,
      endpointRollout: rolloutState,
      auditLedgerCutover: cutoverState,
    });
    const dualRun = isDualRunEnabled();
    const unfilteredLegacyItems = adaptLegacyWorkPackages(legacyRows);
    const legacyItems = applyWorkPackageFilters(unfilteredLegacyItems, activeStatusFilter, activeSearchFilter);
    const legacyFallback = isLegacyFallbackEnabled();
    const reconciliation = buildReconciliation(legacyItems, moduleItems);
    const deterministicComparison = buildHistoricalBackfillMetadata({
      capability: 'work-packages',
      correlationId: ctx.correlationId,
      tenantId,
      franchiseId,
      compatMode: compatDecision.compatMode,
      requestedFilters: {
        status: activeStatusFilter,
        search: activeSearchFilter,
        saved_view: selectedSavedView?.id || null,
      },
      reconciliation,
    });
    const dualWrite = await enqueueWorkPackageDualWriteOperations({
      tenantId,
      franchiseId,
      correlationId: ctx.correlationId,
      compatMode: compatDecision.compatMode,
      workPackages: moduleItems,
    });

    if (legacyFallback) {
      const fallback = await drainAmroReconciliationQueueForFallback({
        capability: 'work-packages',
        correlationId: ctx.correlationId,
        tenantId,
        franchiseId,
        compatMode: compatDecision.compatMode,
      });
      const auditRecord = cutoverState.enabled
        ? appendWorkPackageAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          mode: 'legacy-fallback',
          legacyItems,
          moduleItems,
          queueMode: fallback.queueMode,
          snapshotCheckpoint: fallback.snapshotCheckpoint,
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        compatMode: compatDecision.compatMode,
        mode: 'legacy-fallback',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        integrationContracts,
        coexistence: {
          dualRead: {
            deterministicComparisonHash: deterministicComparison.sourceHash,
            replayCheckpoint: deterministicComparison.replayCheckpoint,
            reconciliation,
          },
          dualWrite,
        },
        filters: {
          status: activeStatusFilter,
          search: activeSearchFilter,
          saved_view: selectedSavedView?.id || null,
        },
        savedViews: SAVED_WORK_PACKAGE_VIEWS,
        fallback: {
          legacyMode: true,
          queueDrained: fallback.drained,
          queueMode: fallback.queueMode,
          snapshotCheckpoint: fallback.snapshotCheckpoint,
          snapshotCheckpointRestore: {
            checkpoint: fallback.snapshotCheckpoint,
            restored: true,
          },
        },
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
        data: { workPackages: legacyItems },
        correlationId: ctx.correlationId,
      });
    }

    if (!dualRun) {
      const auditRecord = cutoverState.enabled
        ? appendWorkPackageAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          mode: 'module',
          legacyItems,
          moduleItems,
          queueMode: null,
          snapshotCheckpoint: null,
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        integrationContracts,
        coexistence: {
          dualRead: {
            deterministicComparisonHash: deterministicComparison.sourceHash,
            replayCheckpoint: deterministicComparison.replayCheckpoint,
            reconciliation,
          },
          dualWrite,
        },
        filters: {
          status: activeStatusFilter,
          search: activeSearchFilter,
          saved_view: selectedSavedView?.id || null,
        },
        savedViews: SAVED_WORK_PACKAGE_VIEWS,
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
        data: { workPackages: moduleItems },
        correlationId: ctx.correlationId,
      });
    }

    const queueResult = await enqueueAmroReconciliationSnapshot({
      capability: 'work-packages',
      correlationId: ctx.correlationId,
      tenantId,
      franchiseId,
      compatMode: compatDecision.compatMode,
      requestedFilters: {},
      reconciliation,
    });
    logApiEvent('info', '[AmroWorkPackagesV2] dual-run reconciliation', {
      correlationId: ctx.correlationId,
      tenantId,
      franchiseId,
      compatMode: compatDecision.compatMode,
      reconciliation,
      queue: queueResult,
    });
    const auditRecord = cutoverState.enabled
      ? appendWorkPackageAuditRecord({
        tenantId,
        franchiseId,
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'dual-run',
        legacyItems,
        moduleItems,
        queueMode: queueResult.queueMode,
        snapshotCheckpoint: null,
      })
      : null;

    return res.status(200).json({
      version: 'v2',
      compatMode: compatDecision.compatMode,
      mode: 'dual-run',
      domainAccess: {
        subscriptionStatus: amroAccess.subscriptionStatus,
        source: amroAccess.source,
        validatedAt: amroAccess.validatedAt,
      },
      serviceBoundaries,
      integrationContracts,
      coexistence: {
        dualRead: {
          deterministicComparisonHash: deterministicComparison.sourceHash,
          replayCheckpoint: deterministicComparison.replayCheckpoint,
          reconciliation,
        },
        dualWrite,
      },
      filters: {
        status: activeStatusFilter,
        search: activeSearchFilter,
        saved_view: selectedSavedView?.id || null,
      },
      savedViews: SAVED_WORK_PACKAGE_VIEWS,
      data: { workPackages: moduleItems },
      legacy: { workPackages: legacyItems },
      reconciliation,
      queue: queueResult,
      endpointRollout: rolloutState,
      auditLedgerCutover: cutoverState,
      auditLedger: auditRecord ? {
        eventType: auditRecord.eventType,
        recordId: auditRecord.recordId,
        chainHash: auditRecord.chainHash,
        replayCheckpoint: auditRecord.replayCheckpoint,
      } : null,
      correlationId: ctx.correlationId,
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
