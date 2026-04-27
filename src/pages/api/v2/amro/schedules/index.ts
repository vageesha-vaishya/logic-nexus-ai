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
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../_utils/compatibility-facade';
import {
  buildAmroServiceBoundaryEnvelope,
  createAmroIsolationScope,
} from '../anti-corruption-adapter';
import { resolveAmroV2EndpointRolloutState } from '../audit-ledger-cutover';
import { enforceAmroSequentialMilestoneForWorkOrderInterface } from '../phase-plan-model';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_SCHEDULES_V2_ENABLED, parseBoolean(process.env.AMRO_WORK_PACKAGES_V2_ENABLED, false));
}

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

function assertNonEmpty(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${fieldName} is required`);
  return normalized;
}

function parseIsoTimestamp(value: unknown, fieldName: string): string {
  const normalized = assertNonEmpty(value, fieldName);
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`${fieldName} must be a valid ISO timestamp`);
  return new Date(parsed).toISOString();
}

function parseScheduleWindow(start: unknown, end: unknown): { slotStart: string; slotEnd: string } {
  const slotStart = parseIsoTimestamp(start, 'slot_start');
  const slotEnd = parseIsoTimestamp(end, 'slot_end');
  if (Date.parse(slotStart) >= Date.parse(slotEnd)) throw new Error('slot_start must be earlier than slot_end');
  return { slotStart, slotEnd };
}

function parseObjectArray(value: unknown, fieldName: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) throw new Error(`${fieldName} must be an array`);
  return value.map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {}));
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function parseNumber(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${fieldName} must be a valid number`);
  return parsed;
}

function buildScheduleUpdateEvent(params: {
  tenantId: string;
  franchiseId: string | null;
  scheduleId: string;
  workOrderId: string;
  eventType: 'schedule.slot.assigned' | 'schedule.update.acknowledged';
  actorId: string;
}) {
  const franchise = params.franchiseId || 'global';
  return {
    event_id: `${params.tenantId}-${franchise}-${Date.now()}`,
    event_type: params.eventType,
    topic: 'amro.schedule.updated.v1',
    schedule_id: params.scheduleId,
    work_order_id: params.workOrderId,
    actor_id: params.actorId,
    published_at: new Date().toISOString(),
  };
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
  if (hasOverlap) throw new Error('No overlap allowed');
}

function assertStationCapacity(assignedTeamCount: number, stationCapacity: number) {
  if (stationCapacity <= 0) throw new Error('station capacity must be positive');
  if (assignedTeamCount > stationCapacity) throw new Error('station capacity check failed');
}

