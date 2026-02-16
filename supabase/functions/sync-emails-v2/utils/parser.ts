import { simpleParser, Attachment } from "npm:mailparser";
type AddressVal = { name?: string; address?: string }

export interface ParsedAttachment {
  filename: string;
  contentType: string;
  mimeType: string;
  size: number;
  content: Uint8Array | string;
  contentId?: string;
}

export interface ParsedEmail {
  messageId: string;
  subject: string;
  from: { name?: string; email: string };
  to: { name?: string; email: string }[];
  cc: { name?: string; email: string }[];
  bcc: { name?: string; email: string }[];
  bodyText: string;
  bodyHtml: string;
  receivedAt: string;
  inReplyTo?: string | null;
  references: string[];
  attachments: ParsedAttachment[];
  headers?: any;
  snippet?: string;
  hasInlineImages?: boolean;
}

export async function parseEmail(source: any): Promise<ParsedEmail> {
  const parsed = await simpleParser(source);
  
  const attachments: ParsedAttachment[] = (parsed.attachments || []).map((att: Attachment) => ({
    filename: att.filename || `attachment_${Date.now()}`,
    contentType: att.contentType,
    mimeType: att.contentType,
    size: att.size,
    content: att.content,
    contentId: att.contentId
  }));

  const fromVal = parsed.from?.value?.[0];
  const toVal = parsed.to?.value || [];
  const ccVal = parsed.cc?.value || [];
  const bccVal = parsed.bcc?.value || [];

  return {
    messageId: parsed.messageId || "",
    subject: parsed.subject || "(No Subject)",
    from: { 
      name: fromVal?.name, 
      email: fromVal?.address || "" 
    },
    to: (toVal as AddressVal[]).map((v: AddressVal) => ({ name: v.name, email: v.address || "" })),
    cc: (ccVal as AddressVal[]).map((v: AddressVal) => ({ name: v.name, email: v.address || "" })),
    bcc: (bccVal as AddressVal[]).map((v: AddressVal) => ({ name: v.name, email: v.address || "" })),
    bodyText: parsed.text || "",
    bodyHtml: (parsed.html as string) || parsed.textAsHtml || "",
    receivedAt: (parsed.date || new Date()).toISOString(),
    inReplyTo: parsed.inReplyTo,
    references: typeof parsed.references === 'string' ? [parsed.references] : (parsed.references as string[]) || [],
    attachments,
    headers: parsed.headers,
    snippet: (parsed.text || "").substring(0, 200),
    hasInlineImages: (parsed.html as string || "").includes("cid:")
  };
}
