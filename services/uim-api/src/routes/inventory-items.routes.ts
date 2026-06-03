// Phase 7 UIM Step 4b.1 — inventory items read route.
//
// Carves the read path from src/pages/api/v2/uim/items/query.ts into
// services/uim-api. The legacy route (114 LOC) stays for now since
// it's tested + working; once both surfaces are consumed equally a
// follow-up slice deletes the legacy file.
//
// Source: public.uim_inventory_items — one of the 12 legacy public.uim_*
// tables that the master plan calls to move into the uim.* namespace.
// When that mirror lands, this route's .schema('public').from(...)
// flips to .schema('uim').from(...) — no caller changes.

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/uim.types.js';

const router = Router();

const SELECT_COLUMNS = `
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

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  } as ErrorResponse);
}

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('uim-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

function clampLimit(raw: unknown, fallback = 25, hardMax = 200): number {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), hardMax);
}

function clampOffset(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

router.get(
  '/v1/uim/inventory-items',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    const limit = clampLimit(req.query.limit, 25, 200);
    const offset = clampOffset(req.query.offset);
    const search = String(req.query.search || '').trim();

    try {
      const supabase = getServiceRoleClient();
      let query = supabase
        .from('uim_inventory_items')
        .select(SELECT_COLUMNS, { count: 'exact' })
        .eq('tenant_id', authReq.tenantId)
        .is('deleted_at', null);
      if (authReq.franchiseId) query = query.eq('franchise_id', authReq.franchiseId);
      if (search) {
        // Defense against ilike pattern injection — strip the wildcards
        // before adding our own.
        const safe = search.replace(/[%_]/g, '\\$&');
        query = query.or(
          `serial_number.ilike.%${safe}%,batch_lot_number.ilike.%${safe}%`,
        );
      }
      const { data, error, count } = await query
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;

      return res.json({
        items: data || [],
        pagination: { limit, offset, total: count ?? 0 },
        filters: { search: search || null },
      });
    } catch (err) {
      logger.error('uim.inventory_items list error', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to list inventory items',
        code: 'UIM_INVENTORY_LIST_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

router.get(
  '/v1/uim/inventory-items/:id',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const { id } = req.params;

    try {
      const supabase = getServiceRoleClient();
      const { data, error } = await supabase
        .from('uim_inventory_items')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', authReq.tenantId)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return res.status(404).json({
          error: 'inventory item not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        } as ErrorResponse);
      }
      return res.json(data);
    } catch (err) {
      logger.error('uim.inventory_items detail error', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to fetch inventory item',
        code: 'UIM_INVENTORY_FETCH_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

export default router;