function assertTeamQualifications(assignedTeam: Array<Record<string, unknown>>, stationCode: string) {
  const normalizedStation = stationCode.trim().toLowerCase();
  const unqualified = assignedTeam.some((member) => {
    const qualifications = parseStringArray(member.qualifications).map((value) => value.toLowerCase());
    return !qualifications.includes(normalizedStation);
  });
  if (unqualified) throw new Error('qualification checks required');
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
        error: 'AMRO schedules v2 endpoint is disabled',
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
    const rolloutState = resolveAmroV2EndpointRolloutState({
      tenantId,
      franchiseId,
      capability: 'schedules',
    });
    if (!rolloutState.enabled) {
      return res.status(404).json({
        error: 'AMRO schedules v2 endpoint is not enabled for this rollout cohort',
        endpointRollout: rolloutState,
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }

    const isolationScope = createAmroIsolationScope(tenantId, franchiseId);
    const serviceBoundaries = buildAmroServiceBoundaryEnvelope({
      capability: 'schedules',
      scope: isolationScope,
      subscriptionStatus: amroAccess.subscriptionStatus,
      validatedAt: amroAccess.validatedAt,
    });

    if (req.method === 'GET') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.view']);
      const stationFilter = String(req.query.station || '').trim().toLowerCase();
      const plannedDate = parseIsoTimestamp(req.query.date || new Date().toISOString(), 'date');
      const rows = [
        {
          schedule_id: `${tenantId}-${franchiseId}-schedule-a`,
          work_order_id: `${tenantId}-${franchiseId}-wp-100`,
          station_code: `${tenantId}:station-a`,
          slot_start: new Date(Date.parse(plannedDate) + 60 * 60 * 1000).toISOString(),
          slot_end: new Date(Date.parse(plannedDate) + 3 * 60 * 60 * 1000).toISOString(),
          assigned_team_size: 2,
          capacity: 3,
          status: 'assigned',
        },
        {
          schedule_id: `${tenantId}-${franchiseId}-schedule-b`,
          work_order_id: `${tenantId}-${franchiseId}-wp-101`,
          station_code: `${tenantId}:station-b`,
          slot_start: new Date(Date.parse(plannedDate) + 4 * 60 * 60 * 1000).toISOString(),
          slot_end: new Date(Date.parse(plannedDate) + 6 * 60 * 60 * 1000).toISOString(),
          assigned_team_size: 1,
          capacity: 2,
          status: 'assigned',
        },
      ];
      const data = stationFilter
        ? rows.filter((row) => row.station_code.toLowerCase().endsWith(stationFilter))
        : rows;
      return res.status(200).json({
        version: 'v2',
        interface: 'list-scheduling-board',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        output: {
          schedules: data,
          total: data.length,
          latency_budget_ms: 300,
        },
      });
    }

    const interfaceName = String(req.query.interface || 'assign-maintenance-slot').trim().toLowerCase();
    enforceAmroSequentialMilestoneForWorkOrderInterface(interfaceName);
    if (interfaceName !== 'assign-maintenance-slot' && interfaceName !== 'acknowledge-schedule-update') {
      return res.status(400).json({
        error: 'Unsupported interface. Use assign-maintenance-slot or acknowledge-schedule-update.',
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }

    const body = parseBody(req.body);
    if (interfaceName === 'assign-maintenance-slot') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const workOrderId = assertNonEmpty(body.work_order_id, 'work_order_id');
      const stationCode = assertNonEmpty(body.station_code, 'station_code');
      const window = parseScheduleWindow(body.slot_start, body.slot_end);
      const assignedTeam = parseObjectArray(body.assigned_team, 'assigned_team');
      const existingSlots = parseObjectArray(body.existing_slots || [], 'existing_slots');
      assertNoOverlap(window, existingSlots);
      assertStationCapacity(assignedTeam.length, parseNumber(body.station_capacity || assignedTeam.length, 'station_capacity'));
      assertTeamQualifications(assignedTeam, stationCode);
      const scheduleId = `${tenantId}-${franchiseId}-schedule-${Date.now()}`;
      const publishedEvent = buildScheduleUpdateEvent({
        tenantId,
        franchiseId,
        scheduleId,
        workOrderId,
        eventType: 'schedule.slot.assigned',
        actorId: String(auth.userId || ''),
      });

      return res.status(200).json({
        version: 'v2',
        interface: 'assign-maintenance-slot',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          work_order_id: workOrderId,
          station_code: `${tenantId}:${stationCode}`,
          slot_start: window.slotStart,
          slot_end: window.slotEnd,
          assigned_team: assignedTeam,
        },
        output: {
          schedule_id: scheduleId,
          assignment_status: 'assigned',
          conflict_flags: [],
          published_events: [publishedEvent],
          latency_budget_ms: 500,
        },
      });
    }

    enforceAnyPermission(auth.permissions || [], ['dashboards.view', 'reports.manage']);
    const actorRole = String(ctx.role || '').trim().toLowerCase();
    if (!['technician', 'supervisor', 'planner', 'tenant_admin'].includes(actorRole)) {
      throw new Error('mobile schedule acknowledgment requires operational role');
    }
    const scheduleId = assertNonEmpty(body.schedule_id, 'schedule_id');
    const workOrderId = assertNonEmpty(body.work_order_id, 'work_order_id');
    const acknowledgedAt = parseIsoTimestamp(body.acknowledged_at || new Date().toISOString(), 'acknowledged_at');
    const deviceId = assertNonEmpty(body.device_id, 'device_id');
    const acknowledgmentNote = String(body.note || '').trim();
    const publishedEvent = buildScheduleUpdateEvent({
      tenantId,
      franchiseId,
      scheduleId,
      workOrderId,
      eventType: 'schedule.update.acknowledged',
      actorId: String(auth.userId || ''),
    });

    return res.status(200).json({
      version: 'v2',
      interface: 'acknowledge-schedule-update',
      correlationId: ctx.correlationId,
      compatMode: compatDecision.compatMode,
      domainAccess: {
        subscriptionStatus: amroAccess.subscriptionStatus,
        source: amroAccess.source,
        validatedAt: amroAccess.validatedAt,
      },
      serviceBoundaries,
      input: {
        schedule_id: scheduleId,
        work_order_id: workOrderId,
        acknowledged_at: acknowledgedAt,
        device_id: deviceId,
        note: acknowledgmentNote || null,
      },
      output: {
        status: 'acknowledged',
        acknowledged_by: String(auth.userId || ''),
        role: actorRole,
        published_events: [publishedEvent],
        latency_budget_ms: 300,
      },
    });
  } catch (error) {
    return sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
