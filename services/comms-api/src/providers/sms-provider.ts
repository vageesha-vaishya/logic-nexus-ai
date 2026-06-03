// Phase 6 comms-api — SMS provider abstraction.
//
// Mirrors providers/email-provider.ts. Direct imports of provider SDKs
// (`twilio`, `@twilio/*`, `aws-sdk/sns`, etc.) are restricted to this
// directory via the eslint COMMS_PROVIDER_SDK_BANS rule — every caller
// goes through getSmsProvider() so suppression checks, delivery_events,
// and template-versioning happen in one place (per comms.md §10).

import { TwilioSmsProvider } from './twilio.js';

export interface OutboundSms {
  tenantId: string;
  /** E.164 from-number, e.g. '+14155551234'. Tenant-scoped. */
  from: string;
  /** E.164 destination, single recipient. SMS providers don't support
   *  multi-to in a single API call the way email does. */
  to: string;
  /** UTF-8 body. Long bodies will be segmented by the provider. */
  text: string;
  /** Provider-specific session/conversation hint (e.g. WhatsApp template). */
  metadata?: Record<string, string>;
}

export interface SmsSendResult {
  ok: boolean;
  providerMessageId?: string;
  errorText?: string;
  /** Provider name as it goes into comms.deliveries.provider. */
  providerName: string;
  /**
   * When true the delivery-worker skips retries and transitions the row
   * to status='failed' immediately. Use for clear 4xx-class errors
   * (invalid recipient number, geo-blocked, account suspended).
   */
  permanent?: boolean;
}

export interface SmsProvider {
  readonly name: string;
  send(sms: OutboundSms): Promise<SmsSendResult>;
}

// No-op provider used when no SMS provider is configured. The dispatcher
// still creates the 'pending' comms.deliveries row; this lets the
// channel-routing pipeline be exercised end-to-end without provisioning
// Twilio. The row lands with status='failed', error_text describing the
// misconfiguration, and permanent=true so the worker doesn't retry.
export class NullSmsProvider implements SmsProvider {
  readonly name = 'null';

  async send(_sms: OutboundSms): Promise<SmsSendResult> {
    return {
      ok: false,
      providerName: this.name,
      errorText:
        'no SMS provider configured (set COMMS_SMS_PROVIDER=twilio + TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN to enable real sends)',
      permanent: true,
    };
  }
}

export function getSmsProvider(): SmsProvider {
  const kind = String(process.env.COMMS_SMS_PROVIDER || '').toLowerCase().trim();
  if (kind === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      // Half-configured env — keep using the null provider so the
      // worker still boots and the misconfig surfaces in the
      // resulting comms.deliveries.error_text rather than crashing.
      return new NullSmsProvider();
    }
    return new TwilioSmsProvider(sid, token);
  }
  return new NullSmsProvider();
}
