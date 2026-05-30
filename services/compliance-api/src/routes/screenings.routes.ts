// Phase 6 compliance-api — screening read routes.
//
// Write paths (start_screening, decide_screening) come in a later slice
// once the provider integrations (Dow Jones, World-Check, MK Denial) are
// wired. For now the gating consumer creates rows directly via the
// service-role client.

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/compliance.types.js';

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
    throw new Error('compliance-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key);
}

router.get(
  '/v1/compliance/screenings',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    const subjectType = String(req.query.subject_type || '').trim() || null;
    const subjectId = String(req.query.subject_id || '').trim() || null;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    try {
      const supabase = getServiceRoleClient();
      let query = (supabase as any)
        .schema('compliance')
        .from('screenings')
        .select('*')
        .eq('tenant_id', authReq.tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (subjectType) query = query.eq('subject_type', subjectType);
      if (subjectId) query = query.eq('subject_id', subjectId);
      const { data, error } = await query;
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      logger.error('compliance.screenings list error', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to list screenings',
        code: 'COMPLIANCE_LIST_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

router.get(
  '/v1/compliance/records/:subjectType/:subjectId',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const { subjectType, subjectId } = req.params;

    try {
      const supabase = getServiceRoleClient();
      const { data, error } = await (supabase as any)
        .schema('compliance')
        .from('records')
        .select('*')
        .eq('tenant_id', authReq.tenantId)
        .eq('subject_type', subjectType)
        .eq('subject_id', subjectId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return res.status(404).json({
          error: 'No compliance record',
          code: 'NOT_FOUND',
          statusCode: 404,
        } as ErrorResponse);
      }
      return res.json(data);
    } catch (err) {
      logger.error('compliance.records lookup error', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to fetch compliance record',
        code: 'COMPLIANCE_FETCH_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

export default router;
