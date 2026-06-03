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

// GET /api/v1/admin/phones?tenant_id=&capable=&country_code=&limit=&offset=
//   Lists phones with linked party display_name. Platform-admin only.
router.get(
  '/v1/admin/phones',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

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

    const tenantId = String(req.query.tenant_id || '').trim();
    if (!UUID_RE.test(tenantId)) return bad(res, 'tenant_id (uuid) required');
    const countryCode = typeof req.query.country_code === 'string'
      ? req.query.country_code.trim().toUpperCase()
      : undefined;
    if (countryCode && !COUNTRY_RE.test(countryCode)) {
      return bad(res, 'country_code must be ISO 3166-1 alpha-2');
    }
    const capableRaw = String(req.query.capable || '').toLowerCase();
    const capable = capableRaw === 'true' ? true : capableRaw === 'false' ? false : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    try {
      let q = (sb as any)
        .schema('core')
        .from('phone_numbers')
        .select('id, e164, country, whatsapp_capable, verified_at, updated_at', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (countryCode) q = q.eq('country', countryCode);
      if (capable !== undefined) q = q.eq('whatsapp_capable', capable);
      const { data: phones, error: phErr, count } = await q;
      if (phErr) {
        logger.warn('admin/phones list failed', { error: phErr.message });
        return bad(res, `list failed: ${phErr.message}`, 'INTERNAL', 500);
      }

      // Fetch linked party display_name in one round-trip via the
      // phone_links join. Skip when no rows.
      const rows = (phones ?? []) as Array<{
        id: string;
        e164: string;
        country: string | null;
        whatsapp_capable: boolean;
        verified_at: string | null;
        updated_at: string;
      }>;
      const phoneIds = rows.map((r) => r.id);
      let linkMap = new Map<string, { partyId: string; displayName: string | null }>();
      if (phoneIds.length > 0) {
        const { data: links } = await (sb as any)
          .schema('core')
          .from('phone_links')
          .select('phone_id, subject_id')
          .eq('subject_type', 'core.party')
          .in('phone_id', phoneIds);
        const partyIds = Array.from(new Set(
          ((links ?? []) as Array<{ subject_id: string }>).map((l) => l.subject_id),
        ));
        if (partyIds.length > 0) {
          const { data: parties } = await (sb as any)
            .schema('core')
            .from('parties')
            .select('id, display_name')
            .in('id', partyIds);
          const partyMap = new Map<string, string | null>(
            ((parties ?? []) as Array<{ id: string; display_name: string | null }>)
              .map((p) => [p.id, p.display_name]),
          );
          linkMap = new Map(
            ((links ?? []) as Array<{ phone_id: string; subject_id: string }>)
              .map((l) => [l.phone_id, { partyId: l.subject_id, displayName: partyMap.get(l.subject_id) ?? null }]),
          );
        }
      }

      return res.json({
        items: rows.map((r) => ({
          id: r.id,
          e164: r.e164,
          country: r.country,
          whatsapp_capable: r.whatsapp_capable,
          verified_at: r.verified_at,
          updated_at: r.updated_at,
          party_id: linkMap.get(r.id)?.partyId ?? null,
          party_display_name: linkMap.get(r.id)?.displayName ?? null,
        })),
        total: count ?? rows.length,
        limit,
        offset,
      });
    } catch (err) {
      logger.warn('admin/phones list threw', {
        error: err instanceof Error ? err.message : String(err),
      });
      return bad(res, err instanceof Error ? err.message : 'internal error', 'INTERNAL', 500);
    }
  }),
);

// PATCH /api/v1/admin/phones/:id { whatsapp_capable: boolean }
router.patch(
  '/v1/admin/phones/:id',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

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

    const id = String(req.params.id || '').trim();
    if (!UUID_RE.test(id)) return bad(res, 'id (uuid) required in path');
    const body = (req.body ?? {}) as { whatsapp_capable?: unknown };
    if (typeof body.whatsapp_capable !== 'boolean') {
      return bad(res, 'whatsapp_capable (boolean) required in body');
    }

    try {
      const { data, error } = await (sb as any)
        .schema('core')
        .from('phone_numbers')
        .update({ whatsapp_capable: body.whatsapp_capable })
        .eq('id', id)
        .select('id, e164, whatsapp_capable')
        .maybeSingle();
      if (error) {
        logger.warn('admin/phones patch failed', { id, error: error.message });
        return bad(res, `update failed: ${error.message}`, 'INTERNAL', 500);
      }
      if (!data) {
        return bad(res, 'phone not found', 'NOT_FOUND', 404);
      }
      logger.info('admin/phones patched', {
        id,
        whatsapp_capable: body.whatsapp_capable,
        actorUserId: authReq.userId,
      });
      return res.json({ data });
    } catch (err) {
      logger.warn('admin/phones patch threw', {
        error: err instanceof Error ? err.message : String(err),
      });
      return bad(res, err instanceof Error ? err.message : 'internal error', 'INTERNAL', 500);
    }
  }),
);

export default router;
