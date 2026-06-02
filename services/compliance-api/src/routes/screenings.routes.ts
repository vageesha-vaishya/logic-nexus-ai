// Phase 6 compliance-api — screening read + officer-flow routes.
//
// Step 2 expansion: adds the views and override RPCs the compliance
// officer UI needs so useComplianceOfficer can stop talking to
// Supabase directly and go through this service. Pattern mirrors
// finance-api / logistics-api / sales-api.

import { Router, Response, Request, NextFunction } from 'express';
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

function serverError(res: Response, code: string, err: unknown): void {
  res.status(500).json({
    error: err instanceof Error ? err.message : String(err),
    code,
    statusCode: 500,
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

// Whitelist of v_blocked_parties.status values the view exposes — any
// other input is silently dropped so a curl-poking caller can't inject
// arbitrary filter values into the underlying query.
const BLOCKED_PARTY_STATUS_VALUES = new Set(['failed', 'overridden', 'expired']);

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

// ─── Step 2 additions ────────────────────────────────────────────────

// GET /v1/compliance/blocked-parties?status=failed|overridden|expired|all
//   Feeds the compliance-officer inbox. Backed by v_blocked_parties view.
router.get(
  '/v1/compliance/blocked-parties',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    const rawStatus = String(req.query.status || 'failed').trim();
    const status = BLOCKED_PARTY_STATUS_VALUES.has(rawStatus) ? rawStatus : null;
    const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 1000);

    try {
      const supabase = getServiceRoleClient();
      let query = (supabase as any)
        .schema('compliance')
        .from('v_blocked_parties')
        .select(
          'screening_id, tenant_id, subject_type, subject_id, party_id, party_display_name, account_id, account_name, lead_id, lead_company_name, lead_email, status, decision, triggered_at, triggered_by_event, provider, hit_count, max_similarity, hits, expires_at',
        )
        .eq('tenant_id', authReq.tenantId)
        .order('triggered_at', { ascending: false })
        .limit(limit);
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      logger.error('compliance.blocked-parties list error', err);
      serverError(res, 'COMPLIANCE_BLOCKED_PARTIES_ERROR', err);
    }
  }),
);

// GET /v1/compliance/screenings/:id — single screening detail
router.get(
  '/v1/compliance/screenings/:id',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const { id } = req.params;

    try {
      const supabase = getServiceRoleClient();
      const { data, error } = await (supabase as any)
        .schema('compliance')
        .from('screenings')
        .select(
          'id, tenant_id, subject_type, subject_id, subject_party_id, search_name, search_country, status, decision, match_score, hits, provider, provider_request_id, triggered_by_event, performed_at, decided_by_user_id, decided_at, decision_notes, evidence_file_ids, expires_at, metadata, notes',
        )
        .eq('id', id)
        .eq('tenant_id', authReq.tenantId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return res.status(404).json({
          error: 'screening not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        } as ErrorResponse);
      }
      return res.json(data);
    } catch (err) {
      logger.error('compliance.screenings detail error', err);
      return serverError(res, 'COMPLIANCE_SCREENING_FETCH_ERROR', err);
    }
  }),
);

// GET /v1/compliance/screenings/:id/decisions — override history for a screening
router.get(
  '/v1/compliance/screenings/:id/decisions',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const { id } = req.params;

    try {
      const supabase = getServiceRoleClient();
      const { data, error } = await (supabase as any)
        .schema('compliance')
        .from('v_screening_decisions')
        .select(
          'audit_decision_id, screening_id, screening_subject_id, screening_subject_type, screening_current_status, override_decision, previous_status, new_status, reason, decided_by_user_id, decided_at, evidence_file_ids, evidence_file_count, metadata',
        )
        .eq('screening_id', id)
        .order('decided_at', { ascending: false });
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      logger.error('compliance.screening decisions error', err);
      serverError(res, 'COMPLIANCE_DECISIONS_ERROR', err);
    }
  }),
);

// POST /v1/compliance/screenings/:id/override
//   Body: { reason: string, evidence_file_ids?: string[] }
//   Wraps the compliance.override_screening RPC.
router.post(
  '/v1/compliance/screenings/:id/override',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const { id } = req.params;
    const body = (req.body ?? {}) as { reason?: unknown; evidence_file_ids?: unknown };
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      return res.status(400).json({
        error: 'reason required',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      } as ErrorResponse);
    }
    const evidenceIds = Array.isArray(body.evidence_file_ids)
      ? (body.evidence_file_ids as unknown[]).filter((v): v is string => typeof v === 'string')
      : null;

    try {
      const supabase = getServiceRoleClient();
      const { data, error } = await (supabase as any)
        .schema('compliance')
        .rpc('override_screening', {
          p_screening_id: id,
          p_user_id: authReq.userId,
          p_reason: reason,
          p_evidence_file_ids: evidenceIds,
        });
      if (error) throw error;
      return res.json({ data });
    } catch (err) {
      logger.error('compliance.override_screening rpc error', err);
      return serverError(res, 'COMPLIANCE_OVERRIDE_ERROR', err);
    }
  }),
);

// POST /v1/compliance/screenings/:id/revoke-override
//   Body: { reason: string }
//   Wraps the compliance.revoke_override RPC.
router.post(
  '/v1/compliance/screenings/:id/revoke-override',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const { id } = req.params;
    const body = (req.body ?? {}) as { reason?: unknown };
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      return res.status(400).json({
        error: 'reason required',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      } as ErrorResponse);
    }

    try {
      const supabase = getServiceRoleClient();
      const { data, error } = await (supabase as any)
        .schema('compliance')
        .rpc('revoke_override', {
          p_screening_id: id,
          p_user_id: authReq.userId,
          p_reason: reason,
        });
      if (error) throw error;
      return res.json({ data });
    } catch (err) {
      logger.error('compliance.revoke_override rpc error', err);
      return serverError(res, 'COMPLIANCE_REVOKE_OVERRIDE_ERROR', err);
    }
  }),
);

export default router;
