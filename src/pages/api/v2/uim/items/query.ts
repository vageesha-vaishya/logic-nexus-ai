import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';

function parseLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 25;
  return Math.min(parsed, 200);
}

function parseOffset(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);

  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const authUser = await authenticateRequest(req);
    ctx.userId = authUser.userId;
    ctx.role = authUser.role;
    enforceAnyPermission(authUser.permissions, ['dashboards.view']);
    const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
    const tenantId = String(scopedAccess.tenantId || '');
    const franchiseId = String(scopedAccess.franchiseId || '');
    if (!tenantId) throw new Error('Tenant context is required');

    const limit = parseLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);
    const search = String(req.query.search || '').trim();
    const supabase = getSupabaseAdminClient();

    const selectColumns = `
      id,
      tenant_id,
      franchise_id,
      catalog_item_id,
      serial_number,
      batch_lot_number,
      quantity,
      status,
      location_type,
      location_id,
      created_at,
      updated_at
    `;

    let query = supabase
      .from('uim_inventory_items')
      .select(selectColumns, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }
    if (search) {
      query = query.or(`serial_number.ilike.%${search}%,batch_lot_number.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to query UIM inventory items: ${error.message}`);
    }

    res.status(200).json({
      version: 'v2',
      interface: 'uim-items-query',
      correlationId: ctx.correlationId,
      output: {
        tenant_id: tenantId,
        filters: { search, limit, offset },
        pagination: {
          limit,
          offset,
          total: count ?? 0,
        },
        items: data || [],
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
