// Phase 6 comms-api — delivery worker.
//
// The notification-dispatcher (read half) creates comms.deliveries rows
// with status='pending'. This worker (write half) picks them up,
// suppression-checks the recipient, renders the message via a minimal
// fallback template, hands it to the configured provider, and writes the
// outcome back to the same row.
//
// Step 4 scope (this slice):
//   - Email channel only — sms/whatsapp/push/in_app stay 'pending'.
//   - Minimal fallback render (subject = intent_kind, body = payload).
//     comms.templates wiring is the next slice; until then, payload
//     carries pre-rendered subject + html when callers want polish.
//   - RFC 8058 List-Unsubscribe URL: stub points at /api/comms/unsubscribe
//     with the delivery id — the unsubscribe page lands in a later slice.
//
// Retry (Step 10): transient send failures stay status='pending' with
// attempt_count incremented and next_retry_at set to now() + backoff.
// The pickup query filters by next_retry_at <= now() so the row sits
// out the backoff window. attempt_count >= max_attempts moves to
// status='failed' permanently.
//
// Backoff curve (seconds): 30, 120, 480, 1800, 7200 — base 4, ceiling 2h.
// Permanent errors (e.g., 4xx classified as bad-payload) skip retry by
// returning ok:false + permanent:true from the provider.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { getEmailProvider } from '../providers/email-provider.js';
import type { EmailProvider, OutboundEmail, SendResult } from '../providers/email-provider.js';
import { getSmsProvider } from '../providers/sms-provider.js';
import type { SmsProvider, OutboundSms, SmsSendResult } from '../providers/sms-provider.js';
import { getWhatsappProvider } from '../providers/whatsapp-provider.js';
import type { WhatsappProvider, OutboundWhatsapp, WhatsappSendResult } from '../providers/whatsapp-provider.js';
import { getPushProvider } from '../providers/push-provider.js';
import type { PushProvider, OutboundPush, PushSendResult } from '../providers/push-provider.js';
import { isSuppressed } from './suppressions.js';
import { TemplateRenderer } from './template-renderer.js';
import { logger } from '../utils/logger.js';
import type { ChannelKind, DeliveryRow, NotificationIntent } from '../types/comms.types.js';

const POLL_INTERVAL_MS = parseInt(process.env.COMMS_WORKER_POLL_INTERVAL_MS || '5000', 10);
const BATCH_SIZE = parseInt(process.env.COMMS_WORKER_BATCH_SIZE || '20', 10);
const FROM_ADDRESS = process.env.COMMS_DEFAULT_FROM || 'SOS Logistics <notifications@sosservices.online>';
const SMS_FROM_NUMBER = process.env.COMMS_SMS_DEFAULT_FROM || '';
const WHATSAPP_FROM_NUMBER = process.env.COMMS_WHATSAPP_DEFAULT_FROM || '';
const PUBLIC_BASE_URL = (process.env.COMMS_PUBLIC_BASE_URL || 'https://sosservices.online').replace(/\/$/, '');
// Channels the worker picks up on each tick. in_app stays 'pending' —
// useNotifications.ts reads markets.notifications directly without
// going through comms.deliveries.
const ACTIVE_CHANNELS: ReadonlyArray<string> = ['email', 'sms', 'whatsapp', 'push'];

interface DeliveryWithIntent extends DeliveryRow {
  intent?: NotificationIntent | null;
}

export class DeliveryWorker {
  private supabase: SupabaseClient | null = null;
  private emailProvider: EmailProvider | null = null;
  private smsProvider: SmsProvider | null = null;
  private whatsappProvider: WhatsappProvider | null = null;
  private pushProvider: PushProvider | null = null;
  private templateRenderer: TemplateRenderer | null = null;
  private running = false;
  private intervalHandle: NodeJS.Timeout | null = null;

