// Phase 7 UIM Step 6 — DLQ admin route.
//
// POST /api/v1/uim/dlq/process — run one polling tick on demand.
// Useful for ops + the automatic poller's first-tick exercise; the
// periodic timer (env-gated by UIM_DLQ_POLL_INTERVAL_SEC) drives the
// steady-state flow.

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import { runDlqTick } from '../services/dlq-processor.js';
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
  '/v1/uim/dlq/process',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    // Platform-admin only — manual tick can spend external HTTP quota
    // (signed webhook re-deliveries) and shouldn't be tenant-side
    // self-service. The periodic timer in index.ts skips this gate.
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
      const tick = await runDlqTick({ supabase: sb, limit });
      logger.info('dlq tick (manual)', {
        actorUserId: authReq.userId,
        ...tick,
        errors_count: tick.errors.length,
      });
      return res.json(tick);
    } catch (err) {
      logger.error('dlq tick threw', { error: err instanceof Error ? err.message : String(err) });
      return bad(res, err instanceof Error ? err.message : 'internal', 500, 'INTERNAL');
    }
  }),
);

export default router;
