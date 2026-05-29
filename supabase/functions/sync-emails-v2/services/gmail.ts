
import { EmailAccount, saveEmailToDb, SupabaseClient, uploadAttachments } from "../utils/db.ts";
import { ParsedEmail, parseEmail } from "../utils/parser.ts";
import { Logger } from "../../_shared/logger.ts";
import {
  getEmailCredential,
  setEmailCredential,
} from "../../_shared/email-credentials.ts";

export class GmailService {
  private account: EmailAccount;
  private supabase: SupabaseClient;
  private adminSupabase?: SupabaseClient;
  private logger?: Logger;
  // Phase 1 Slice C — live access token, kept on the instance so a single
  // sync run doesn't round-trip vault for every Gmail API call. Replaces
  // the prior pattern of mutating this.account.access_token, which
  // becomes a type error once the column is dropped.
  private currentAccessToken: string | undefined;

  constructor(account: EmailAccount, supabase: SupabaseClient, adminSupabase?: SupabaseClient, logger?: Logger) {
    this.account = account;
    this.supabase = supabase;
    this.adminSupabase = adminSupabase;
    this.logger = logger;
  }

  async syncEmails(forceFullSync: boolean = false): Promise<{ syncedCount: number }> {
    this.logger?.info(`Starting Gmail sync for ${this.account.email_address}`);
    // Resolve the current access token through vault first; refresh if
    // close to expiry per the existing 5-minute window.
    await this.ensureAccessToken();

    let count = 0;
    count += await this.syncLabel("INBOX", "inbox", "inbound");
    count += await this.syncLabel("SENT", "sent", "outbound");

    return { syncedCount: count };
  }

  /**
   * Phase 1 Slice C — resolve access_token via vault on entry, then refresh
   * if expiring. The resolved value lives on this.currentAccessToken
   * (an instance field) so the per-message fetch calls keep using
   * `Authorization: Bearer …` without round-tripping vault on every
   * request. Does not mutate this.account.access_token — that column
   * is being dropped.
   */
  private async ensureAccessToken() {
    const dbClient = this.adminSupabase || this.supabase;

    const cached = await getEmailCredential(
      dbClient,
      {
        account_id: this.account.id,
        purpose:    "oauth_access_token",
        fallback:   this.account.access_token ?? null,
      },
      this.logger,
    );
    if (cached) this.currentAccessToken = cached;

    if (this.currentAccessToken && this.account.token_expires_at) {
      if (new Date(this.account.token_expires_at).getTime() - Date.now() > 5 * 60 * 1000) return;
    }
    await this.refreshAccessToken(dbClient);
  }

  private async refreshAccessToken(dbClient: SupabaseClient) {
    this.logger?.info("Refreshing Gmail access token...");

    const { data: oauthCfg } = await dbClient
        .from("oauth_configurations")
        .select("client_id, client_secret")
        .eq("provider", "gmail")
        .eq("user_id", this.account.user_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    const refreshToken = await getEmailCredential(
      dbClient,
      {
        account_id: this.account.id,
        purpose:    "oauth_refresh_token",
        fallback:   this.account.refresh_token ?? null,
      },
      this.logger,
    );
    if (!oauthCfg || !refreshToken) {
      throw new Error("Cannot refresh token: missing config or refresh token");
    }

    const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: oauthCfg.client_id,
            client_secret: oauthCfg.client_secret,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        })
    });

    if (!resp.ok) throw new Error(`Token refresh failed: ${await resp.text()}`);

    const data = await resp.json();
    const newAccess = data.access_token;
    const expiresIn = data.expires_in || 3600;
    const expiryIso = new Date(Date.now() + expiresIn * 1000).toISOString();

    await setEmailCredential(
      dbClient,
      {
        account_id:  this.account.id,
        purpose:     "oauth_access_token",
        value:       newAccess,
        tenant_id:   (this.account as any).tenant_id ?? null,
        expires_at:  expiryIso,
      },
      this.logger,
    );
    await dbClient
        .from("email_accounts")
        .update({ token_expires_at: expiryIso })
        .eq("id", this.account.id);

    this.currentAccessToken = newAccess;
    this.account.token_expires_at = expiryIso;
  }

  private async syncLabel(labelId: string, folder: string, direction: "inbound" | "outbound"): Promise<number> {
    // Max 20 messages for now
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=${labelId}`;
    const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${this.currentAccessToken}` }
    });
    
    if (!resp.ok) {
        if (resp.status === 401) {
            await this.ensureAccessToken();
            // Retry once
             const retryResp = await fetch(url, {
                headers: { Authorization: `Bearer ${this.currentAccessToken}` }
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
    
    this.logger?.info(`Processing ${messages.length} messages for ${folder}`);
    
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
                { headers: { Authorization: `Bearer ${this.currentAccessToken}` } }
            );
            
            if (!resp.ok) continue;
            
            const msgData = await resp.json();
            await this.saveGmailMessage(msgData, folder, direction);
            savedCount++;
        } catch (e) {
            this.logger?.error(`Error processing Gmail message ${msgStub.id}:`, { error: e });
        }
    }
    
    if (skippedCount > 0) {
        this.logger?.info(`Skipped ${skippedCount} existing messages for ${folder}`);
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
     
     await saveEmailToDb(this.supabase, this.account, parsedEmail, folder, direction, this.logger);
  }
}
