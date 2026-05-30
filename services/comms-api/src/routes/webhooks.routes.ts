// Phase 6 comms-api — Resend webhook receiver.
//
// Resend POSTs delivery lifecycle events here. Each event:
//   1. Verified via Svix HMAC-SHA256 (svix-id + svix-timestamp + body).
//   2. Logged to comms.delivery_events (dedup by provider_event_id).
//   3. Updates the matching comms.deliveries row's status + timestamps.
//   4. Hard bounces and complaints auto-add to comms.suppressions.
//
// This route is mounted BEFORE the auth middleware in app.ts — Resend
// has no JWT to send. Trust comes from the HMAC.
//
// Endpoint:  POST /api/comms/webhooks/resend
// Required env: COMMS_RESEND_WEBHOOK_SECRET (Svix signing secret)

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

import { addSuppression, SuppressionReason } from '../services/suppressions.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ChannelKind } from '../types/comms.types.js';

// Raw body is captured app-wide via the express.json verify hook in app.ts.
const router = Router();

interface ResendWebhookEvent {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[] | string;
    subject?: string;
    bounce?: { type?: string; message?: string };
    click?: { link?: string; ipAddress?: string; userAgent?: string };
    open?: { ipAddress?: string; userAgent?: string };
  } & Record<string, unknown>;
}

