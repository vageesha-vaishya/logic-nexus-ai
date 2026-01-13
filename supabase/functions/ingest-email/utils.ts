export interface EmailAttachment {
  filename: string;
  contentType: string;
  content: string; // Base64 encoded
  size: number;
}

export interface NormalizedEmail {
  provider: 'gmail' | 'outlook';
  messageId: string;
  threadId?: string; // Provider specific thread ID
  subject: string;
  from: { name?: string; email: string };
  to: { name?: string; email: string }[];
  cc: { name?: string; email: string }[];
  bcc: { name?: string; email: string }[];
  bodyHtml?: string;
  bodyText?: string;
  receivedAt: Date;
  inReplyTo?: string;
  references: string[];
  attachments: EmailAttachment[];
  headers: Record<string, any>;
}

// Helper to extract email and name from "Name <email@example.com>" or "email@example.com"
export const parseAddress = (raw: string): { name?: string; email: string } => {
  const match = raw.match(/(?:^"?(.*?)"?\s+)?<?([^<\s]+@[^>\s]+)>?/);
  if (match) {
    return {
      name: match[1]?.trim(),
      email: match[2],
    };
  }
  return { email: raw.trim() };
};

export const normalizeGmailPayload = (payload: any): NormalizedEmail => {
  const headers = payload.payload?.headers || [];
  const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value;

  const from = parseAddress(getHeader('From') || '');
  const to = (getHeader('To') || '').split(',').filter(Boolean).map(parseAddress);
  const cc = (getHeader('Cc') || '').split(',').filter(Boolean).map(parseAddress);
  const bcc = (getHeader('Bcc') || '').split(',').filter(Boolean).map(parseAddress);

  return {
    provider: 'gmail',
    messageId: getHeader('Message-ID') || payload.id, // Fallback to internal ID
    threadId: payload.threadId,
    subject: getHeader('Subject') || '(No Subject)',
    from,
    to,
    cc,
    bcc,
    bodyHtml: payload.snippet, // Simplified; real Gmail body parsing is complex (multipart)
    bodyText: payload.snippet,
    receivedAt: new Date(parseInt(payload.internalDate) || Date.now()),
    inReplyTo: getHeader('In-Reply-To'),
    references: (getHeader('References') || '').split(/\s+/).filter(Boolean),
    attachments: extractGmailAttachments(payload.payload?.parts || []),
    headers: headers.reduce((acc: any, h: any) => ({ ...acc, [h.name]: h.value }), {}),
  };
};

const extractGmailAttachments = (parts: any[]): EmailAttachment[] => {
  let attachments: EmailAttachment[] = [];
  for (const part of parts) {
    if (part.filename && part.body) {
      if (part.body.data) {
         attachments.push({
           filename: part.filename,
           contentType: part.mimeType,
           content: part.body.data.replace(/-/g, '+').replace(/_/g, '/'), // Convert from URL-safe to standard Base64
           size: part.body.size || 0
         });
      }
    }
    if (part.parts) {
      attachments = attachments.concat(extractGmailAttachments(part.parts));
    }
  }
  return attachments;
};

export const normalizeOutlookPayload = (payload: any): NormalizedEmail => {
  return {
    provider: 'outlook',
    messageId: payload.internetMessageId || payload.id,
    threadId: payload.conversationId,
    subject: payload.subject || '(No Subject)',
    from: { name: payload.from?.emailAddress?.name, email: payload.from?.emailAddress?.address },
    to: (payload.toRecipients || []).map((r: any) => ({ name: r.emailAddress?.name, email: r.emailAddress?.address })),
    cc: (payload.ccRecipients || []).map((r: any) => ({ name: r.emailAddress?.name, email: r.emailAddress?.address })),
    bcc: (payload.bccRecipients || []).map((r: any) => ({ name: r.emailAddress?.name, email: r.emailAddress?.address })),
    bodyHtml: payload.body?.contentType === 'html' ? payload.body?.content : undefined,
    bodyText: payload.body?.contentType === 'text' ? payload.body?.content : undefined, // Outlook might provide simplified text
    receivedAt: new Date(payload.receivedDateTime || Date.now()),
    inReplyTo: payload.internetMessageHeaders?.find((h: any) => h.name.toLowerCase() === 'in-reply-to')?.value,
    references: (payload.internetMessageHeaders?.find((h: any) => h.name.toLowerCase() === 'references')?.value || '').split(/\s+/).filter(Boolean),
    attachments: (payload.attachments || []).map((a: any) => ({
      filename: a.name,
      contentType: a.contentType,
      content: a.contentBytes,
      size: a.size
    })),
    headers: payload.internetMessageHeaders?.reduce((acc: any, h: any) => ({ ...acc, [h.name]: h.value }), {}) || {},
  };
};

export type ThreadLookup = (messageId: string) => Promise<{ id: string, conversation_id: string } | null>;

export const correlateThread = async (
  email: NormalizedEmail,
  lookupByMessageId: ThreadLookup
): Promise<{ conversationId: string, parentEmailId: string | null }> => {
  // Strategy A: Check In-Reply-To
  if (email.inReplyTo) {
    const parent = await lookupByMessageId(email.inReplyTo);
    if (parent) {
      return { conversationId: parent.conversation_id, parentEmailId: parent.id };
    }
  }

  // Strategy B: Check References (if A failed)
  if (email.references.length > 0) {
    // Check the last reference first (most likely parent)
    const lastRef = email.references[email.references.length - 1];
    const parent = await lookupByMessageId(lastRef);
    if (parent) {
      return { conversationId: parent.conversation_id, parentEmailId: parent.id };
    }
  }
  
  return { conversationId: crypto.randomUUID(), parentEmailId: null };
};
