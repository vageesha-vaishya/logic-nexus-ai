// Phase 6 comms-api — Twilio SMS provider implementation.
//
// Imports of the twilio SDK are restricted to this directory via
// eslint COMMS_PROVIDER_SDK_BANS — callers route through getSmsProvider()
// so suppressions, delivery_events, template versioning, and retry
// classification happen in one place. See comms.md §10.

import Twilio from 'twilio';
import type { Twilio as TwilioClient } from 'twilio';

import type { OutboundSms, SmsProvider, SmsSendResult } from './sms-provider.js';

// Twilio error codes we treat as PERMANENT failures. Retrying these
// against the same recipient just burns rate-limit + spend without
// any chance of delivery. Reference: https://www.twilio.com/docs/api/errors
//   21211 — Invalid 'To' phone number
//   21212 — Invalid 'From' phone number
//   21214 — 'To' phone number cannot be reached
//   21408 — Permission to send SMS to this country has not been enabled
//   21610 — Recipient previously sent STOP — opt-out is permanent
//   21614 — 'To' is not a valid mobile number
//   30003 — Unreachable destination handset
//   30005 — Unknown destination handset
//   30006 — Landline or unreachable carrier
//   30008 — Unknown error from carrier
const TWILIO_PERMANENT_CODES = new Set([
  21211, 21212, 21214, 21408, 21610, 21614,
  30003, 30005, 30006, 30008,
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

export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';
  private client: TwilioClient;

  constructor(accountSid: string, authToken: string) {
    this.client = Twilio(accountSid, authToken);
  }

  async send(sms: OutboundSms): Promise<SmsSendResult> {
    if (!sms.from) {
      return {
        ok: false,
        providerName: this.name,
        errorText:
          'COMMS_SMS_DEFAULT_FROM unset — Twilio needs an E.164 from-number',
        permanent: true,
      };
    }
    if (!sms.to) {
      return {
        ok: false,
        providerName: this.name,
        errorText: 'recipient address missing',
        permanent: true,
      };
    }
    try {
      const message = await this.client.messages.create({
        from: sms.from,
        to: sms.to,
        body: sms.text,
      });
      return {
        ok: true,
        providerName: this.name,
        providerMessageId: message.sid,
      };
    } catch (err) {
      if (isTwilioApiError(err)) {
        const code = err.code ?? 0;
        const permanent =
          TWILIO_PERMANENT_CODES.has(code) ||
          // Any 4xx HTTP status that isn't a 408 (request timeout) or
          // a 429 (rate-limited) is treated as bad-payload: retrying
          // the same payload will keep failing.
          (typeof err.status === 'number'
            && err.status >= 400 && err.status < 500
            && err.status !== 408 && err.status !== 429);
        return {
          ok: false,
          providerName: this.name,
          errorText: `twilio error ${code}: ${err.message ?? 'unknown'}`,
          permanent,
        };
      }
      return {
        ok: false,
        providerName: this.name,
        errorText: err instanceof Error ? err.message : String(err),
        // Unknown shape — assume transient so the worker retries with
        // backoff. If the error is genuinely permanent the retry cap
        // (max_attempts) catches it eventually.
        permanent: false,
      };
    }
  }
}
