
import { EmailAccount, saveEmailToDb, SupabaseClient, uploadAttachments } from "../utils/db.ts";
import { ParsedEmail, parseEmail } from "../utils/parser.ts";

export class GmailService {
  private account: EmailAccount;
  private supabase: SupabaseClient;
  private adminSupabase?: SupabaseClient;

  constructor(account: EmailAccount, supabase: SupabaseClient, adminSupabase?: SupabaseClient) {
    this.account = account;
    this.supabase = supabase;
    this.adminSupabase = adminSupabase;
  }

  async syncEmails(forceFullSync: boolean = false): Promise<{ syncedCount: number }> {
    console.log(`Starting Gmail sync for ${this.account.email_address}`);
    await this.refreshAccessTokenIfNeeded();
    
    let count = 0;
    count += await this.syncLabel("INBOX", "inbox", "inbound");
    count += await this.syncLabel("SENT", "sent", "outbound");

    return { syncedCount: count };
  }

  private async refreshAccessTokenIfNeeded() {
    if (this.account.access_token && this.account.token_expires_at) {
        // Refresh if expiring in less than 5 minutes
        if (new Date(this.account.token_expires_at).getTime() - Date.now() > 5 * 60 * 1000) return;
    }
    
    console.log("Refreshing Gmail access token...");
    
    // Get OAuth config
    // Use admin client if available to ensure we can read secrets
    const dbClient = this.adminSupabase || this.supabase;

    const { data: oauthCfg } = await dbClient
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
    
    await dbClient
        .from("email_accounts")
        .update({ access_token: newAccess, token_expires_at: expiryIso })
        .eq("id", this.account.id);
        
    this.account.access_token = newAccess;
    this.account.token_expires_at = expiryIso;
  }

  private async syncLabel(labelId: string, folder: string, direction: "inbound" | "outbound"): Promise<number> {
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
             return await this.processMessageList(data.messages, folder, direction);
        }
        throw new Error(`Gmail API error: ${await resp.text()}`);
    }
    
    const data = await resp.json();
    return await this.processMessageList(data.messages, folder, direction);
  }

  private async processMessageList(messages: any[], folder: string, direction: "inbound" | "outbound"): Promise<number> {
    if (!messages || messages.length === 0) return 0;
    
    console.log(`Processing ${messages.length} messages for ${folder}`);
    
    let savedCount = 0;
    let skippedCount = 0;

    for (const msgStub of messages) {
        try {
            // Check if exists first to save API calls
            const { data: existing } = await this.supabase
                .from("emails")
                .select("id")
                .eq("message_id", msgStub.id)
                .eq("account_id", this.account.id)
                .single();
                
            if (existing) {
                skippedCount++;
                continue;
            }

            const resp = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgStub.id}?format=raw`,
                { headers: { Authorization: `Bearer ${this.account.access_token}` } }
            );
            
            if (!resp.ok) continue;
            
            const msgData = await resp.json();
            await this.saveGmailMessage(msgData, folder, direction);
            savedCount++;
        } catch (e) {
            console.error(`Error processing Gmail message ${msgStub.id}:`, e);
        }
    }
    
    if (skippedCount > 0) {
        console.log(`Skipped ${skippedCount} existing messages for ${folder}`);
    }
    
    return savedCount;
  }

  private async saveGmailMessage(msgData: any, folder: string, direction: "inbound" | "outbound") {
     // msgData.raw is base64url encoded
     const rawBase64 = msgData.raw.replace(/-/g, '+').replace(/_/g, '/');
     const binaryString = atob(rawBase64);
     const bytes = new Uint8Array(binaryString.length);
     for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
     }

     const parsedEmail: ParsedEmail = await parseEmail(bytes);
     
     // Override messageId if needed (Gmail provides a stable ID)
     if (!parsedEmail.messageId || parsedEmail.messageId.trim() === "") {
        parsedEmail.messageId = msgData.id;
     }

     // Ensure snippet is present if parser missed it
     if (!parsedEmail.snippet && msgData.snippet) {
        parsedEmail.snippet = msgData.snippet;
     }
     
     await saveEmailToDb(this.supabase, this.account, parsedEmail, folder, direction);
  }
}