  start(): void {
    if (this.intervalHandle) return;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error('delivery worker requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
    }
    this.supabase = createClient(url, key);
    this.emailProvider = getEmailProvider();
    this.smsProvider = getSmsProvider();
    this.whatsappProvider = getWhatsappProvider();
    this.pushProvider = getPushProvider();
    this.templateRenderer = new TemplateRenderer(this.supabase);
    logger.info('comms delivery worker starting', {
      pollMs: POLL_INTERVAL_MS,
      batch: BATCH_SIZE,
      emailProvider: this.emailProvider.name,
      smsProvider: this.smsProvider.name,
      whatsappProvider: this.whatsappProvider.name,
      pushProvider: this.pushProvider.name,
    });
    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
    void this.tick();
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running || !this.supabase) return;
    this.running = true;
    try {
      const pending = await this.fetchPending();
      if (pending.length === 0) return;
      logger.info('delivery worker processing', { count: pending.length });
      for (const delivery of pending) {
        await this.processDelivery(delivery);
      }
    } catch (err) {
      logger.error('delivery worker tick failed', err);
    } finally {
      this.running = false;
    }
  }

  private async fetchPending(): Promise<DeliveryWithIntent[]> {
    if (!this.supabase) return [];
    // Pickup criteria: pending + email + retry window elapsed.
    // next_retry_at is NOT NULL with '-infinity' as the "ready now"
    // sentinel — keeps this a single inequality (PostgREST .or() with
    // is.null + timestamp literals is brittle).
    const nowIso = new Date().toISOString();
    const { data, error } = await (this.supabase as any)
      .schema('comms')
      .from('deliveries')
      .select('*')
      .eq('status', 'pending')
      .in('channel_kind', ACTIVE_CHANNELS)
      .lte('next_retry_at', nowIso)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);
    if (error) {
      logger.warn('delivery worker fetch error', { error: error.message });
      return [];
    }
    const rows = (data as DeliveryRow[]) || [];
    if (rows.length === 0) return [];

    const notifIds = Array.from(new Set(rows.map((r) => r.notification_id).filter(Boolean))) as string[];
    if (notifIds.length === 0) return rows.map((r) => ({ ...r, intent: null }));

    const { data: intents, error: intentErr } = await (this.supabase as any)
      .schema('core')
      .from('notifications')
      .select('*')
      .in('id', notifIds);
    if (intentErr) {
      logger.warn('delivery worker intent join error', { error: intentErr.message });
      return rows.map((r) => ({ ...r, intent: null }));
    }
    const byId = new Map<string, NotificationIntent>();
    for (const i of (intents as NotificationIntent[]) || []) byId.set(i.id, i);
    return rows.map((r) => ({ ...r, intent: r.notification_id ? byId.get(r.notification_id) ?? null : null }));
  }

  private async processDelivery(delivery: DeliveryWithIntent): Promise<void> {
    if (!this.supabase || !this.emailProvider || !this.smsProvider || !this.whatsappProvider || !this.pushProvider) return;
    const channel = delivery.channel_kind as ChannelKind;
    if (!ACTIVE_CHANNELS.includes(channel)) return;

    const address = (delivery.recipient_address || '').trim();
    if (!address) {
      await this.markFailed(delivery.id, 'recipient_address missing');
      return;
    }

    // 1. Suppression check. Suppressions are channel-scoped (a number
    //    can be SMS-opted-out without being email-opted-out and vice
    //    versa) so we pass the channel through.
    if (await isSuppressed(this.supabase, delivery.tenant_id, channel, address)) {
      await this.markStatus(delivery.id, 'suppressed', {
        error_text: 'recipient is on comms.suppressions',
      });
      return;
    }

    // 2. Render. Prefer a versioned template per (tenant, intent, channel,
    // language); fall back to payload-supplied subject/html for ad-hoc
    // intents (test rows, one-off emits).
    const renderResult =
      delivery.intent && this.templateRenderer
        ? await this.templateRenderer.render({
            tenantId: delivery.tenant_id,
            intentKind: delivery.intent.intent_kind,
            channelKind: channel,
            language: ((delivery.intent.payload as Record<string, unknown> | null)?.['language'] as string) || 'en',
            variables: { ...(delivery.intent.payload || {}), recipient_address: address },
          })
        : { rendered: null };

    const rendered = renderResult.rendered ?? renderFromIntent(delivery.intent);
    const templateVersionId = renderResult.rendered?.templateVersionId ?? null;

    // 3. Send. Route per channel — each provider returns the same
    //    {ok, providerMessageId?, errorText?, providerName, permanent?}
    //    shape so the retry/failure handling below is channel-agnostic.
    let result: SendResult | SmsSendResult | WhatsappSendResult | PushSendResult;
    if (channel === 'push') {
      // recipient_address holds the device token. Title/body come from
      // the rendered template — push templates use subject_template
      // for the banner title and body_text_template for the body.
      const push: OutboundPush = {
        tenantId: delivery.tenant_id,
        token: address,
        title: rendered.subject || 'Notification',
        body: rendered.text || stripHtml(rendered.html || ''),
        data: {
          intent_kind: delivery.intent?.intent_kind || '',
          subject_type: delivery.intent?.subject_type || '',
          subject_id: delivery.intent?.subject_id || '',
        },
      };
      result = await this.pushProvider.send(push);
    } else if (channel === 'sms') {
      const sms: OutboundSms = {
        tenantId: delivery.tenant_id,
        from: SMS_FROM_NUMBER,
        to: address,
        // SMS body — prefer the plain-text variant since SMS doesn't
        // render HTML. Strip HTML tags from the html field as a last
        // resort so the recipient at least sees the message content.
        text: rendered.text || rendered.subject + (rendered.html ? '\n' + stripHtml(rendered.html) : ''),
      };
      result = await this.smsProvider.send(sms);
    } else if (channel === 'whatsapp') {
      // Same body-derivation as SMS — WhatsApp session messages don't
      // render HTML. Template-initiated messages will set
      // templateName/templateVariables via the payload; today we
      // only ship the session-text path.
      const wa: OutboundWhatsapp = {
        tenantId: delivery.tenant_id,
        from: WHATSAPP_FROM_NUMBER,
        to: address,
        text: rendered.text || rendered.subject + (rendered.html ? '\n' + stripHtml(rendered.html) : ''),
      };
      result = await this.whatsappProvider.send(wa);
    } else {
      const email: OutboundEmail = {
        tenantId: delivery.tenant_id,
        from: FROM_ADDRESS,
        to: [address],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        listUnsubscribeUrl: `${PUBLIC_BASE_URL}/api/comms/unsubscribe?d=${delivery.id}`,
      };
      result = await this.emailProvider.send(email);
    }
    if (result.ok) {
      await this.markStatus(delivery.id, 'sent', {
        provider: result.providerName,
        provider_message_id: result.providerMessageId ?? null,
        sent_at: new Date().toISOString(),
        attempt_count: (delivery.attempt_count ?? 0) + 1,
        template_version_id: templateVersionId,
      });
      return;
    }

    // Failure path. Decide retry vs permanent based on attempt cap + provider hint.
    const nextAttempt = (delivery.attempt_count ?? 0) + 1;
    const maxAttempts = delivery.max_attempts ?? 5;
    const isPermanent = result.permanent === true || nextAttempt >= maxAttempts;

    if (isPermanent) {
      await this.markStatus(delivery.id, 'failed', {
        provider: result.providerName,
        error_text: result.errorText ?? 'unknown provider error',
        failed_at: new Date().toISOString(),
        attempt_count: nextAttempt,
        template_version_id: templateVersionId,
      });
      return;
    }

    const nextRetryAt = new Date(Date.now() + computeBackoffMs(nextAttempt)).toISOString();
    await this.updateRow(delivery.id, {
      // Stays status='pending' — the next tick will re-evaluate at next_retry_at.
      provider: result.providerName,
      error_text: result.errorText ?? 'unknown provider error',
      attempt_count: nextAttempt,
      next_retry_at: nextRetryAt,
      template_version_id: templateVersionId,
    });
    logger.info('delivery scheduled for retry', {
      id: delivery.id,
      attempt: nextAttempt,
      nextRetryAt,
    });
  }

  private async updateRow(id: string, patch: Record<string, unknown>): Promise<void> {
    if (!this.supabase) return;
    const { error } = await (this.supabase as any)
      .schema('comms')
      .from('deliveries')
      .update(patch)
      .eq('id', id);
    if (error) {
      logger.warn('delivery row update failed', { id, error: error.message });
    }
  }

  private async markStatus(
    id: string,
    status: 'sent' | 'failed' | 'suppressed',
    extra: Record<string, unknown>,
  ): Promise<void> {
    if (!this.supabase) return;
    const { error } = await (this.supabase as any)
      .schema('comms')
      .from('deliveries')
      .update({ status, ...extra })
      .eq('id', id);
    if (error) {
      logger.warn('delivery status update failed', { id, status, error: error.message });
    }
  }

  private async markFailed(id: string, reason: string): Promise<void> {
    await this.markStatus(id, 'failed', {
      error_text: reason,
      failed_at: new Date().toISOString(),
    });
  }
}

