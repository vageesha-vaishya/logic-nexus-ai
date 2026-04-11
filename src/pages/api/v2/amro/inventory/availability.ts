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
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../_utils/compatibility-facade';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_INVENTORY_V2_ENABLED, true);
}

function parsePartNumbers(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const compatibility = resolveGatewayCompatibility(req, { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId });
  applyCompatibilityResponseHeaders(res, compatibility, ctx.correlationId);

  try {
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
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
    const stationCode = String(req.query.station_code || req.query.station || '').trim() || null;
    const requestedPartNumbers = parsePartNumbers(req.query.part_numbers || req.query.part_number);

    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('parts_inventory')
      .select(
        'id, part_number, serial_number, description, quantity_on_hand, quantity_available, quantity_reserved, warehouse_location, status, criticality, reorder_level, item_type, ata_chapter, supplier_name'
      )
      .eq('tenant_id', tenantId);

    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }

    if (requestedPartNumbers.length > 0) {
      query = query.in('part_number', requestedPartNumbers);
    }

    if (stationCode) {
      query = query.ilike('warehouse_location', `%${stationCode}%`);
    }

    query = query.order('part_number', { ascending: true });

    const { data: rows, error: dbError } = await query;
    if (dbError) {
      throw new Error(`Failed to query inventory availability: ${dbError.message}`);
    }

    const checkedAt = new Date().toISOString();

    const items = (rows || []).map((row) => {
      const onHand = Number(row.quantity_on_hand || 0);
      const reserved = Number(row.quantity_reserved || 0);
      const available = row.quantity_available != null
        ? Number(row.quantity_available)
        : Math.max(0, onHand - reserved);
      const reorderLevel = Number(row.reorder_level || 0);

      let availabilityStatus: string;
      if (available <= 0) {
        availabilityStatus = 'out_of_stock';
      } else if (available <= reorderLevel) {
        availabilityStatus = 'limited';
      } else {
        availabilityStatus = 'available';
      }

      return {
        part_number: String(row.part_number || ''),
        serial_number: row.serial_number || null,
        description: row.description || null,
        available_qty: available,
        quantity_on_hand: onHand,
        reserved_qty: reserved,
        warehouse_location: row.warehouse_location || null,
        status: availabilityStatus,
        inventory_status: row.status || null,
        criticality: row.criticality || null,
        item_type: row.item_type || null,
        ata_chapter: row.ata_chapter || null,
        supplier_name: row.supplier_name || null,
        reorder_level: reorderLevel,
      };
    });

    const summary = {
      total_items: items.length,
      available_items: items.filter((i) => i.status === 'available').length,
      limited_items: items.filter((i) => i.status === 'limited').length,
      out_of_stock_items: items.filter((i) => i.status === 'out_of_stock').length,
    };

    res.status(200).json({
      version: 'v2',
      interface: 'inventory-availability',
      correlationId: ctx.correlationId,
      output: {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        station_code: stationCode,
        part_numbers_requested: requestedPartNumbers.length > 0 ? requestedPartNumbers : null,
        checked_at: checkedAt,
        summary,
        items,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
