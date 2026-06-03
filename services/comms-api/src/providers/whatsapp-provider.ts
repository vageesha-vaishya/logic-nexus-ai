// Phase 6 comms-api — WhatsApp provider abstraction.
//
// Mirrors sms-provider.ts. Direct imports of provider SDKs are
// restricted to this directory via the eslint COMMS_PROVIDER_SDK_BANS
// rule. Twilio is the obvious first vendor (same client as the SMS
// provider, different URI prefix); Meta's WhatsApp Cloud API and
// 360dialog are the natural alternates for tenants that prefer
// direct-to-Meta or APAC residency.
//
// Two flavors of WhatsApp message:
//
//   1. Session messages — free-text, allowed within 24h of the user's
//      last inbound message. Same shape as SMS: from, to, text.
//      Used for replies in a live conversation.
//
//   2. Template messages — pre-approved by Meta. Required to start a
//      new conversation outside the 24h session window. The template
//      body has named placeholders that get filled at send time.
//      templateName + templateVariables on OutboundWhatsapp.
//
// The Twilio WhatsApp implementation will read OutboundWhatsapp.templateName
// and route to contentSid + contentVariables; the Meta Cloud API
// implementation will use template.name + components/parameters. The
// interface here keeps both vendor shapes representable without the
// caller needing to care.

import { TwilioWhatsappProvider } from './twilio-whatsapp.js';

export interface OutboundWhatsapp {
  tenantId: string;
  /** E.164 sender number, e.g. '+14155238886'. Must be a WhatsApp-enabled
   *  sender on the configured provider. */
  from: string;
  /** E.164 destination, single recipient. */
  to: string;
  /** Free-text body. Used for session messages; ignored when templateName is set. */
  text?: string;
  /**
   * Approved template name + the variables to render into it. Required
   * for business-initiated messages outside the 24h session window.
   * The template itself must already be approved on the provider.
   */
  templateName?: string;
  templateVariables?: Record<string, string>;
  /** Provider-specific opaque hint (e.g. Meta media-id for an image). */
  metadata?: Record<string, string>;
}

export interface WhatsappSendResult {
  ok: boolean;
  providerMessageId?: string;
  errorText?: string;
  /** Provider name as it goes into comms.deliveries.provider. */
  providerName: string;
  /**
   * When true the delivery-worker skips retries and transitions the row
   * to status='failed' immediately. Use for clear bad-payload errors
   * (unregistered template, recipient outside opt-in list, account
   * suspended).
   */
  permanent?: boolean;
}

export interface WhatsappProvider {
  readonly name: string;
  send(msg: OutboundWhatsapp): Promise<WhatsappSendResult>;
}

// No-op provider used when no WhatsApp provider is configured. Returns
// permanent=true + a descriptive error_text so the row lands in
// status='failed' instead of looping. Lets the rest of the chain be
// exercised without provider credentials.
export class NullWhatsappProvider implements WhatsappProvider {
  readonly name = 'null';

  async send(_msg: OutboundWhatsapp): Promise<WhatsappSendResult> {
    return {
      ok: false,
      providerName: this.name,
      errorText:
        'no WhatsApp provider configured (set COMMS_WHATSAPP_PROVIDER=twilio + TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + COMMS_WHATSAPP_DEFAULT_FROM to enable real sends)',
      permanent: true,
    };
  }
}

export function getWhatsappProvider(): WhatsappProvider {
  const kind = String(process.env.COMMS_WHATSAPP_PROVIDER || '').toLowerCase().trim();
  if (kind === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      // Half-configured env — keep the null provider so the worker
      // still boots and the misconfig surfaces via error_text.
      return new NullWhatsappProvider();
    }
    return new TwilioWhatsappProvider(sid, token);
  }
  // 'meta' / 'cloud-api' / '360dialog' implementations land in
  // follow-up slices when those vendors become priorities.
  return new NullWhatsappProvider();
}
