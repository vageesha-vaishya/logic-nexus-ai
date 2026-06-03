// Phase 7 UIM Step 7.3 — sync conflicts list + resolve endpoints.
//
// GET  /api/v1/uim/sync-conflicts
//      Query: status=open|resolved|all (default 'open'),
//             integrationId?, limit (default 50, max 200), offset.
//      Returns tenant-scoped rows ordered detected_at DESC.
//
// POST /api/v1/uim/sync-conflicts/:id/resolve
//      Body: { resolution: 'accept_local'|'accept_remote'|'merge'|
//                          'manual'|'deferred',
//              notes?: string }
//      Stamps resolved_at + resolved_by + resolution + notes.
//      Idempotent — re-resolving with a different resolution
//      overwrites the prior decision (callers should be audit-
//      tracked at the application layer).

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/uim.types.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_RESOLUTIONS = new Set([
  'accept_local',
  'accept_remote',
  'merge',
  'manual',
  'deferred',
]);

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  } as ErrorResponse);
}

function bad(res: Response, message: string, status = 400, code = 'INVALID_REQUEST'): void {
  res.status(status).json({ error: message, code, statusCode: status } as ErrorResponse);
}

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('uim-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

const SYNC_CONFLICT_SELECT =
  'id, tenant_id, integration_id, subject_table, subject_record_id, conflict_kind, local_payload, remote_payload, diff_summary, detected_at, resolved_at, resolution, resolved_by, resolution_notes, source_event_id, created_at, updated_at';

// ── GET /v1/uim/sync-conflicts ──────────────────────────────────────
router.get(
  '/v1/uim/sync-conflicts',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    const statusFilter = String(req.query.status || 'open').trim().toLowerCase();
    if (!['open', 'resolved', 'all'].includes(statusFilter)) {
      return bad(res, 'status must be open, resolved, or all');
    }
    const integrationId = req.query.integrationId ? String(req.query.integrationId).trim() : null;
    if (integrationId && !UUID_RE.test(integrationId)) {
      return bad(res, 'integrationId must be uuid');
    }
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);
    const offsetRaw = Number(req.query.offset ?? 0);
    const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);

    try {
      const supabase = getServiceRoleClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = (supabase as any)
        .schema('uim')
        .from('sync_conflicts')
        .select(SYNC_CONFLICT_SELECT, { count: 'exact' })
        .eq('tenant_id', authReq.tenantId)
        .order('detected_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (statusFilter === 'open') query = query.is('resolved_at', null);
      if (statusFilter === 'resolved') query = query.not('resolved_at', 'is', null);
      if (integrationId) query = query.eq('integration_id', integrationId);

      const { data, error, count } = await query;
      if (error) throw error;

      return res.json({
        conflicts: data ?? [],
        pagination: { limit, offset, total: Number(count || 0) },
        filter: { status: statusFilter, integrationId },
      });
    } catch (err) {
      logger.error('sync-conflicts list error', { error: String(err) });
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to list sync conflicts',
        code: 'UIM_SYNC_CONFLICTS_LIST_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

// ── POST /v1/uim/sync-conflicts/:id/resolve ─────────────────────────
router.post(
  '/v1/uim/sync-conflicts/:id/resolve',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    const id = String(req.params.id || '').trim();
    if (!UUID_RE.test(id)) return bad(res, 'id must be uuid');

    const body = (req.body && typeof req.body === 'object'
      ? (req.body as Record<string, unknown>)
      : {}) as { resolution?: unknown; notes?: unknown };
    const resolution = String(body.resolution || '').trim();
    if (!ALLOWED_RESOLUTIONS.has(resolution)) {
      return bad(
        res,
        `resolution must be one of: ${[...ALLOWED_RESOLUTIONS].join(', ')}`,
      );
    }
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
    const isDeferred = resolution === 'deferred';

    try {
      const supabase = getServiceRoleClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .schema('uim')
        .from('sync_conflicts')
        .update({
          // 'deferred' explicitly does NOT mark the row resolved —
          // it stamps the resolution + notes but keeps the row in
          // the open list. Useful for "review again later" without
          // losing context.
          resolved_at: isDeferred ? null : new Date().toISOString(),
          resolution,
          resolved_by: authReq.userId,
          resolution_notes: notes,
        })
        .eq('tenant_id', authReq.tenantId)
        .eq('id', id)
        .select(SYNC_CONFLICT_SELECT)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return res.status(404).json({
          error: 'sync conflict not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        } as ErrorResponse);
      }
      logger.info('sync-conflict resolved', {
        id,
        resolution,
        deferred: isDeferred,
        actorUserId: authReq.userId,
      });
      return res.json({ conflict: data });
    } catch (err) {
      logger.error('sync-conflicts resolve error', { id, error: String(err) });
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to resolve sync conflict',
        code: 'UIM_SYNC_CONFLICTS_RESOLVE_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

export default router;
