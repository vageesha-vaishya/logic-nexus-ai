// Phase 7 UIM Step 4b.5 — webhooks subscription route.
//
// Carves src/pages/api/v2/uim/webhooks.ts (156 LOC) into uim-api,
// but switches the architecture from the legacy in-memory Map-based
// queue (modules/uim/integration/webhookDeliveryQueue.ts) to the
// DB-backed model the Phase 7 mirror tables already support:
//   uim.webhook_subscriptions — adapter registry
//   uim.integration_dlq        — failed delivery queue (via Step 6
//                                processor + uim.v_dlq_retryable view)
//
// The legacy in-memory queue can't survive across process restarts +
// doesn't scale to multi-instance deployments. The DB-backed model
// pairs with the runDlqTick() retry processor from Step 6 so failed
// webhook deliveries are durable and retryable.

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/uim.types.js';
import { enqueueWebhookEvent, runOutboxDispatchTick } from '../services/webhook-outbox.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_STATUS = new Set(['active', 'paused', 'failed']);

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

// ── GET /v1/uim/webhooks ────────────────────────────────────────────
// Returns the tenant's webhook subscriptions + the DLQ-retryable
// snapshot. Operator UI uses this to render the adapter list + a
// "stuck deliveries" panel.
router.get(
  '/v1/uim/webhooks',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    try {
      const supabase = getServiceRoleClient();
      // Tenant-scoped subscriptions
      const [subsRes, dlqRes] = await Promise.all([
        (supabase as any)
          .schema('uim')
          .from('webhook_subscriptions')
          .select('id, integration_id, target_url, event_filter, signing_secret_id, retry_policy, status, last_delivery_ts')
          .eq('tenant_id', authReq.tenantId)
          .order('status', { ascending: true }),
        (supabase as any)
          .schema('uim')
          .from('v_dlq_retryable')
          .select('id, subscription_id, target_url, attempts, max_attempts, last_failed_at, ready_at')
          .eq('tenant_id', authReq.tenantId)
          .limit(50),
      ]);
      if (subsRes.error) throw subsRes.error;
      if (dlqRes.error) throw dlqRes.error;
      return res.json({
        subscriptions: subsRes.data ?? [],
        dlq_retryable: dlqRes.data ?? [],
      });
    } catch (err) {
      logger.error('uim.webhooks list error', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to list webhooks',
        code: 'UIM_WEBHOOKS_LIST_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

// ── POST /v1/uim/webhooks ───────────────────────────────────────────
// Body: { action: 'register' | 'deactivate' | 'dispatch-event', ... }
router.post(
  '/v1/uim/webhooks',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = String(body.action || '').trim().toLowerCase();

    try {
      const supabase = getServiceRoleClient();

      if (action === 'register' || action === 'register-adapter') {
        const targetUrl = typeof body.target_url === 'string' ? body.target_url.trim() : '';
        if (!targetUrl) return bad(res, 'target_url required');
        if (!/^https:\/\//.test(targetUrl)) {
          return bad(res, 'target_url must be https');
        }
        const integrationId = typeof body.integration_id === 'string' ? body.integration_id.trim() : null;
        if (integrationId && !UUID_RE.test(integrationId)) {
          return bad(res, 'integration_id must be uuid');
        }
        const subscribedEvents = Array.isArray(body.subscribed_events)
          ? (body.subscribed_events as unknown[]).filter((v): v is string => typeof v === 'string')
          : [];

        const { data, error } = await (supabase as any)
          .schema('platform')
          .from('webhook_subscriptions')
          .insert({
            tenant_id: authReq.tenantId,
            integration_id: integrationId,
            target_url: targetUrl,
            event_filter: { events: subscribedEvents },
            retry_policy: { max_attempts: 5, base_backoff_seconds: 30 },
            status: 'active',
          })
          .select('*')
          .single();
        if (error) throw error;
        return res.status(201).json({ action: 'register', subscription: data });
      }

      if (action === 'deactivate' || action === 'deactivate-adapter') {
        const adapterId = typeof body.adapter_id === 'string' ? body.adapter_id.trim()
                         : typeof body.subscription_id === 'string' ? body.subscription_id.trim()
                         : '';
        if (!UUID_RE.test(adapterId)) {
          return bad(res, 'subscription_id (uuid) required');
        }
        const { data, error } = await (supabase as any)
          .schema('platform')
          .from('webhook_subscriptions')
          .update({ status: 'paused' })
          .eq('id', adapterId)
          .eq('tenant_id', authReq.tenantId)
          .select('id, target_url, status')
          .maybeSingle();
        if (error) throw error;
        if (!data) return bad(res, 'subscription not found in tenant scope', 404, 'NOT_FOUND');
        return res.json({ action: 'deactivate', subscription: data });
      }

      if (action === 'set-status') {
        const adapterId = typeof body.subscription_id === 'string' ? body.subscription_id.trim() : '';
        if (!UUID_RE.test(adapterId)) return bad(res, 'subscription_id (uuid) required');
        const status = typeof body.status === 'string' ? body.status.trim() : '';
        if (!ALLOWED_STATUS.has(status)) {
          return bad(res, `status must be one of: ${Array.from(ALLOWED_STATUS).join(', ')}`);
        }
        const { data, error } = await (supabase as any)
          .schema('platform')
          .from('webhook_subscriptions')
          .update({ status })
          .eq('id', adapterId)
          .eq('tenant_id', authReq.tenantId)
          .select('id, target_url, status')
          .maybeSingle();
        if (error) throw error;
        if (!data) return bad(res, 'subscription not found in tenant scope', 404, 'NOT_FOUND');
        return res.json({ action: 'set-status', subscription: data });
      }

      if (action === 'dispatch-event' || action === 'dispatch') {
        const eventType = typeof body.event_type === 'string' ? body.event_type.trim() : '';
        if (!eventType) return bad(res, 'event_type required');
        const payload = body.payload && typeof body.payload === 'object'
          ? (body.payload as Record<string, unknown>)
          : {};
        const subscriptionId = typeof body.subscription_id === 'string' ? body.subscription_id.trim() : undefined;
        if (subscriptionId && !UUID_RE.test(subscriptionId)) {
          return bad(res, 'subscription_id must be uuid');
        }
        const result = await enqueueWebhookEvent({
          supabase,
          tenantId: authReq.tenantId,
          eventType,
          payload,
          subscriptionId,
        });
        return res.status(202).json({
          action: 'dispatch-event',
          event_type: eventType,
          ...result,
        });
      }

      return bad(res, 'unsupported action — try register / deactivate / set-status');
    } catch (err) {
      logger.error('uim.webhooks action error', { action, error: err instanceof Error ? err.message : String(err) });
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Action failed',
        code: 'UIM_WEBHOOKS_ACTION_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

export default router;
