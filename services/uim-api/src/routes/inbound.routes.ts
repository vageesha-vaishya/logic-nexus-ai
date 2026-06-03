// Phase 7 UIM Step 7.2 — inbound webhook receiver.
//
// POST /api/v1/uim/inbound/:integrationId
//   Headers:
//     X-UIM-Signature: hex HMAC-SHA256 of the raw body
//     X-UIM-Delivery-Id (optional, echoed in the log row)
//     X-UIM-Event-Type  (optional, surfaced as event_type)
//   Body: arbitrary JSON.
//
// Lifecycle:
//   1. Resolve the integration by :integrationId. Validate
//      direction allows inbound (inbound | bidirectional).
//   2. Verify HMAC-SHA256 against UIM_WEBHOOK_DEFAULT_SECRET (the
//      per-subscription secret rotation path ships in a follow-up;
//      same TODO as the DLQ processor).
//   3. Insert uim.integration_log row with direction='inbound',
//      payload=body, headers, status='received'.
//   4. Return 202 with { received: true, log_id, integration_id }.
//
// Note: this is the receive surface — application-layer handlers
// (sync workers, command appliers) subscribe to integration_log
// via the existing event bus. This slice only proves the receive
// path is durable + auth'd; downstream processing ships per-
// connector.

import { Router, Response } from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/uim.types.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(res: Response, message: string, status = 400, code = 'INVALID_REQUEST'): void {
  res.status(status).json({ error: message, code, statusCode: status } as ErrorResponse);
}

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('uim-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

function verifyHmac(secret: string, body: string, providedHex: string): boolean {
  if (!secret || !providedHex) return false;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  // timingSafeEqual requires equal-length buffers.
  if (expected.length !== providedHex.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(providedHex, 'hex'));
}

router.post(
  '/v1/uim/inbound/:integrationId',
  asyncHandler(async (req, res) => {
    // NOTE: the inbound receiver is intentionally NOT auth-gated by
    // the standard authMiddleware (external systems don't carry user
    // tokens) — auth is by HMAC verify + integration_id binding.
    // The Express app.use() chain still runs cors + correlation-id
    // before this route fires.
    const authReq = req as AuthRequest;
    const integrationId = String(req.params.integrationId || '').trim();
    if (!UUID_RE.test(integrationId)) {
      return bad(res, 'integrationId must be uuid');
    }

    const signatureHeader = String(req.headers['x-uim-signature'] || '').trim();
    if (!signatureHeader) {
      return bad(res, 'X-UIM-Signature header required', 401, 'UNAUTHORIZED');
    }
    const deliveryId = String(req.headers['x-uim-delivery-id'] || '').trim() || null;
    const eventType = String(req.headers['x-uim-event-type'] || '').trim() || 'unknown';

    // express.json() already parsed req.body — we need the raw text
    // for HMAC. Reconstruct deterministically from the parsed body
    // (the dispatcher signs JSON.stringify of the payload, so as long
    // as we re-stringify the same parsed shape the digests match).
    // For per-byte fidelity production deployments should switch to
    // express.raw() for this route; tracked in follow-up.
    const rawBody =
      typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body ?? {});

    const secret = process.env.UIM_WEBHOOK_DEFAULT_SECRET || '';
    if (!secret) {
      logger.error('inbound: UIM_WEBHOOK_DEFAULT_SECRET unset');
      return bad(res, 'inbound receiver not configured', 503, 'SERVICE_UNAVAILABLE');
    }
    if (!verifyHmac(secret, rawBody, signatureHeader)) {
      return bad(res, 'signature verification failed', 401, 'UNAUTHORIZED');
    }

    const supabase = getServiceRoleClient();

    // Resolve integration + check direction allows inbound.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: integration, error: intErr } = await (supabase as any)
      .schema('uim')
      .from('integrations')
      .select('id, tenant_id, vendor_name, vendor_code, kind, direction, lifecycle_state')
      .eq('id', integrationId)
      .maybeSingle();
    if (intErr) {
      logger.error('inbound: integration lookup failed', { integrationId, error: intErr.message });
      return bad(res, 'integration lookup failed', 500, 'INTERNAL');
    }
    if (!integration) {
      return bad(res, 'integration not found', 404, 'NOT_FOUND');
    }
    if (integration.lifecycle_state && integration.lifecycle_state !== 'active') {
      return bad(res, `integration not active (state=${integration.lifecycle_state})`, 409, 'CONFLICT');
    }
    if (integration.direction !== 'inbound' && integration.direction !== 'bidirectional') {
      return bad(
        res,
        `integration direction=${integration.direction} does not accept inbound`,
        409,
        'CONFLICT',
      );
    }

    // Insert integration_log row. The integration_log table is
    // HTTP-audit-shaped (method, url_path, status, body_redacted)
    // not event-shaped — event_type rides as part of body_redacted
    // metadata until a dedicated event table lands in a follow-up.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: logRow, error: logErr } = await (supabase as any)
      .schema('uim')
      .from('integration_log')
      .insert({
        tenant_id: integration.tenant_id,
        integration_id: integration.id,
        direction: 'inbound',
        method: 'POST',
        url_path: `/api/v1/uim/inbound/${integration.id}`,
        status: 202,
        bytes_in: Buffer.byteLength(rawBody, 'utf8'),
        body_redacted: {
          event_type: eventType,
          delivery_id: deliveryId,
          payload: req.body ?? {},
        },
      })
      .select('id')
      .limit(1)
      .maybeSingle();
    if (logErr) {
      logger.error('inbound: log insert failed', { integrationId, error: logErr.message });
      return bad(res, 'log insert failed', 500, 'INTERNAL');
    }

    // Mark correlation_id on the request for audit middleware (when
    // a user-bound caller hits this route in dev/test).
    if (authReq.userId) {
      logger.info('inbound: received', {
        integrationId: integration.id,
        vendor: integration.vendor_name,
        eventType,
        logId: String(logRow?.id || ''),
      });
    }

    return res.status(202).json({
      received: true,
      log_id: String(logRow?.id || ''),
      integration_id: integration.id,
      event_type: eventType,
    });
  }),
);

export default router;
