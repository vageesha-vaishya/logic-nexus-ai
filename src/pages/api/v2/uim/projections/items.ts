import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  applyCors,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { resolveUimAccess } from '../_shared';

function parseLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 500);
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
    const access = await resolveUimAccess(req, ctx);
    const limit = parseLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);
    const supabase = getSupabaseAdminClient();

    const projectionSelect = 'id, inventory_item_id, projected_available_quantity, projected_reserved_quantity, projected_consumed_quantity, last_ledger_id, last_ledger_at, replay_version, updated_at';

    let data: Array<Record<string, unknown>> | null = null;
    let count: number | null = null;

    if (access.franchiseId) {
      const franchiseScoped = await supabase
        .from('uim_inventory_projection_snapshots')
        .select(projectionSelect, { count: 'exact' })
        .eq('tenant_id', access.tenantId)
        .eq('franchise_id', access.franchiseId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (franchiseScoped.error) throw new Error(`Failed to query franchise-scoped projection snapshots: ${franchiseScoped.error.message}`);
      data = franchiseScoped.data as Array<Record<string, unknown>> | null;
      count = Number(franchiseScoped.count || 0);
    }

    // Fallback: if franchise scope is empty, return tenant-level snapshots.
    if (!access.franchiseId || (count || 0) === 0) {
      const tenantScoped = await supabase
        .from('uim_inventory_projection_snapshots')
        .select(projectionSelect, { count: 'exact' })
        .eq('tenant_id', access.tenantId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (tenantScoped.error) throw new Error(`Failed to query tenant-scoped projection snapshots: ${tenantScoped.error.message}`);
      data = tenantScoped.data as Array<Record<string, unknown>> | null;
      count = Number(tenantScoped.count || 0);
    }

    res.status(200).json({
      version: 'v2',
      interface: 'uim-projection-items-query',
      correlationId: ctx.correlationId,
      output: {
        pagination: {
          limit,
          offset,
          total: Number(count || 0),
        },
        snapshots: data || [],
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
