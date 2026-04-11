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
import { getSupabaseAdminClient } from '../../../../_utils/supabaseAdmin';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../../_utils/compatibility-facade';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_INVENTORY_V2_ENABLED, true);
}

function parseBody(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

type AogStatus = 'open' | 'escalated' | 'resolved' | 'cancelled';

function isValidStatus(v: string): v is AogStatus {
  return ['open', 'escalated', 'resolved', 'cancelled'].includes(v);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const compatibility = resolveGatewayCompatibility(req, { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId });
  applyCompatibilityResponseHeaders(res, compatibility, ctx.correlationId);

  try {
    if (!isV2Enabled()) {
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
    const alertId = String(req.query.id || '').trim();
    if (!alertId) throw new Error('Alert ID is required');

    const supabase = getSupabaseAdminClient();

    // ── GET: single alert ─────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('amro_aog_alerts')
        .select('*, parts_inventory(part_number, serial_number, description, warehouse_location)')
        .eq('id', alertId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !data) throw new Error(`AOG alert ${alertId} not found`);

      const item = {
        id: data.id,
        aircraft_id: data.aircraft_id,
        part_inventory_id: data.part_inventory_id,
        part_number: data.parts_inventory?.part_number || null,
        serial_number: data.parts_inventory?.serial_number || null,
        description: data.parts_inventory?.description || null,
        warehouse_location: data.parts_inventory?.warehouse_location || null,
        severity: data.severity,
        status: data.status,
        shortage_quantity: Number(data.shortage_quantity || 0),
        required_quantity: Number(data.required_quantity || 0),
        required_by: data.required_by,
        escalation_level: data.escalation_level,
        resolved_at: data.resolved_at,
        resolution_notes: data.resolution_notes,
        notified_users: data.notified_users || [],
        metadata: data.metadata || {},
        created_by: data.created_by,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      res.status(200).json({
        version: 'v2',
        interface: 'get-aog-alert',
        correlationId: ctx.correlationId,
        output: { tenant_id: tenantId, item },
      });
      return;
    }

    // ── PATCH: update status (escalate, resolve, cancel) ──────────────────
    if (req.method === 'PATCH') {
      const payload = parseBody(req.body);

      // Fetch current alert
      const { data: current, error: fetchErr } = await supabase
        .from('amro_aog_alerts')
        .select('id, status, escalation_level, metadata')
        .eq('id', alertId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchErr || !current) throw new Error(`AOG alert ${alertId} not found`);

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

      // Status change
      if (payload.status) {
        const newStatus = String(payload.status).trim().toLowerCase();
        if (!isValidStatus(newStatus)) throw new Error(`Invalid status: ${payload.status}. Must be one of: open, escalated, resolved, cancelled`);

        if (newStatus === 'resolved' && current.status !== 'resolved') {
          updates.status = 'resolved';
          updates.resolved_at = new Date().toISOString();
          updates.resolution_notes = payload.resolution_notes
            ? String(payload.resolution_notes).trim()
            : current.metadata?.resolution_notes || null;
        } else if (newStatus === 'escalated' && current.status === 'open') {
          updates.status = 'escalated';
          updates.escalation_level = (current.escalation_level || 0) + 1;
        } else if (newStatus === 'cancelled') {
          updates.status = 'cancelled';
        } else if (newStatus === 'open') {
          updates.status = 'open';
        } else {
          throw new Error(`Invalid status transition from "${current.status}" to "${newStatus}"`);
        }
      }

      // Resolution notes without status change
      if (payload.resolution_notes && !payload.status) {
        updates.resolution_notes = String(payload.resolution_notes).trim();
      }

      // Add notified users
      if (Array.isArray(payload.notified_users) && payload.notified_users.length > 0) {
        const existingUsers = Array.isArray(current.metadata?.notified_users) ? current.metadata.notified_users : [];
        updates.notified_users = [...new Set([...existingUsers, ...payload.notified_users])];
      }

      // Update metadata
      if (payload.metadata && typeof payload.metadata === 'object') {
        updates.metadata = { ...(current.metadata || {}), ...(payload.metadata as Record<string, unknown>) };
      }

      const { data: updatedRow, error: updateErr } = await supabase
        .from('amro_aog_alerts')
        .update(updates)
        .eq('id', alertId)
        .select('id, status, escalation_level, resolved_at, resolution_notes')
        .single();

      if (updateErr) throw new Error(`Failed to update AOG alert: ${updateErr.message}`);

      res.status(200).json({
        version: 'v2',
        interface: 'update-aog-alert',
        correlationId: ctx.correlationId,
        output: {
          alert_id: updatedRow.id,
          status: updatedRow.status,
          escalation_level: updatedRow.escalation_level,
          resolved_at: updatedRow.resolved_at,
          resolution_notes: updatedRow.resolution_notes,
          updated_at: new Date().toISOString(),
        },
      });
      return;
    }

    // ── DELETE: remove alert ──────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { error: deleteErr } = await supabase
        .from('amro_aog_alerts')
        .delete()
        .eq('id', alertId)
        .eq('tenant_id', tenantId);

      if (deleteErr) throw new Error(`Failed to delete AOG alert: ${deleteErr.message}`);

      res.status(200).json({
        version: 'v2',
        interface: 'delete-aog-alert',
        correlationId: ctx.correlationId,
        output: { alert_id: alertId, deleted: true },
      });
      return;
    }
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
