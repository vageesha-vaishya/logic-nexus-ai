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

type ReplanWorkOrderState = 'planning' | 'scheduled' | 'blocked';

const REPLANNABLE_STATES = new Set<ReplanWorkOrderState>(['planning', 'scheduled', 'blocked']);
const REPLAN_APPROVER_ROLES = new Set(['tenant_admin', 'planner']);

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

function parseObjectArray(value: unknown, fieldName: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) throw new Error(`${fieldName} must be an array`);
  return value.map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {}));
}

function assertActiveConstraintsAndTenantCalendar(
  activeConstraints: Array<Record<string, unknown>>,
  tenantCalendarId: string,
  tenantId: string
) {
  if (activeConstraints.length === 0) throw new Error('simulation must include active constraints');
  if (!tenantCalendarId.startsWith(`${tenantId}:`)) throw new Error('simulation must include tenant-specific calendars');
}

function assertReplannableStates(affectedWorkOrders: Array<Record<string, unknown>>) {
  const invalidPackage = affectedWorkOrders.find((workOrder) => {
    const state = String(workOrder.current_state || '').trim().toLowerCase() as ReplanWorkOrderState;
    return !REPLANNABLE_STATES.has(state);
  });
  if (invalidPackage) throw new Error('all affected packages must be in re-plannable states');
}

function normalizeRecommendationCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 3;
  return Math.min(5, Math.floor(parsed));
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId, version: 'v2' });
    }

    if (!isV2Enabled()) {
      return res.status(404).json({
        error: 'AMRO schedules replan v2 endpoint is disabled',
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
        error: 'AMRO schedules replan v2 endpoint is not enabled for this rollout cohort',
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

    const interfaceName = String(req.query.interface || 'run-replan-simulation').trim().toLowerCase();
    enforceAmroSequentialMilestoneForWorkOrderInterface(interfaceName);
    const body = parseBody(req.body);

    if (interfaceName === 'run-replan-simulation') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const disruptedSlots = parseObjectArray(body.disrupted_slots, 'disrupted_slots');
      if (disruptedSlots.length === 0) throw new Error('disrupted_slots must include at least one slot');
      const planningHorizon = assertNonEmpty(body.planning_horizon, 'planning_horizon');
      const priorityRules = parseBody(body.priority_rules);
      const activeConstraints = parseObjectArray(body.active_constraints, 'active_constraints');
      const tenantCalendarId = assertNonEmpty(body.tenant_calendar_id, 'tenant_calendar_id');
      assertActiveConstraintsAndTenantCalendar(activeConstraints, tenantCalendarId, tenantId);
      const replanOptions = [
        { option_id: `${tenantId}-${franchiseId}-replan-opt-1`, title: 'Shift non-critical packages', impact_score: 0.18 },
        { option_id: `${tenantId}-${franchiseId}-replan-opt-2`, title: 'Split station windows', impact_score: 0.27 },
      ];
      return res.status(200).json({
        version: 'v2',
        interface: 'run-replan-simulation',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
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
          latency_budget_ms: 500,
        },
      });
    }

    if (interfaceName === 'confirm-replan') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const role = String(ctx.role || '').trim().toLowerCase();
      if (!REPLAN_APPROVER_ROLES.has(role)) throw new Error('Approval role required');
      const selectedOptionId = assertNonEmpty(body.selected_option_id, 'selected_option_id');
      const approverId = assertNonEmpty(body.approver_id, 'approver_id');
      const reason = assertNonEmpty(body.reason, 'reason');
      const affectedWorkOrders = parseObjectArray(body.affected_work_orders, 'affected_work_orders');
      assertReplannableStates(affectedWorkOrders);
      return res.status(200).json({
        version: 'v2',
        interface: 'confirm-replan',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
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
          affected_work_orders: affectedWorkOrders.map((workOrder) => ({
            work_order_id: String(workOrder.work_order_id || ''),
            new_state: 'scheduled',
          })),
          latency_budget_ms: 500,
        },
      });
    }

    if (interfaceName === 'generate-schedule-optimization-recommendations') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const scheduleDate = assertNonEmpty(body.schedule_date, 'schedule_date');
      const stationCode = assertNonEmpty(body.station_code, 'station_code');
      const demandPressure = Number(body.demand_pressure || 0.65);
      const disruptionRisk = Number(body.disruption_risk || 0.42);
      const recommendationCount = normalizeRecommendationCount(body.recommendation_count);
      const recommendations = Array.from({ length: recommendationCount }).map((_, index) => {
        const rank = index + 1;
        const confidence = Number(Math.max(0.51, 0.94 - index * 0.08).toFixed(2));
        const expectedDelayReduction = Number((Math.max(0.2, demandPressure - index * 0.08) * 100).toFixed(1));
        return {
          recommendation_id: `${tenantId}-${franchiseId}-schedule-opt-${rank}`,
          title: rank === 1 ? 'Advance critical night-stop slot' : `Rebalance bay utilization strategy ${rank}`,
          station_code: `${tenantId}:${stationCode}`,
          schedule_date: scheduleDate,
          expected_delay_reduction_pct: expectedDelayReduction,
          confidence,
          rationale: disruptionRisk >= 0.5 ? 'Disruption risk weighted with historical constraints' : 'Capacity weighted with station throughput trend',
        };
      });
      return res.status(200).json({
        version: 'v2',
        interface: 'generate-schedule-optimization-recommendations',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          schedule_date: scheduleDate,
          station_code: `${tenantId}:${stationCode}`,
          demand_pressure: demandPressure,
          disruption_risk: disruptionRisk,
        },
        output: {
          recommendations,
          latency_budget_ms: 500,
        },
      });
    }

    return res.status(400).json({
      error: 'Unsupported interface. Use run-replan-simulation, confirm-replan, or generate-schedule-optimization-recommendations.',
      correlationId: ctx.correlationId,
      version: 'v2',
    });
  } catch (error) {
    return sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
