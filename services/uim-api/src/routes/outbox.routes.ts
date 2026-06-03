// Phase 7 UIM Step 6 follow-up — outbox dispatcher admin route.
//
// POST /api/v1/uim/outbox/dispatch — run one polling tick on the
// outbound webhook outbox. Mirrors the DLQ admin route pattern:
// platform_admin only (manual ticks spend external HTTP quota),
// returns the tick result envelope so ops can confirm fan-out.
//
// The periodic env-gated timer in index.ts drives the steady-state
// flow.

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import { runOutboxDispatchTick } from '../services/webhook-outbox.js';
import type { ErrorResponse } from '../types/uim.types.js';

const router = Router();

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

router.post(
  '/v1/uim/outbox/dispatch',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    const sb = getServiceRoleClient();
    const { data: roles } = await sb
      .from('user_roles')
      .select('role')
      .eq('user_id', authReq.userId);
    const isPlatformAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'platform_admin');
    if (!isPlatformAdmin) return bad(res, 'platform_admin role required', 403, 'FORBIDDEN');

    const body = (req.body ?? {}) as { limit?: unknown };
    const rawLimit = body.limit;
    const limit = typeof rawLimit === 'number' && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), 200)
      : undefined;

    try {
      const tick = await runOutboxDispatchTick({ supabase: sb, limit });
      logger.info('outbox tick (manual)', {
        actorUserId: authReq.userId,
        ...tick,
        errors_count: tick.errors.length,
      });
      return res.json(tick);
    } catch (err) {
      logger.error('outbox tick threw', { error: err instanceof Error ? err.message : String(err) });
      return bad(res, err instanceof Error ? err.message : 'internal', 500, 'INTERNAL');
    }
  }),
);

export default router;
