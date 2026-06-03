// Phase 7 UIM — integrations read routes.
//
// Sources from uim.integrations (the Step 1 mirror, dual-written from
// platform.integrations via the Step 2 triggers). Once Step 5 carves
// the writer code out of src/pages/api/v2/uim/integrations into this
// service, the write paths land here too.

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/uim.types.js';

const router = Router();

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
  if (!url || !key) {
    throw new Error('uim-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key);
}

router.get(
  '/v1/uim/integrations',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    const kind = String(req.query.kind || '').trim() || null;
    const lifecycleState = String(req.query.lifecycle_state || '').trim() || null;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    try {
      const supabase = getServiceRoleClient();
      let query = (supabase as any)
        .schema('uim')
        .from('integrations')
        .select('id, kind, name, vendor, scope_json, vendor_risk_class, owner_user_id, lifecycle_state, metadata, created_at, updated_at')
        .eq('tenant_id', authReq.tenantId)
        .order('updated_at', { ascending: false })
        .limit(limit);
      if (kind) query = query.eq('kind', kind);
      if (lifecycleState) query = query.eq('lifecycle_state', lifecycleState);
      const { data, error } = await query;
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      logger.error('uim.integrations list error', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to list integrations',
        code: 'UIM_LIST_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

router.get(
  '/v1/uim/integrations/:id',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const { id } = req.params;

    try {
      const supabase = getServiceRoleClient();
      const { data, error } = await (supabase as any)
        .schema('uim')
        .from('integrations')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', authReq.tenantId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return res.status(404).json({
          error: 'integration not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        } as ErrorResponse);
      }
      return res.json(data);
    } catch (err) {
      logger.error('uim.integrations detail error', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to fetch integration',
        code: 'UIM_FETCH_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

export default router;
