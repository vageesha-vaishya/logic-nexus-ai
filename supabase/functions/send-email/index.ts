import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface EmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string; // Optional if using template
  body?: string;    // Optional if using template
  attachments?: unknown[];
  from?: string;
  replyTo?: string;
  templateId?: string;
  variables?: Record<string, string>;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  verified?: boolean;
  verificationMethod?: string;
}

export interface ProviderConfig {
  apiKey?: string;
  supabase: SupabaseClient;
  account?: any; // DB row for email_accounts
}

export abstract class EmailProvider {
  constructor(protected config: ProviderConfig) {}
  abstract send(req: EmailRequest): Promise<EmailResponse>;
}

// --- Resend Provider (System/Transactional) ---
export class ResendProvider extends EmailProvider {
  async send(req: EmailRequest): Promise<EmailResponse> {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new Error("Missing RESEND_API_KEY");

    console.log("Sending via Resend API (System)");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: req.from || "SOS Logistics <notifications@soslogistics.pro>",
        to: req.to,
        cc: req.cc,
        bcc: req.bcc,
        subject: req.subject,
        html: req.body,
        reply_to: req.replyTo,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to send via Resend");
    }

    return {
      success: true,
      messageId: data.id,
      verified: true,
      verificationMethod: "resend_api",
    };
  }
}

