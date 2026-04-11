import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
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
} from '../../../../_utils/http';
import { sendErrorResponse } from '../../../../_utils/errorHandler';
import {
  fetchWorkPackageDetail,
  persistTransitionWorkPackage,
  type WorkPackageStatus,
} from '../../work-package-persistence-db';

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

// Valid state transitions
const VALID_TRANSITIONS: Record<WorkPackageStatus, WorkPackageStatus[]> = {
  planning: ['approved', 'cancelled'],
  approved: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'on_hold', 'cancelled'],
  in_progress: ['on_hold', 'completed'],
  on_hold: ['scheduled', 'cancelled'],
  completed: ['closed'],
  closed: [],
  cancelled: [],
};

const VALID_STATUSES = new Set(Object.keys(VALID_TRANSITIONS)) as Set<WorkPackageStatus>;

function isValidStatus(v: string): v is WorkPackageStatus {
  return VALID_STATUSES.has(v as WorkPackageStatus);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['POST', 'GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);

  try {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
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
    const wpId = String(req.query.id || '').trim();
    if (!wpId) throw new Error('Work order ID is required');

    const body = parseBody(req.body);
    const targetStatus = assertNonEmpty(body.target_status, 'target_status').toLowerCase();

    if (!isValidStatus(targetStatus)) {
      throw new Error(`Invalid target status: ${targetStatus}. Must be one of: ${[...VALID_STATUSES].join(', ')}`);
    }

    // Fetch current status
    const detail = await fetchWorkPackageDetail({ id: wpId, tenantId });
    if (!detail) {
      res.status(404).json({ error: 'Work order not found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    const currentStatus = detail.workPackage.status;
    const allowedTargets = VALID_TRANSITIONS[currentStatus];

    if (!allowedTargets.includes(targetStatus)) {
      throw new Error(
        `Cannot transition from "${currentStatus}" to "${targetStatus}". Allowed: ${allowedTargets.length > 0 ? allowedTargets.join(', ') : 'none (terminal state)'}`
      );
    }

    const complianceNotes = body.compliance_notes ? String(body.compliance_notes).trim() : undefined;

    // Execute transition
    const updated = await persistTransitionWorkPackage({
      id: wpId,
      tenantId,
      userId: authUser.userId,
      targetStatus: targetStatus as WorkPackageStatus,
      complianceNotes,
    });

    res.status(200).json({
      version: 'v2',
      interface: 'transition-work-order',
      correlationId: ctx.correlationId,
      output: {
        id: updated.id,
        work_order_number: updated.work_order_number,
        previous_status: currentStatus,
        new_status: updated.status,
        transitioned_at: updated.updated_at,
        transitioned_by: authUser.userId,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
