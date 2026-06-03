// Phase 6 comms-api — Twilio WhatsApp implementation.
//
// Same Twilio client as the SMS provider but with `whatsapp:` URI
// prefix. Session messages go as plain text; template-initiated
// messages use Content API (contentSid + contentVariables).
//
// SDK import restricted to this directory via eslint
// COMMS_PROVIDER_SDK_BANS — callers route through getWhatsappProvider().

import Twilio from 'twilio';
import type { Twilio as TwilioClient } from 'twilio';

import type { OutboundWhatsapp, WhatsappProvider, WhatsappSendResult } from './whatsapp-provider.js';

// Twilio + WhatsApp error codes we treat as PERMANENT.
//   63007 — Channel not found / sandbox not joined for this recipient
//   63016 — Failed: send outside session window without template
//   63017 — Recipient's number isn't registered with WhatsApp
//   63018 — Account doesn't have WhatsApp permissions for this country
//   63020 — Template not approved / wrong category
//   63024 — Recipient opted out of WhatsApp messages from this sender
// Plus the same generic SMS-side codes that apply to any messages.create.
const TWILIO_WHATSAPP_PERMANENT_CODES = new Set([
  21211, 21212, 21214, 21408, 21610, 21614,
  63007, 63016, 63017, 63018, 63020, 63024,
]);

interface TwilioApiError {
  code?: number;
  status?: number;
  message?: string;
  moreInfo?: string;
}

function isTwilioApiError(err: unknown): err is TwilioApiError {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as TwilioApiError;
  return typeof candidate.code === 'number' || typeof candidate.status === 'number';
}

function withWhatsappPrefix(e164: string): string {
  return e164.startsWith('whatsapp:') ? e164 : `whatsapp:${e164}`;
}

export class TwilioWhatsappProvider implements WhatsappProvider {
  readonly name = 'twilio-whatsapp';
  private client: TwilioClient;

  constructor(accountSid: string, authToken: string) {
    this.client = Twilio(accountSid, authToken);
  }

  async send(msg: OutboundWhatsapp): Promise<WhatsappSendResult> {
    if (!msg.from) {
      return {
        ok: false,
        providerName: this.name,
        errorText:
          'COMMS_WHATSAPP_DEFAULT_FROM unset — Twilio needs an E.164 WhatsApp-enabled sender',
        permanent: true,
      };
    }
    if (!msg.to) {
      return {
        ok: false,
        providerName: this.name,
        errorText: 'recipient address missing',
        permanent: true,
      };
    }
    if (!msg.text && !msg.templateName) {
      return {
        ok: false,
        providerName: this.name,
        errorText: 'whatsapp send requires either text (session) or templateName',
        permanent: true,
      };
    }

    try {
      // Branch the request shape: template messages use Content API,
      // session messages use plain body. Twilio's create() accepts
      // both call signatures; cast to a loose record so the type
      // checker doesn't reject the union shape.
      const createArgs: Record<string, unknown> = {
        from: withWhatsappPrefix(msg.from),
        to: withWhatsappPrefix(msg.to),
      };
      if (msg.templateName) {
        // contentSid format expects a Twilio Content SID (HXxxxxxxxx).
        // We treat templateName as the contentSid since both Meta + Twilio
        // identify pre-approved templates by an opaque id, not the name.
        createArgs.contentSid = msg.templateName;
        if (msg.templateVariables) {
          createArgs.contentVariables = JSON.stringify(msg.templateVariables);
        }
      } else {
        createArgs.body = msg.text;
      }

      const message = await this.client.messages.create(
        createArgs as unknown as Parameters<typeof this.client.messages.create>[0],
      );
      return {
        ok: true,
        providerName: this.name,
        providerMessageId: message.sid,
      };
    } catch (err) {
      if (isTwilioApiError(err)) {
        const code = err.code ?? 0;
        const permanent =
          TWILIO_WHATSAPP_PERMANENT_CODES.has(code) ||
          (typeof err.status === 'number'
            && err.status >= 400 && err.status < 500
            && err.status !== 408 && err.status !== 429);
        return {
          ok: false,
          providerName: this.name,
          errorText: `twilio-whatsapp error ${code}: ${err.message ?? 'unknown'}`,
          permanent,
        };
      }
      return {
        ok: false,
        providerName: this.name,
        errorText: err instanceof Error ? err.message : String(err),
        permanent: false,
      };
    }
  }
}
