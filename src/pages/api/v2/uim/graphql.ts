import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';
import { resolveUimAccess } from './_shared';
import { UIM_GRAPHQL_SUBGRAPH_PATH } from './integration-contracts';

type GraphqlRequest = {
  query: string;
  variables?: Record<string, unknown>;
};

function parseRequest(body: unknown): GraphqlRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('GraphQL request body is required');
  }
  const payload = body as Record<string, unknown>;
  const query = String(payload.query || '').trim();
  if (!query) throw new Error('query is required');
  const variables = payload.variables && typeof payload.variables === 'object'
    ? (payload.variables as Record<string, unknown>)
    : {};
  return { query, variables };
}

function detectOperation(query: string): 'uimHealth' | 'uimProjectionItems' | 'uimInventoryItem' {
  if (query.includes('uimProjectionItems')) return 'uimProjectionItems';
  if (query.includes('uimInventoryItem')) return 'uimInventoryItem';
  if (query.includes('uimHealth')) return 'uimHealth';
  throw new Error('Unsupported query. Supported fields: uimHealth, uimProjectionItems, uimInventoryItem');
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
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
    const supabase = getSupabaseAdminClient();
    const request = parseRequest(req.body);
    const operation = detectOperation(request.query);

    if (operation === 'uimHealth') {
      res.status(200).json({
        data: {
          uimHealth: {
            status: 'ok',
            apiVersion: 'v2',
            schemaPath: UIM_GRAPHQL_SUBGRAPH_PATH,
          },
        },
      });
      return;
    }

    if (operation === 'uimProjectionItems') {
      const limit = Math.min(Math.max(Number(request.variables?.limit || 50), 1), 500);
      const offset = Math.max(Number(request.variables?.offset || 0), 0);
      let query = supabase
        .from('uim_inventory_projection_snapshots')
        .select('inventory_item_id, projected_available_quantity, projected_reserved_quantity, projected_consumed_quantity, replay_version, updated_at')
        .eq('tenant_id', access.tenantId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (access.franchiseId) query = query.eq('franchise_id', access.franchiseId);
      const { data, error } = await query;
      if (error) throw new Error(`Failed to query projection snapshots: ${error.message}`);
      res.status(200).json({
        data: {
          uimProjectionItems: data || [],
        },
      });
      return;
    }

    const itemId = String(request.variables?.id || '').trim();
    if (!itemId) throw new Error('variables.id is required for uimInventoryItem');
    let itemQuery = supabase
      .from('uim_inventory_items')
      .select('id, catalog_item_id, quantity, status, location_id, updated_at')
      .eq('tenant_id', access.tenantId)
      .eq('id', itemId)
      .is('deleted_at', null)
      .limit(1);
    if (access.franchiseId) itemQuery = itemQuery.eq('franchise_id', access.franchiseId);
    const { data, error } = await itemQuery.maybeSingle();
    if (error) throw new Error(`Failed to query inventory item: ${error.message}`);
    res.status(200).json({
      data: {
        uimInventoryItem: data || null,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
