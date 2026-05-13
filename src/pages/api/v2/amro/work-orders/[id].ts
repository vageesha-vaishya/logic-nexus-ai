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
  fetchWorkOrderDetail,
  persistUpdateWorkOrder,
  persistDeleteWorkOrder,
  type MaintenanceType,
} from '../work-order-persistence-db';

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

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);

  try {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    if (req.method !== 'GET' && req.method !== 'PATCH' && req.method !== 'DELETE') {
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
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

    // ── GET: single work order with tasks, materials, events ────────────────
    if (req.method === 'GET') {
      const detail = await fetchWorkOrderDetail({ id: wpId, tenantId });
      if (!detail) {
        res.status(404).json({ error: 'Work order not found', version: 'v2', correlationId: ctx.correlationId });
        return;
      }

      const wp = detail.workOrder;

      res.status(200).json({
        version: 'v2',
        interface: 'get-work-order',
        correlationId: ctx.correlationId,
        output: {
          id: wp.id,
          work_order_number: wp.work_order_number || wp.work_order_number,
          title: wp.title,
          aircraft_id: wp.aircraft_id,
          description: wp.description,
          work_type: wp.work_type,
          maintenance_type: wp.maintenance_type,
          priority: wp.priority,
          source: wp.source,
          planned_start_date: wp.planned_start_date,
          planned_end_date: wp.planned_end_date,
          actual_start_date: wp.actual_start_date,
          actual_end_date: wp.actual_end_date,
          estimated_labor_hours: wp.estimated_labor_hours,
          actual_labor_hours: wp.actual_labor_hours,
          estimated_cost: wp.estimated_cost,
          actual_cost: wp.actual_cost,
          status: wp.status,
          assigned_to: wp.assigned_to,
          supervisor_id: wp.supervisor_id,
          reference_documents: wp.reference_documents,
          notes: wp.notes,
          external_reference: wp.external_reference,
          created_at: wp.created_at,
          updated_at: wp.updated_at,
          tasks: detail.tasks.map((t) => ({
            id: t.id,
            task_number: t.task_number,
            title: t.title,
            description: t.description,
            task_category: t.task_category,
            estimated_duration_hours: t.estimated_duration_hours,
            complexity_level: t.complexity_level,
            sequence_order: t.sequence_order,
            status: t.status,
            progress_percentage: t.progress_percentage,
            assigned_to: t.assigned_to,
            qa_verified_by: t.qa_verified_by,
            qa_verified_at: t.qa_verified_at,
            notes: t.notes,
          })),
          materials: detail.materials.map((m) => ({
            id: m.id,
            part_number: m.part_number,
            description: m.description,
            manufacturer: m.manufacturer,
            action: m.action,
            quantity: m.quantity,
            unit_cost: m.unit_cost,
            total_cost: m.total_cost,
            status: m.status,
            supplier_name: m.supplier_name,
            is_critical: m.is_critical,
          })),
          maintenance_events: detail.events.map((e) => ({
            id: e.id,
            event_type: e.event_type,
            event_code: e.event_code,
            title: e.title,
            description: e.description,
            performed_by: e.performed_by,
            approved_by: e.approved_by,
            event_timestamp: e.event_timestamp,
          })),
        },
      });
      return;
    }

    // ── PATCH: update work order ────────────────────────────────────────────
    if (req.method === 'PATCH') {
      const body = parseBody(req.body);

      // Build allowed fields patch
      const patch: Record<string, unknown> = {};
      const allowedFields = [
        'title', 'description', 'work_type', 'maintenance_type', 'priority',
        'planned_start_date', 'planned_end_date', 'estimated_labor_hours',
        'estimated_cost', 'assigned_to', 'supervisor_id', 'notes', 'status',
        'external_reference', 'reference_documents',
      ];
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          patch[field] = body[field];
        }
      }

      if (Object.keys(patch).length === 0) {
        throw new Error('No valid fields to update');
      }

      const updated = await persistUpdateWorkOrder({
        id: wpId,
        tenantId,
        userId: authUser.userId,
        patch,
      });

      res.status(200).json({
        version: 'v2',
        interface: 'update-work-order',
        correlationId: ctx.correlationId,
        output: {
          id: updated.id,
          work_order_number: updated.work_order_number || updated.work_order_number,
          status: updated.status,
          updated_at: updated.updated_at,
        },
      });
      return;
    }

    // ── DELETE: delete work order ───────────────────────────────────────────
    if (req.method === 'DELETE') {
      // Verify exists first
      const detail = await fetchWorkOrderDetail({ id: wpId, tenantId });
      if (!detail) {
        res.status(404).json({ error: 'Work order not found', version: 'v2', correlationId: ctx.correlationId });
        return;
      }

      // Prevent deletion of completed/closed work orders
      if (['completed', 'closed'].includes(detail.workOrder.status)) {
        throw new Error('Cannot delete a completed or closed work order');
      }

      await persistDeleteWorkOrder({ id: wpId, tenantId });

      res.status(200).json({
        version: 'v2',
        interface: 'delete-work-order',
        correlationId: ctx.correlationId,
        output: { id: wpId, deleted: true },
      });
      return;
    }
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
