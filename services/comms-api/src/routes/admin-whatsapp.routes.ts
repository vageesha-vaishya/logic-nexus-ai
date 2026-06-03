// Phase 6 comms-api — admin endpoints for the WhatsApp opt-in roll-out.
//
// Operators don't yet have a dedicated phone-edit UI, so until the
// party-detail phone surface lands they need a bulk mechanism to flip
// core.phone_numbers.whatsapp_capable for a tenant + optional country.
//
//   POST /api/comms/v1/admin/phones/whatsapp-bulk-enable
//     body: { tenant_id: uuid, country_code?: string, dry_run?: boolean }
//     resp: { matched, updated, sample: [{ id, e164, country }] }
//
// Platform-admin-gated via user_roles.role='platform_admin'. Capped at
// 5000 rows per call so a typo doesn't accidentally flip every phone
// in the database; operators chunk larger rollouts.

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/comms.types.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COUNTRY_RE = /^[A-Z]{2}$/;
const BULK_CAP = 5000;

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  } as ErrorResponse);
}

function bad(res: Response, message: string, code = 'INVALID_REQUEST', status = 400): void {
  res.status(status).json({ error: message, code, statusCode: status } as ErrorResponse);
}

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('comms-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key);
}

router.post(
  '/v1/admin/phones/whatsapp-bulk-enable',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    // Platform-admin gate. Per-tenant admins can't flip phones on
    // tenants other than their own; restricting to platform_admin is
    // simpler than per-tenant role-checking and matches the operator
    // workflow (this is a roll-out tool, not a daily-driver action).
    const sb = getServiceRoleClient();
    const { data: roles } = await sb
      .from('user_roles')
      .select('role')
      .eq('user_id', authReq.userId);
    const isPlatformAdmin = (roles ?? [])
      .some((r: { role: string }) => r.role === 'platform_admin');
    if (!isPlatformAdmin) {
      return bad(res, 'platform_admin role required', 'FORBIDDEN', 403);
    }

    const body = (req.body ?? {}) as {
      tenant_id?: unknown;
      country_code?: unknown;
      dry_run?: unknown;
    };
    const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id.trim() : '';
    if (!UUID_RE.test(tenantId)) {
      return bad(res, 'tenant_id (uuid) required');
    }
    const countryCode = typeof body.country_code === 'string'
      ? body.country_code.trim().toUpperCase()
      : undefined;
    if (countryCode && !COUNTRY_RE.test(countryCode)) {
      return bad(res, 'country_code must be ISO 3166-1 alpha-2 (e.g. IN, US)');
    }
    const dryRun = body.dry_run === true;

    try {
      // 1. Find the candidate rows first so we can return matched +
      //    sample even when dry_run=true.
      let q = (sb as any)
        .schema('core')
        .from('phone_numbers')
        .select('id, e164, country')
        .eq('tenant_id', tenantId)
        .eq('whatsapp_capable', false)
        .limit(BULK_CAP);
      if (countryCode) q = q.eq('country', countryCode);
      const { data: candidates, error: selErr } = await q;
      if (selErr) {
        logger.warn('whatsapp-bulk-enable select failed', { error: selErr.message });
        return bad(res, `select failed: ${selErr.message}`, 'INTERNAL', 500);
      }
      const rows = (candidates ?? []) as Array<{ id: string; e164: string; country: string | null }>;
      if (rows.length === 0 || dryRun) {
        return res.json({
          matched: rows.length,
          updated: 0,
          dry_run: dryRun,
          sample: rows.slice(0, 5),
        });
      }

      // 2. Bulk update via UPDATE ... WHERE id IN (ids). Supabase
      //    has no per-statement row cap; the BULK_CAP at select
      //    above is what bounds the blast radius.
      const ids = rows.map((r) => r.id);
      const { error: updErr, count } = await (sb as any)
        .schema('core')
        .from('phone_numbers')
        .update({ whatsapp_capable: true }, { count: 'exact' })
        .in('id', ids);
      if (updErr) {
        logger.warn('whatsapp-bulk-enable update failed', { error: updErr.message });
        return bad(res, `update failed: ${updErr.message}`, 'INTERNAL', 500);
      }

      logger.info('whatsapp-bulk-enable applied', {
        tenantId,
        countryCode: countryCode ?? null,
        matched: rows.length,
        updated: count ?? rows.length,
        actorUserId: authReq.userId,
      });

      return res.json({
        matched: rows.length,
        updated: count ?? rows.length,
        dry_run: false,
        sample: rows.slice(0, 5),
      });
    } catch (err) {
      logger.warn('whatsapp-bulk-enable threw', {
        error: err instanceof Error ? err.message : String(err),
      });
      return bad(
        res,
        err instanceof Error ? err.message : 'internal error',
        'INTERNAL',
        500,
      );
    }
  }),
);

export default router;