// --- Gmail Provider (User/OAuth) ---
export class GmailProvider extends EmailProvider {
  async send(req: EmailRequest): Promise<EmailResponse> {
    console.log("Sending via Gmail API");
    const account = this.config.account;
    const supabase = this.config.supabase;

    if (!account.access_token) {
      throw new Error("Gmail account not connected.");
    }

    // Token Refresh Logic
    let accessToken = account.access_token;
    if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
      console.log("Refreshing Gmail token...");
      if (!account.refresh_token) throw new Error("Gmail token expired and no refresh token.");

      const { data: oauthConfig } = await supabase
        .from("oauth_configurations")
        .select("client_id, client_secret")
        .eq("user_id", account.user_id)
        .eq("provider", "gmail")
        .eq("is_active", true)
        .single();

      if (!oauthConfig) throw new Error("OAuth config not found for Gmail.");

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: oauthConfig.client_id,
          client_secret: oauthConfig.client_secret,
          refresh_token: account.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (!tokenResponse.ok) throw new Error("Failed to refresh Gmail token.");

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;

      await supabase
        .from("email_accounts")
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        })
        .eq("id", account.id);
    }

    // Resolve Sender
    let senderEmail = account.email_address;
    if (!senderEmail) {
      // Try to fetch profile if email is missing
      try {
        const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (profileRes.ok) {
          const p = await profileRes.json();
          senderEmail = p.email;
        }
      } catch (e) { console.error("Error resolving Gmail address", e); }
    }

    // Construct MIME
    const boundary = `mixed_boundary_${Date.now()}`;
    const messageLines = [
      senderEmail ? `From: ${senderEmail}` : "",
      `To: ${req.to.join(", ")}`,
      req.cc?.length ? `Cc: ${req.cc.join(", ")}` : "",
      `Subject: ${req.subject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      "",
      (req.body || "").replace(/<[^>]+>/g, ""),
      "",
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      "",
      req.body,
      "",
      `--${boundary}--`
    ].filter(l => l !== undefined);

    const encodedMessage = btoa(unescape(encodeURIComponent(messageLines.join("\r\n"))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedMessage }),
    });

    if (!gmailRes.ok) {
      const txt = await gmailRes.text();
      throw new Error(`Gmail API Error: ${txt}`);
    }

    const gmailData = await gmailRes.json();
    return {
      success: true,
      messageId: gmailData.id,
      verified: true
    };
  }
}

// --- Office 365 Provider (User/OAuth) ---
export class Office365Provider extends EmailProvider {
  async send(req: EmailRequest): Promise<EmailResponse> {
    console.log("Sending via Microsoft Graph API");
    const account = this.config.account;
    const supabase = this.config.supabase;

    if (!account.access_token) throw new Error("Office 365 account not connected.");

    let accessToken = account.access_token;
    if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
      console.log("Refreshing Office 365 token...");
      if (!account.refresh_token) throw new Error("Office 365 token expired and no refresh token.");

      const { data: oauthConfig } = await supabase
        .from("oauth_configurations")
        .select("client_id, client_secret, tenant_id_provider")
        .eq("user_id", account.user_id)
        .eq("provider", "office365")
        .eq("is_active", true)
        .single();

      if (!oauthConfig) throw new Error("OAuth config not found for Office 365.");

      const lowerEmail = String(account.email_address || "").toLowerCase();
      const isMSA = /@(hotmail|outlook|live|msn)\.com$/.test(lowerEmail);
      const tenantId = isMSA ? "consumers" : (oauthConfig.tenant_id_provider || "common");

      const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: oauthConfig.client_id,
          client_secret: oauthConfig.client_secret,
          refresh_token: account.refresh_token,
          grant_type: "refresh_token",
          scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.ReadWrite offline_access openid profile email",
        }),
      });

      if (!tokenResponse.ok) throw new Error("Failed to refresh Office 365 token.");

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;

      await supabase
        .from("email_accounts")
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
        })
        .eq("id", account.id);
    }

    const sendBody = {
      message: {
        subject: req.subject,
        body: { contentType: "HTML", content: req.body },
        toRecipients: req.to.map(addr => ({ emailAddress: { address: addr } })),
        ccRecipients: req.cc?.map(addr => ({ emailAddress: { address: addr } })) || [],
        bccRecipients: req.bcc?.map(addr => ({ emailAddress: { address: addr } })) || [],
      },
      saveToSentItems: true,
    };

    const graphRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendBody),
    });

    if (!graphRes.ok) {
      const txt = await graphRes.text();
      throw new Error(`Office 365 API Error: ${txt}`);
    }

    return {
      success: true,
      messageId: `o365-${Date.now()}`,
      verified: true
    };
  }
}

// --- Helpers ---

export async function processTemplate(supabase: SupabaseClient, templateId: string, variables?: Record<string, string>) {
  const { data: template, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (error || !template) throw new Error(`Template not found: ${error?.message}`);

  let subject = template.subject;
  let body = template.body_html || template.body_text;

  if (variables) {
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    });
  }

  return { subject, body };
}

// --- Main Handler ---

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    const { 
      accountId, 
      to, cc, bcc, 
      subject: reqSubject, 
      body: reqBody, 
      from, reply_to, 
      provider: requestedProvider,
      templateId,
      variables 
    } = payload;

    if (!to) throw new Error("Missing required field: to");

    // 1. Process Template if present
    let subject = reqSubject;
    let body = reqBody;

    if (templateId) {
      const templateData = await processTemplate(supabase, templateId, variables);
      subject = templateData.subject;
      body = templateData.body;
    }

    if (!subject) throw new Error("Missing required field: subject (or valid template)");

    // 2. Determine Provider Strategy
    let providers: EmailProvider[] = [];
    let account = null;

    if (requestedProvider === 'resend' || (!accountId && !requestedProvider)) {
      // System Email Strategy - Support Failover in future by adding more providers to this array
      providers.push(new ResendProvider({
        apiKey: Deno.env.get("RESEND_API_KEY"),
        supabase
      }));
    } else if (accountId) {
      // User Account Strategy
      const { data, error } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("id", accountId)
        .single();
      
      if (error || !data) throw new Error("Email account not found");
      account = data;

      if (account.provider === "gmail") {
        providers.push(new GmailProvider({ supabase, account }));
      } else if (account.provider === "office365") {
        providers.push(new Office365Provider({ supabase, account }));
      } else if (account.provider === "smtp_imap") {
         throw new Error("Direct SMTP not supported in Edge Runtime. Use Resend or OAuth.");
      } else {
        throw new Error(`Unknown provider: ${account.provider}`);
      }
    } else {
      throw new Error("Invalid request: Provide accountId or provider='resend'");
    }

    // 3. Execute Send with Failover/Retry Logic
    let response: EmailResponse | null = null;
    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        response = await provider.send({
          to: Array.isArray(to) ? to : [to],
          cc: cc ? (Array.isArray(cc) ? cc : [cc]) : [],
          bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [],
          subject,
          body,
          from,
          replyTo: reply_to
        });
        if (response.success) break; // Success, stop trying
      } catch (e: any) {
        console.error("Provider send failed:", e);
        lastError = e;
        // Continue to next provider if available
      }
    }

    if (!response && lastError) throw lastError;
    if (!response) throw new Error("Unknown error: No response from providers");

    // 4. Log to DB (if linked to an account)
    if (account && response.success) {
      await supabase.from("emails").insert({
        account_id: account.id,
        tenant_id: account.tenant_id,
        franchise_id: account.franchise_id,
        message_id: response.messageId || `sent-${Date.now()}`,
        subject,
        from_email: account.email_address,
        from_name: account.display_name,
        to_emails: (Array.isArray(to) ? to : [to]).map(e => ({ email: e })),
        cc_emails: cc ? (Array.isArray(cc) ? cc : [cc]).map(e => ({ email: e })) : [],
        bcc_emails: bcc ? (Array.isArray(bcc) ? bcc : [bcc]).map(e => ({ email: e })) : [],
        body_text: body.replace(/<[^>]+>/g, ""),
        body_html: body,
        direction: "outbound",
        status: "sent",
        folder: "sent",
        sent_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Email Send Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
