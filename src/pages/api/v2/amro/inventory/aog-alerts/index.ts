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

function assertNonEmpty(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${fieldName} is required`);
  return normalized;
}

function parsePositiveNumber(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) throw new Error(`${fieldName} must be > 0`);
  return num;
}

type AogSeverity = 'critical' | 'high' | 'medium';
type AogStatus = 'open' | 'escalated' | 'resolved' | 'cancelled';

function isValidSeverity(v: string): v is AogSeverity {
  return ['critical', 'high', 'medium'].includes(v);
}

function isValidStatus(v: string): v is AogStatus {
  return ['open', 'escalated', 'resolved', 'cancelled'].includes(v);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const compatibility = resolveGatewayCompatibility(req, { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId });
  applyCompatibilityResponseHeaders(res, compatibility, ctx.correlationId);

  try {
    if (!isV2Enabled()) {
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
    const supabase = getSupabaseAdminClient();

    // ── GET: list AOG alerts ──────────────────────────────────────────────
    if (req.method === 'GET') {
      const statusFilter = String(req.query.status || '').trim() || null;
      const severityFilter = String(req.query.severity || '').trim() || null;
      const aircraftId = String(req.query.aircraft_id || '').trim() || null;
      const partInventoryId = String(req.query.part_inventory_id || '').trim() || null;
      const limit = Math.min(Number(req.query.limit || 100), 500);

      let query = supabase
        .from('amro_aog_alerts')
        .select(
          '*, parts_inventory(part_number, serial_number, description, warehouse_location, status as inventory_status)'
        )
        .eq('tenant_id', tenantId);

      if (franchiseId) query = query.eq('franchise_id', franchiseId);
      if (statusFilter && isValidStatus(statusFilter)) query = query.eq('status', statusFilter);
      if (severityFilter && isValidSeverity(severityFilter)) query = query.eq('severity', severityFilter);
      if (aircraftId) query = query.eq('aircraft_id', aircraftId);
      if (partInventoryId) query = query.eq('part_inventory_id', partInventoryId);

      query = query.order('created_at', { ascending: false }).limit(limit);

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list AOG alerts: ${error.message}`);

      const items = (data || []).map((r: any) => ({
        id: r.id,
        aircraft_id: r.aircraft_id,
        part_inventory_id: r.part_inventory_id,
        part_number: r.parts_inventory?.part_number || null,
        serial_number: r.parts_inventory?.serial_number || null,
        description: r.parts_inventory?.description || null,
        warehouse_location: r.parts_inventory?.warehouse_location || null,
        severity: r.severity,
        status: r.status,
        shortage_quantity: Number(r.shortage_quantity || 0),
        required_quantity: Number(r.required_quantity || 0),
        required_by: r.required_by,
        escalation_level: r.escalation_level,
        resolved_at: r.resolved_at,
        resolution_notes: r.resolution_notes,
        notified_users: r.notified_users || [],
        metadata: r.metadata || {},
        created_by: r.created_by,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));

      const summary = {
        total: items.length,
        open: items.filter((i) => i.status === 'open').length,
        escalated: items.filter((i) => i.status === 'escalated').length,
        critical: items.filter((i) => i.severity === 'critical').length,
      };

      res.status(200).json({
        version: 'v2',
        interface: 'list-aog-alerts',
        correlationId: ctx.correlationId,
        output: { tenant_id: tenantId, summary, items },
      });
      return;
    }

    // ── POST: create AOG alert ────────────────────────────────────────────
    if (req.method === 'POST') {
      const payload = parseBody(req.body);
      const partInventoryId = assertNonEmpty(payload.part_inventory_id, 'part_inventory_id');
      const severity = isValidSeverity(String(payload.severity || ''))
        ? (payload.severity as AogSeverity)
        : 'critical';
      const requiredQuantity = parsePositiveNumber(payload.required_quantity, 'required_quantity');
      const requiredBy = payload.required_by ? String(payload.required_by).trim() : null;
      const aircraftId = payload.aircraft_id ? String(payload.aircraft_id).trim() : null;
      const notifiedUsers = Array.isArray(payload.notified_users) ? payload.notified_users : [];
      const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};

      // Verify inventory exists and compute shortage
      const { data: inv, error: invErr } = await supabase
        .from('parts_inventory')
        .select('id, part_number, quantity_on_hand, quantity_reserved')
        .eq('id', partInventoryId)
        .eq('tenant_id', tenantId)
        .single();

      if (invErr || !inv) throw new Error(`Inventory record ${partInventoryId} not found`);

      const onHand = Number(inv.quantity_on_hand || 0);
      const reserved = Number(inv.quantity_reserved || 0);
      const available = onHand - reserved;
      const shortageQuantity = Math.max(0, requiredQuantity - available);

      if (shortageQuantity <= 0) {
        throw new Error(`No shortage: required ${requiredQuantity}, available ${available}. No alert needed.`);
      }

      // Auto-escalate critical shortages
      const autoEscalation = severity === 'critical' && shortageQuantity > requiredQuantity * 0.5 ? 1 : 0;

      const { data: alertRow, error: alertErr } = await supabase
        .from('amro_aog_alerts')
        .insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          aircraft_id: aircraftId || null,
          part_inventory_id: partInventoryId,
          severity,
          status: 'open',
          shortage_quantity: shortageQuantity,
          required_quantity: requiredQuantity,
          required_by: requiredBy || null,
          escalation_level: autoEscalation,
          notified_users: notifiedUsers,
          metadata: {
            ...metadata,
            auto_computed: true,
            quantity_on_hand_at_creation: onHand,
            quantity_reserved_at_creation: reserved,
            available_at_creation: available,
          },
          created_by: authUser.userId,
        })
        .select('id')
        .single();

      if (alertErr) throw new Error(`Failed to create AOG alert: ${alertErr.message}`);

      res.status(201).json({
        version: 'v2',
        interface: 'create-aog-alert',
        correlationId: ctx.correlationId,
        output: {
          alert_id: alertRow.id,
          part_number: inv.part_number,
          severity,
          status: 'open',
          shortage_quantity: shortageQuantity,
          required_quantity: requiredQuantity,
          escalation_level: autoEscalation,
          created_at: new Date().toISOString(),
        },
      });
      return;
    }
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
