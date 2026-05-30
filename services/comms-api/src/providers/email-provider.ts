// Phase 6 comms-api — email provider abstraction.
//
// Imports of provider implementations are restricted to this directory.
// CI lint forbids importing `./resend.js`, `nodemailer`, `@aws-sdk/client-ses`
// etc. from anywhere outside services/comms-api/src/providers/ — keep all
// call sites routed through getEmailProvider() per comms.md §10.

import { ResendEmailProvider } from './resend.js';
//
// The send-gateway calls EmailProvider.send() and never knows whether it
// hit Resend, SES, nodemailer SMTP, etc. CI lint forbids any direct
// import of 'resend' / 'nodemailer' / '@aws-sdk/client-ses' outside
// services/comms-api/src/providers/ (per comms.md §10 acceptance).
//
// This is the interface only. The Resend implementation arrives in the
// next slice once the credentials path through core.secrets is built.

export interface OutboundEmail {
  tenantId: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  attachments?: OutboundAttachment[];
  // Required for RFC 8058 compliance — every outbound carries the header.
  listUnsubscribeUrl?: string;
}

export interface OutboundAttachment {
  filename: string;
  contentBase64: string;
  contentType: string;
  inlineCid?: string;
}

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  errorText?: string;
  // Provider name as it goes into comms.deliveries.provider.
  providerName: string;
  // Phase 6 Step 10 — when true, the delivery-worker skips retries and
  // transitions the row to status='failed' immediately. Use for clear
  // 4xx-class errors (bad payload, unverified domain, invalid recipient).
  permanent?: boolean;
}

export interface EmailProvider {
  readonly name: string;
  send(email: OutboundEmail): Promise<SendResult>;
}

// A no-op provider used when no provider is configured. The dispatcher
// still creates the 'pending' comms.deliveries row; this lets the
// pipeline be exercised end-to-end without actually delivering mail.
export class NullEmailProvider implements EmailProvider {
  readonly name = 'null';

  async send(_email: OutboundEmail): Promise<SendResult> {
    return {
      ok: false,
      providerName: this.name,
      errorText:
        'no email provider configured (set COMMS_EMAIL_PROVIDER=resend + RESEND_API_KEY to enable real sends)',
      // Misconfiguration, not a transient network error — don't retry.
      permanent: true,
    };
  }
}

export function getEmailProvider(): EmailProvider {
  const kind = String(process.env.COMMS_EMAIL_PROVIDER || '').toLowerCase().trim();
  if (kind === 'resend') {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      // Falling through to the null provider keeps the worker running in
      // environments without secrets — the delivery row lands with
      // status='failed' and a descriptive error_text rather than crashing.
      return new NullEmailProvider();
    }
    return new ResendEmailProvider(key);
  }
  return new NullEmailProvider();
}
