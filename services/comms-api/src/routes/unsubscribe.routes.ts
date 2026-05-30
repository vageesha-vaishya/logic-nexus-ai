// Phase 6 Step 8 — RFC 8058 one-click unsubscribe handler.
//
// The delivery-worker stamps every outbound email with:
//   List-Unsubscribe:        <https://.../api/comms/unsubscribe?d=<delivery_id>>
//   List-Unsubscribe-Post:   List-Unsubscribe=One-Click
//
// Per RFC 8058, the recipient's mail client POSTs to that URL with body
// "List-Unsubscribe=One-Click" and the server must:
//   1. Process the unsubscribe (no further interaction).
//   2. Respond 200/204 to confirm.
//
// We also accept GET so a recipient can click the URL in a browser and
// see a confirmation page.
//
// Trust model: the delivery_id is an unguessable UUID — possession of
// the URL proves the recipient received the original email. No auth
// header is sent or expected (mail clients won't have one).

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { addSuppression } from '../services/suppressions.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ChannelKind, ErrorResponse } from '../types/comms.types.js';

const router = Router();

function getServiceRoleClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('comms-api unsubscribe handler requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key);
}

function htmlConfirm(address: string, tenantId: string): string {
  return `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Unsubscribed</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 540px; margin: 80px auto; padding: 0 24px; color: #1a1a1a; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { line-height: 1.6; color: #555; }
    code { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-size: 0.95em; }
  </style>
</head><body>
  <h1>You're unsubscribed.</h1>
  <p>The address <code>${escapeHtml(address)}</code> will no longer receive email from this tenant.</p>
  <p>If this was a mistake, contact the sender to be re-added.</p>
</body></html>`;
}

function htmlError(message: string): string {
  return `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8" />
  <title>Unsubscribe</title>
  <style>body { font-family: -apple-system, system-ui, sans-serif; max-width: 540px; margin: 80px auto; padding: 0 24px; }</style>
</head><body>
  <h1>Unsubscribe failed</h1>
  <p>${escapeHtml(message)}</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function handle(req: Request, res: Response): Promise<void> {
  const deliveryId = String(req.query.d || '').trim();
  if (!deliveryId || !/^[0-9a-f-]{36}$/i.test(deliveryId)) {
    res.status(400).type('text/html').send(htmlError('Missing or malformed delivery id.'));
    return;
  }

  const supabase = getServiceRoleClient();
  const { data: delivery, error } = await (supabase as any)
    .schema('comms')
    .from('deliveries')
    .select('id, tenant_id, channel_kind, recipient_address')
    .eq('id', deliveryId)
    .maybeSingle();
  if (error) {
    logger.warn('unsubscribe handler: delivery lookup failed', { error: error.message, deliveryId });
    res.status(500).type('text/html').send(htmlError('Could not look up the delivery.'));
    return;
  }
  if (!delivery?.recipient_address) {
    // Don't reveal whether the id is valid — confirm-and-no-op keeps
    // probes from enumerating deliveries.
    res.status(200).type('text/html').send(htmlConfirm('(unknown)', ''));
    return;
  }

  await addSuppression(supabase, {
    tenantId: delivery.tenant_id,
    channelKind: delivery.channel_kind as ChannelKind,
    address: delivery.recipient_address,
    reason: 'unsubscribe',
    sourceEventId: null,
    notes: `recipient unsubscribed via delivery ${deliveryId}`,
    addedByKind: 'recipient_unsubscribe',
  });

  logger.info('unsubscribe applied', {
    deliveryId,
    tenantId: delivery.tenant_id,
    channel: delivery.channel_kind,
  });

  res.status(200).type('text/html').send(htmlConfirm(delivery.recipient_address, delivery.tenant_id));
}

router.get('/comms/unsubscribe', asyncHandler(handle));

// RFC 8058 POST path. Mail clients send "List-Unsubscribe=One-Click" as
// application/x-www-form-urlencoded. The body content doesn't matter —
// we don't auth on it. Just confirm.
router.post('/comms/unsubscribe', asyncHandler(handle));

export default router;

// Satisfy isolated-module checks — ErrorResponse is imported for type
// parity with sibling routes even when unused here.
export type _SuppressUnused = ErrorResponse;