function verifySvixSignature(req: Request, secret: string): boolean {
  // Resend uses Svix-style signing. Headers:
  //   svix-id, svix-timestamp, svix-signature (space-separated "v1,<b64sig>" entries)
  const id = String(req.header('svix-id') || '');
  const timestamp = String(req.header('svix-timestamp') || '');
  const sigHeader = String(req.header('svix-signature') || '');
  const body = (req as Request & { rawBody?: string }).rawBody || '';
  if (!id || !timestamp || !sigHeader || !body) return false;

  // Svix secrets are prefixed (whsec_...) and stored base64-encoded.
  const stripped = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let keyBytes: Buffer;
  try {
    keyBytes = Buffer.from(stripped, 'base64');
  } catch {
    return false;
  }
  const signedPayload = `${id}.${timestamp}.${body}`;
  const expected = createHmac('sha256', keyBytes).update(signedPayload).digest('base64');

  for (const entry of sigHeader.split(' ')) {
    const [version, sig] = entry.split(',');
    if (version !== 'v1' || !sig) continue;
    if (sig.length === expected.length) {
      try {
        if (timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return true;
      } catch {
        // length mismatch on Buffer.from — fall through
      }
    }
  }
  return false;
}

function getServiceRoleClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('comms-api webhook receiver requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key);
}

// Map Resend event → comms.delivery_events.event_type + comms.deliveries column update.
function mapResendEvent(type: string): {
  event: string;
  statusUpdate?: { status: string; column: string };
  suppressionReason?: SuppressionReason;
} {
  switch (type) {
    case 'email.sent':
      return { event: 'sent', statusUpdate: { status: 'sent', column: 'sent_at' } };
    case 'email.delivered':
      return { event: 'delivered', statusUpdate: { status: 'delivered', column: 'delivered_at' } };
    case 'email.bounced':
      return { event: 'bounced', statusUpdate: { status: 'bounced', column: 'bounced_at' } };
    case 'email.complained':
      return {
        event: 'complained',
        statusUpdate: { status: 'complained', column: 'complained_at' },
        suppressionReason: 'complaint',
      };
    case 'email.opened':
      return { event: 'opened', statusUpdate: { status: 'delivered', column: 'opened_at' } };
    case 'email.clicked':
      return { event: 'clicked', statusUpdate: { status: 'delivered', column: 'clicked_at' } };
    case 'email.delivery_delayed':
      return { event: 'delivery_delayed' };
    default:
      return { event: type };
  }
}

router.post(
  '/comms/webhooks/resend',
  asyncHandler(async (req, res) => {
    const secret = process.env.COMMS_RESEND_WEBHOOK_SECRET;
    if (!secret) {
      logger.warn('webhook receiver: COMMS_RESEND_WEBHOOK_SECRET unset; rejecting');
      return res.status(503).json({ error: 'webhook receiver not configured', code: 'NOT_CONFIGURED', statusCode: 503 });
    }
    if (!verifySvixSignature(req, secret)) {
      logger.warn('webhook receiver: signature verification failed', {
        svixId: req.header('svix-id'),
      });
      return res.status(401).json({ error: 'invalid signature', code: 'INVALID_SIGNATURE', statusCode: 401 });
    }

    const event = req.body as ResendWebhookEvent;
    if (!event?.type || !event?.data?.email_id) {
      return res.status(400).json({ error: 'malformed webhook payload', code: 'MALFORMED', statusCode: 400 });
    }

    const supabase = getServiceRoleClient();
    const providerMessageId = event.data.email_id;

    // 1. Look up the delivery by provider_message_id.
    const { data: delivery, error: lookupErr } = await (supabase as any)
      .schema('comms')
      .from('deliveries')
      .select('id, tenant_id, channel_kind, recipient_address')
      .eq('provider', 'resend')
      .eq('provider_message_id', providerMessageId)
      .maybeSingle();
    if (lookupErr) {
      logger.warn('webhook delivery lookup error', { error: lookupErr.message, providerMessageId });
      return res.status(500).json({ error: 'lookup failed', code: 'LOOKUP_ERROR', statusCode: 500 });
    }
    if (!delivery) {
      // Idempotency-safe: 200 so Resend doesn't retry forever for a row
      // we don't own (e.g., another service's webhook misrouted).
      logger.info('webhook delivery not found; acking', { providerMessageId });
      return res.status(200).json({ ack: true, matched: false });
    }

    const mapped = mapResendEvent(event.type);
    const providerEventId = String(req.header('svix-id') || `${event.type}:${providerMessageId}:${event.created_at || ''}`);

    // 2. Append delivery_events. UNIQUE-ish dedup on (delivery_id, provider_event_id)
    //    is enforced by application + a partial index we'll add when traffic warrants.
    const { error: evErr } = await (supabase as any)
      .schema('comms')
      .from('delivery_events')
      .insert({
        tenant_id: delivery.tenant_id,
        delivery_id: delivery.id,
        event_type: mapped.event,
        provider_event_id: providerEventId,
        occurred_at: event.created_at || new Date().toISOString(),
        payload: event,
        bounce_kind: event.data.bounce?.type || null,
        bounce_reason: event.data.bounce?.message || null,
        clicked_url: event.data.click?.link || null,
        ip_address: event.data.click?.ipAddress || event.data.open?.ipAddress || null,
        user_agent: event.data.click?.userAgent || event.data.open?.userAgent || null,
      });
    if (evErr && !/duplicate key/i.test(evErr.message || '')) {
      logger.warn('delivery_events insert failed', { error: evErr.message });
    }

    // 3. Update deliveries.status + the matching timestamp column.
    if (mapped.statusUpdate) {
      const patch: Record<string, unknown> = {
        status: mapped.statusUpdate.status,
        [mapped.statusUpdate.column]: event.created_at || new Date().toISOString(),
      };
      if (event.type === 'email.bounced') {
        patch.bounce_kind = event.data.bounce?.type || null;
        patch.error_text = event.data.bounce?.message || null;
      }
      const { error: updErr } = await (supabase as any)
        .schema('comms')
        .from('deliveries')
        .update(patch)
        .eq('id', delivery.id);
      if (updErr) {
        logger.warn('delivery status update failed', { error: updErr.message, deliveryId: delivery.id });
      }
    }

    // 4. Auto-suppress on hard bounces + complaints.
    const reason: SuppressionReason | undefined =
      event.type === 'email.bounced' && (event.data.bounce?.type || '').toLowerCase() === 'hard'
        ? 'bounce_hard'
        : mapped.suppressionReason;
    if (reason && delivery.recipient_address) {
      await addSuppression(supabase, {
        tenantId: delivery.tenant_id,
        channelKind: delivery.channel_kind as ChannelKind,
        address: delivery.recipient_address,
        reason,
        sourceEventId: null,
        notes: `auto: resend ${event.type} ${event.data.bounce?.message || ''}`.trim(),
        addedByKind: 'webhook',
      });
    }

    return res.status(200).json({ ack: true, matched: true });
  }),
);

export default router;
