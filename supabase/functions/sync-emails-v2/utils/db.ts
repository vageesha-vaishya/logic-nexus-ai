
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
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

export function getSupabaseClient(req?: Request): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  
  if (!url || !serviceKey || !anonKey) throw new Error("Missing Supabase env vars");

  const authHeader = req?.headers.get('Authorization');

  // If the caller provides the Service Role Key in the header, use it (System Context)
  if (authHeader && authHeader.includes(serviceKey)) {
     return createClient(url, serviceKey);
  }
  
  // Otherwise, use Anon Key + Auth Header (User Context)
  return createClient(url, anonKey, {
    global: {
      headers: { Authorization: authHeader || '' },
    },
  });
}

export function getAdminSupabaseClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!url || !serviceKey) throw new Error("Missing Supabase env vars");

  return createClient(url, serviceKey);
}

export async function uploadAttachments(
  supabase: SupabaseClient, 
  attachments: ParsedAttachment[], 
  messageId: string
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
        console.error(`Failed to upload attachment ${path}:`, error);
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
      console.error(`Error uploading attachment ${att.filename}:`, e);
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
  direction: "inbound" | "outbound" = "inbound"
) {
  // Check existence
  const { data: existing } = await supabase
    .from("emails")
    .select("id")
    .eq("message_id", email.messageId)
    .eq("account_id", account.id)
    .single();

  if (existing) {
    console.log(`Email ${email.messageId} already exists. Skipping.`);
    return false;
  }

  // Upload attachments first
  const storedAttachments = await uploadAttachments(supabase, email.attachments, email.messageId);

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

  const { error } = await supabase.from("emails").insert(payload);
  
  if (error) {
    console.error(`DB Insert Error for ${email.messageId}:`, error);
    throw error;
  }
  
  return true;
}
