
import PostalMime from "https://esm.sh/postal-mime@2.2.0";

export interface ParsedEmail {
  messageId: string;
  subject: string;
  from: { email: string; name: string };
  to: { email: string; name: string }[];
  cc: { email: string; name: string }[];
  bcc: { email: string; name: string }[];
  bodyText: string;
  bodyHtml: string;
  receivedAt: string;
  inReplyTo: string | null;
  references: string[];
  attachments: ParsedAttachment[];
  headers: Record<string, string>;
  snippet: string;
  hasInlineImages: boolean;
}

export interface ParsedAttachment {
  filename: string;
  content: Uint8Array;
  mimeType: string;
  contentId: string | null;
  size: number;
}

export async function parseEmail(raw: string | Uint8Array, fallbackId?: string): Promise<ParsedEmail> {
  const parser = new PostalMime();
  const parsed = await parser.parse(raw);
  
  const headers = parsed.headers || [];
  const getHeader = (key: string) => {
    if (Array.isArray(headers)) {
      return headers.find((h: any) => h.key.toLowerCase() === key.toLowerCase())?.value;
    }
    return null;
  };

  const normalizeEmail = (addr: string) => String(addr || "").trim().toLowerCase();
  
  const messageId = parsed.messageId 
    ? String(parsed.messageId).replace(/[<>]/g, "") 
    : (getHeader("message-id") ? String(getHeader("message-id")).replace(/[<>]/g, "") : (fallbackId || `unknown-${Date.now()}`));

  const subject = parsed.subject || getHeader("subject") || "(No Subject)";

  const fromObj = parsed.from;
  const from = {
    email: normalizeEmail(fromObj?.address || getHeader("from") || ""),
    name: (fromObj?.name || "").trim() || normalizeEmail(fromObj?.address || "")
  };

  const mapRecipients = (list: any[]) => (list || [])
    .map((v: any) => ({ 
      email: normalizeEmail(v.address || ""), 
      name: (v.name || "").trim() || undefined 
    }))
    .filter((v: any) => v.email)
    .map((v: any) => ({ email: v.email, name: v.name || v.email }));

  const to = mapRecipients(parsed.to || []);
  const cc = mapRecipients(parsed.cc || []);
  const bcc = mapRecipients(parsed.bcc || []);

  const bodyText = (parsed.text || "").trim();
  const bodyHtml = typeof parsed.html === "string" ? parsed.html : "";
  
  const dateHeader = parsed.date || getHeader("date");
  const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();

  const inReplyTo = parsed.inReplyTo 
    ? String(parsed.inReplyTo).replace(/[<>]/g, "") 
    : (getHeader("in-reply-to") ? String(getHeader("in-reply-to")).replace(/[<>]/g, "") : null);

  const referencesRaw = parsed.references || getHeader("references");
  const references = Array.isArray(referencesRaw) 
    ? referencesRaw.map((r: string) => r.replace(/[<>]/g, "")).filter(Boolean)
    : (typeof referencesRaw === "string" 
        ? referencesRaw.split(/\s+/).map((s: string) => s.replace(/[<>]/g, "")).filter(Boolean)
        : []);

  const attachments: ParsedAttachment[] = [];
  if (parsed.attachments && Array.isArray(parsed.attachments)) {
    for (const att of parsed.attachments) {
        if (att.content) {
            attachments.push({
                filename: att.filename || "attachment",
                content: att.content as Uint8Array,
                mimeType: att.mimeType || "application/octet-stream",
                contentId: att.contentId || null,
                size: att.content.length
            });
        }
    }
  }

  const hasInlineImages = !!(bodyHtml.includes("cid:") || bodyHtml.includes("data:image/"));
  const snippet = bodyText.substring(0, 200);

  // Convert headers to Record<string, string>
  const headerRecord: Record<string, string> = {};
  if (Array.isArray(headers)) {
    headers.forEach((h: any) => {
        if (h.key && h.value) headerRecord[h.key.toLowerCase()] = h.value;
    });
  }

  return {
    messageId,
    subject,
    from,
    to,
    cc,
    bcc,
    bodyText,
    bodyHtml,
    receivedAt,
    inReplyTo,
    references,
    attachments,
    headers: headerRecord,
    snippet,
    hasInlineImages
  };
}
