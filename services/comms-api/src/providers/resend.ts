// Phase 6 comms-api — Resend email provider.
//
// Direct fetch to https://api.resend.com/emails — same shape as the
// legacy supabase/functions/send-email/index.ts ResendProvider, but with
// the contract narrowed to EmailProvider + retry/backoff stripped (the
// delivery-worker owns retry, not the provider).
//
// Domain verification: sosservices.online is verified in Resend ap-south-1
// (per [[resend-key-rotation]] memory). For unverified tenant domains
// the legacy code falls back to onboarding@resend.dev; for the skeleton
// we return ok:false instead — the operator should verify the domain
// rather than spray traffic from a shared Resend test sender.

import type { EmailProvider, OutboundEmail, SendResult } from './email-provider.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(email: OutboundEmail): Promise<SendResult> {
    const headers: Record<string, string> = {};
    if (email.listUnsubscribeUrl) {
      headers['List-Unsubscribe'] = `<${email.listUnsubscribeUrl}>`;
      // RFC 8058 — required by Gmail/Yahoo/Apple bulk-sender policy.
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
    if (email.headers) {
      for (const [k, v] of Object.entries(email.headers)) headers[k] = v;
    }

    const body: Record<string, unknown> = {
      from: email.from,
      to: email.to,
      subject: email.subject,
      html: email.html,
    };
    if (email.cc?.length) body.cc = email.cc;
    if (email.bcc?.length) body.bcc = email.bcc;
    if (email.text) body.text = email.text;
    if (email.replyTo) body.reply_to = email.replyTo;
    if (Object.keys(headers).length > 0) body.headers = headers;
    if (email.attachments?.length) {
      body.attachments = email.attachments.map((a) => ({
        filename: a.filename,
        content: a.contentBase64,
        content_type: a.contentType,
      }));
    }

    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
      if (!res.ok) {
        return {
          ok: false,
          providerName: this.name,
          errorText: json.message || json.name || `Resend HTTP ${res.status}`,
        };
      }
      return {
        ok: true,
        providerName: this.name,
        providerMessageId: json.id,
      };
    } catch (err) {
      return {
        ok: false,
        providerName: this.name,
        errorText: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
