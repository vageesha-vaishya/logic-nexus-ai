
import { EmailAccount, saveEmailToDb, SupabaseClient, uploadAttachments } from "../utils/db.ts";
import { ParsedEmail, ParsedAttachment } from "../utils/parser.ts";

export class GmailService {
  private account: EmailAccount;
  private supabase: SupabaseClient;

  constructor(account: EmailAccount, supabase: SupabaseClient) {
    this.account = account;
    this.supabase = supabase;
  }

  async sync() {
    console.log(`Starting Gmail sync for ${this.account.email_address}`);
    await this.refreshAccessTokenIfNeeded();
    
    await this.syncLabel("INBOX", "inbox", "inbound");
    await this.syncLabel("SENT", "sent", "outbound");
  }

  private async refreshAccessTokenIfNeeded() {
    if (this.account.access_token && this.account.token_expires_at) {
        // Refresh if expiring in less than 5 minutes
        if (new Date(this.account.token_expires_at).getTime() - Date.now() > 5 * 60 * 1000) return;
    }
    
    console.log("Refreshing Gmail access token...");
    
    // Get OAuth config
    const { data: oauthCfg } = await this.supabase
        .from("oauth_configurations")
        .select("client_id, client_secret")
        .eq("provider", "gmail")
        .eq("user_id", this.account.user_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
        
    if (!oauthCfg || !this.account.refresh_token) {
        throw new Error("Cannot refresh token: missing config or refresh token");
    }
    
    const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: oauthCfg.client_id,
            client_secret: oauthCfg.client_secret,
            grant_type: "refresh_token",
            refresh_token: this.account.refresh_token
        })
    });
    
    if (!resp.ok) throw new Error(`Token refresh failed: ${await resp.text()}`);
    
    const data = await resp.json();
    const newAccess = data.access_token;
    const expiresIn = data.expires_in || 3600;
    const expiryIso = new Date(Date.now() + expiresIn * 1000).toISOString();
    
    await this.supabase
        .from("email_accounts")
        .update({ access_token: newAccess, token_expires_at: expiryIso })
        .eq("id", this.account.id);
        
    this.account.access_token = newAccess;
    this.account.token_expires_at = expiryIso;
  }

  private async syncLabel(labelId: string, folder: string, direction: "inbound" | "outbound") {
    // Max 20 messages for now
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=${labelId}`;
    const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${this.account.access_token}` }
    });
    
    if (!resp.ok) {
        if (resp.status === 401) {
            await this.refreshAccessTokenIfNeeded();
            // Retry once
             const retryResp = await fetch(url, {
                headers: { Authorization: `Bearer ${this.account.access_token}` }
            });
            if (!retryResp.ok) throw new Error(`Gmail API error: ${await retryResp.text()}`);
             // Process retryResp
             const data = await retryResp.json();
             await this.processMessageList(data.messages, folder, direction);
             return;
        }
        throw new Error(`Gmail API error: ${await resp.text()}`);
    }
    
    const data = await resp.json();
    await this.processMessageList(data.messages, folder, direction);
  }

  private async processMessageList(messages: any[], folder: string, direction: "inbound" | "outbound") {
    if (!messages || messages.length === 0) return;
    
    console.log(`Processing ${messages.length} messages for ${folder}`);
    
    for (const msgStub of messages) {
        try {
             // Check if exists first to save API calls
            const { data: existing } = await this.supabase
                .from("emails")
                .select("id")
                .eq("message_id", msgStub.id)
                .eq("account_id", this.account.id)
                .single();
                
            if (existing) continue;

            const resp = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgStub.id}?format=full`,
                { headers: { Authorization: `Bearer ${this.account.access_token}` } }
            );
            
            if (!resp.ok) continue;
            
            const msgData = await resp.json();
            await this.saveGmailMessage(msgData, folder, direction);
        } catch (e) {
            console.error(`Error processing Gmail message ${msgStub.id}:`, e);
        }
    }
  }

  private async saveGmailMessage(msgData: any, folder: string, direction: "inbound" | "outbound") {
     const headers = (msgData.payload.headers as any[]).reduce((acc, h) => {
         acc[h.name.toLowerCase()] = h.value;
         return acc;
     }, {} as Record<string, string>);
     
     const messageId = headers["message-id"] || msgData.id;
     const subject = headers.subject || "(No Subject)";
     const date = headers.date || new Date().toISOString();
     const fromStr = headers.from || "";
     const from = {
         email: fromStr.match(/<(.+)>/)?.[1] || fromStr,
         name: fromStr.replace(/<.+>/, "").trim()
     };
     
     // Helper to parse recipients
     const parseRecipients = (str: string) => {
         if (!str) return [];
         return str.split(',').map(s => {
             const email = s.match(/<(.+)>/)?.[1] || s.trim();
             const name = s.replace(/<.+>/, "").trim();
             return { email, name };
         });
     };
     
     const to = parseRecipients(headers.to);
     const cc = parseRecipients(headers.cc);
     const bcc = parseRecipients(headers.bcc);
     
     const references = headers.references ? headers.references.split(/\s+/).map((r: string) => r.replace(/[<>]/g, "")) : [];
     const inReplyTo = headers["in-reply-to"] ? headers["in-reply-to"].replace(/[<>]/g, "") : null;
     
     // Extract body and attachments
     let bodyText = "";
     let bodyHtml = "";
     const attachments: ParsedAttachment[] = [];
     
     const processPart = async (part: any) => {
         if (part.mimeType === "text/plain" && part.body.data) {
             bodyText += this.decodeBase64(part.body.data);
         } else if (part.mimeType === "text/html" && part.body.data) {
             bodyHtml += this.decodeBase64(part.body.data);
         } else if (part.filename && part.body.attachmentId) {
             // Fetch attachment
             const attContent = await this.fetchAttachment(msgData.id, part.body.attachmentId);
             if (attContent) {
                 attachments.push({
                     filename: part.filename,
                     content: attContent,
                     mimeType: part.mimeType,
                     contentId: part.headers?.find((h: any) => h.name.toLowerCase() === "content-id")?.value || null,
                     size: part.body.size
                 });
             }
         }
         
         if (part.parts) {
             for (const subPart of part.parts) {
                 await processPart(subPart);
             }
         }
     };
     
     if (msgData.payload) {
         await processPart(msgData.payload);
     }
     
     const parsedEmail: ParsedEmail = {
         messageId,
         subject,
         from,
         to,
         cc,
         bcc,
         bodyText,
         bodyHtml,
         receivedAt: new Date(date).toISOString(),
         inReplyTo,
         references,
         attachments,
         headers,
         snippet: msgData.snippet || "",
         hasInlineImages: bodyHtml.includes("cid:") || bodyHtml.includes("data:image/")
     };
     
     await saveEmailToDb(this.supabase, this.account, parsedEmail, folder, direction);
  }
  
  private decodeBase64(data: string): string {
      // Gmail uses URL-safe base64
      const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
      return atob(base64);
  }
  
  private async fetchAttachment(messageId: string, attachmentId: string): Promise<Uint8Array | null> {
      try {
          const resp = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
              { headers: { Authorization: `Bearer ${this.account.access_token}` } }
          );
          
          if (!resp.ok) return null;
          
          const data = await resp.json();
          if (data.data) {
              const base64 = data.data.replace(/-/g, '+').replace(/_/g, '/');
              const binaryString = atob(base64);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
              }
              return bytes;
          }
          return null;
      } catch (e) {
          console.error("Error fetching attachment:", e);
          return null;
      }
  }
}