// Exponential backoff: 30s, 2m, 8m, 30m, 2h. base=4, ceiling=2h.
function computeBackoffMs(attempt: number): number {
  const baseSeconds = 30;
  const factor = 4;
  const ceilingSeconds = 7200;
  const delay = Math.min(baseSeconds * Math.pow(factor, attempt - 1), ceilingSeconds);
  return delay * 1000;
}

function renderFromIntent(
  intent: NotificationIntent | null | undefined,
): { subject: string; html: string; text: string } {
  // Pre-rendered subject + html in payload wins. Falls back to a minimal
  // deterministic render keyed on intent_kind so the operator can see
  // what would have been sent before templates wire up.
  const payload = (intent?.payload || {}) as Record<string, unknown>;
  const subject =
    (payload.subject as string) ||
    `[${intent?.severity || 'info'}] ${intent?.intent_kind || 'notification'}`;
  const html =
    (payload.html as string) ||
    `<p>${escapeHtml(intent?.intent_kind || 'notification')}</p>` +
      `<pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`;
  const text = (payload.text as string) || JSON.stringify(payload);
  return { subject, html, text };
}

// Last-resort body for SMS when the template doesn't set body_text.
// Strips tags + collapses whitespace; SMS bodies above ~160 chars get
// auto-segmented by the provider so we don't truncate here.
function stripHtml(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const deliveryWorker = new DeliveryWorker();
