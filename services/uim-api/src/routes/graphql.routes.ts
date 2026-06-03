// Phase 7 UIM Step 4b.10 — GraphQL subgraph route.
//
// Carves src/pages/api/v2/uim/graphql.ts (115 LOC) into uim-api.
// Minimal hand-rolled GraphQL dispatcher — supports the 3 fields
// documented in the integration-contracts registry:
//   uimHealth                    → status + apiVersion + schemaPath
//   uimProjectionItems(limit,    → uim_inventory_projection_snapshots
//                       offset)    rows for the caller's tenant
//   uimInventoryItem(id)         → single uim_inventory_items row
//
// This is NOT a full GraphQL parser — it's a substring-match
// dispatcher matching the legacy behavior exactly. Swapping to a
// real schema (graphql-js or apollo subgraph) happens in Phase 7
// Step 8 ("Resolve GraphQL subgraph per uim.md §9.2"); this slice
// preserves the surface so the contract path stays callable while
// the route migrates off /api/v2/uim/.

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/uim.types.js';

const router = Router();

const UIM_GRAPHQL_SUBGRAPH_PATH = '/api/v1/uim/contracts/uim-subgraph.graphql';

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  } as ErrorResponse);
}

function bad(res: Response, message: string): void {
  res.status(400).json({
    errors: [{ message }],
  });
}

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('uim-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

type GraphqlRequest = {
  query: string;
  variables: Record<string, unknown>;
};

function parseRequest(body: unknown): GraphqlRequest | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'GraphQL request body is required' };
  }
  const payload = body as Record<string, unknown>;
  const query = String(payload.query || '').trim();
  if (!query) return { error: 'query is required' };
  const variables = payload.variables && typeof payload.variables === 'object'
    ? (payload.variables as Record<string, unknown>)
    : {};
  return { query, variables };
}

function detectOperation(query: string): 'uimHealth' | 'uimProjectionItems' | 'uimInventoryItem' | null {
  if (query.includes('uimProjectionItems')) return 'uimProjectionItems';
  if (query.includes('uimInventoryItem')) return 'uimInventoryItem';
  if (query.includes('uimHealth')) return 'uimHealth';
  return null;
}

router.post(
  '/v1/uim/graphql',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    const parsed = parseRequest(req.body);
    if ('error' in parsed) return bad(res, parsed.error);
    const operation = detectOperation(parsed.query);
    if (!operation) {
      return bad(res, 'Unsupported query. Supported fields: uimHealth, uimProjectionItems, uimInventoryItem');
    }

    try {
      const supabase = getServiceRoleClient();

      if (operation === 'uimHealth') {
        return res.status(200).json({
          data: {
            uimHealth: {
              status: 'ok',
              apiVersion: 'v1',
              schemaPath: UIM_GRAPHQL_SUBGRAPH_PATH,
            },
          },
        });
      }

      if (operation === 'uimProjectionItems') {
        const limitRaw = Number(parsed.variables.limit || 50);
        const offsetRaw = Number(parsed.variables.offset || 0);
        const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 500);
        const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);

        let query = supabase
          .from('uim_inventory_projection_snapshots')
          .select(
            'inventory_item_id, projected_available_quantity, projected_reserved_quantity, projected_consumed_quantity, replay_version, updated_at',
          )
          .eq('tenant_id', authReq.tenantId)
          .order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (authReq.franchiseId) query = query.eq('franchise_id', authReq.franchiseId);
        const { data, error } = await query;
        if (error) throw new Error(`Failed to query projection snapshots: ${error.message}`);

        return res.status(200).json({
          data: {
            uimProjectionItems: data || [],
          },
        });
      }

      // uimInventoryItem
      const itemId = String(parsed.variables.id || '').trim();
      if (!itemId) return bad(res, 'variables.id is required for uimInventoryItem');

      let itemQuery = supabase
        .from('uim_inventory_items')
        .select('id, catalog_item_id, quantity, status, location_id, updated_at')
        .eq('tenant_id', authReq.tenantId)
        .eq('id', itemId)
        .is('deleted_at', null)
        .limit(1);
      if (authReq.franchiseId) itemQuery = itemQuery.eq('franchise_id', authReq.franchiseId);
      const { data, error } = await itemQuery.maybeSingle();
      if (error) throw new Error(`Failed to query inventory item: ${error.message}`);

      return res.status(200).json({
        data: {
          uimInventoryItem: data || null,
        },
      });
    } catch (err) {
      logger.error('uim.graphql error', { operation, error: String(err) });
      return res.status(500).json({
        errors: [{ message: err instanceof Error ? err.message : 'GraphQL execution failed' }],
      });
    }
  }),
);

export default router;
