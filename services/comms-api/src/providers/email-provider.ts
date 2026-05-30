// Phase 6 comms-api — email provider abstraction.
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
      errorText: 'no email provider configured (Phase 6 Step 3 skeleton — provider integration is the next slice)',
    };
  }
}

export function getEmailProvider(): EmailProvider {
  // Step 4 will read process.env.COMMS_EMAIL_PROVIDER (resend|ses|smtp)
  // and return the corresponding implementation. Until then, no-op.
  return new NullEmailProvider();
}
