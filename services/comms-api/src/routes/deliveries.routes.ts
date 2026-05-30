// Phase 6 comms-api — delivery read routes.
//
// Write paths (provider invocation, status transitions) are owned by the
// dispatcher + the Resend webhook receiver (next slice). These routes
// just expose tenant-scoped read access for the comms inbox UI.

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/comms.types.js';

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
    throw new Error('comms-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key);
}

router.get(
  '/v1/comms/deliveries',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    const channelKind = String(req.query.channel_kind || '').trim() || null;
    const status = String(req.query.status || '').trim() || null;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    try {
      const supabase = getServiceRoleClient();
      let query = (supabase as any)
        .schema('comms')
        .from('deliveries')
        .select('*')
        .eq('tenant_id', authReq.tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (channelKind) query = query.eq('channel_kind', channelKind);
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      logger.error('comms.deliveries list error', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to list deliveries',
        code: 'COMMS_LIST_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

router.get(
  '/v1/comms/notifications/:id/deliveries',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const { id } = req.params;

    try {
      const supabase = getServiceRoleClient();
      const { data, error } = await (supabase as any)
        .schema('comms')
        .from('deliveries')
        .select('*')
        .eq('tenant_id', authReq.tenantId)
        .eq('notification_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      logger.error('comms.deliveries by-notification error', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to fetch deliveries',
        code: 'COMMS_FETCH_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

export default router;
