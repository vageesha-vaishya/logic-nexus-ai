
import { SupabaseClient } from "@supabase/supabase-js";
import { Logger } from "../../_shared/logger.ts";

// @ts-ignore
declare const Deno: any;
import { ParsedEmail, ParsedAttachment } from "./parser.ts";

export type { SupabaseClient };

export interface EmailAccount {
  id: string;
  email_address: string;
  provider: string;
  password?: string; // Decrypted password for IMAP/POP3
  imap_host?: string;
  imap_port?: number;
  imap_username?: string;
  imap_password?: string;
  imap_use_ssl?: boolean;
  pop3_host?: string;
  pop3_port?: number;
  pop3_username?: string;
  pop3_password?: string;
  pop3_use_ssl?: boolean;
  pop3_delete_policy?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  user_id: string;
  tenant_id?: string;
  franchise_id?: string;
}

export interface EmailSyncLog {
    account_id: string;
    status: string;
    emails_synced: number;
    details?: any;
}

export async function uploadAttachments(
  supabase: SupabaseClient, 
  attachments: ParsedAttachment[], 
  messageId: string,
  logger?: Logger
): Promise<any[]> {
  const uploaded = [];
  
  for (const att of attachments) {
    try {
      // Sanitize filename
      const safeFilename = att.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${messageId}/${safeFilename}`;
      
      const { error } = await supabase.storage
        .from('email-attachments')
        .upload(path, att.content, {
          contentType: att.mimeType,
          upsert: true
        });
        
      if (error) {
        logger?.error(`Failed to upload attachment ${path}:`, { error });
        continue;
      }
      
      uploaded.push({
        filename: att.filename,
        path: path,
        size: att.size,
        type: att.mimeType,
        content_id: att.contentId
      });
    } catch (e) {
      logger?.error(`Error uploading attachment ${att.filename}:`, { error: e });
    }
  }
  return uploaded;
}

export async function saveSyncLog(supabase: SupabaseClient, log: EmailSyncLog) {
    await supabase.from("email_sync_logs").insert({
        account_id: log.account_id,
        status: log.status,
        emails_synced: log.emails_synced,
        details: log.details,
        started_at: new Date().toISOString(), // Assuming structure
        completed_at: new Date().toISOString()
    });
}

export async function saveEmailToDb(
  supabase: SupabaseClient, 
  account: EmailAccount, 
  email: ParsedEmail,
  folder: string = "inbox",
  direction: "inbound" | "outbound" = "inbound",
  logger?: Logger
) {
  const normalizeEmail = (v?: string) => String(v || "").trim().toLowerCase();
  const findLinkedLeadId = async (addr?: string | null) => {
    const e = normalizeEmail(addr || undefined);
    if (!e) return null;
    let query = supabase.from("leads").select("id").eq("email", e);
    if (account.tenant_id) query = query.eq("tenant_id", account.tenant_id);
    if (account.franchise_id) query = query.eq("franchise_id", account.franchise_id);
    const { data, error } = await query.limit(1);
    if (error || !data || data.length === 0) return null;
    return data[0]?.id ?? null;
  };
  // Check existence
  const { data: existing } = await supabase
    .from("emails")
    .select("id")
    .eq("message_id", email.messageId)
    .eq("account_id", account.id)
    .single();

  if (existing) {
    logger?.info(`Email ${email.messageId} already exists. Skipping.`);
    return false;
  }

  // Upload attachments first
  const storedAttachments = await uploadAttachments(supabase, email.attachments, email.messageId, logger);

  // Prepare DB payload
  const payload = {
    account_id: account.id,
    tenant_id: account.tenant_id,
    franchise_id: account.franchise_id,
    message_id: email.messageId,
    internet_message_id: email.messageId,
    conversation_id: email.references.length > 0 ? email.references[0] : (email.inReplyTo || email.messageId),
    in_reply_to: email.inReplyTo,
    email_references: email.references,
    subject: email.subject,
    from_email: email.from.email,
    from_name: email.from.name,
    to_emails: email.to,
    cc_emails: email.cc,
    bcc_emails: email.bcc,
    body_text: email.bodyText,
    body_html: email.bodyHtml || email.bodyText,
    snippet: email.snippet,
    has_attachments: storedAttachments.length > 0,
    attachments: storedAttachments,
    has_inline_images: email.hasInlineImages,
    direction: direction,
    status: direction === "outbound" ? "sent" : "received",
    is_read: false,
    folder: folder,
    received_at: email.receivedAt,
    last_sync_attempt: new Date().toISOString(),
    raw_headers: email.headers
  };

  // Auto-link to Lead by matching sender/recipient email
  try {
    let leadId: string | null = null;
    if (direction === "inbound") {
      leadId = await findLinkedLeadId(email.from?.email);
    } else {
      const toList = Array.isArray(email.to) ? email.to : [];
      for (const r of toList) {
        leadId = await findLinkedLeadId((r as any)?.email);
        if (leadId) break;
      }
    }
    if (leadId) {
      (payload as any).lead_id = leadId;
    }
  } catch (e) {
    logger?.warn("Auto-link lead failed:", { error: e });
  }

  const { error } = await supabase.from("emails").insert(payload);
  
  if (error) {
    logger?.error(`DB Insert Error for ${email.messageId}:`, { error });
    throw error;
  }
  
  return true;
}
