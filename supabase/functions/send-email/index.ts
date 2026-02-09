declare const Deno: {
  env: { get(name: string): string | undefined };
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.7";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

export interface EmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string; // Optional if using template
  body?: string;    // Optional if using template
  text?: string;
  attachments?: {
    filename: string;
    path?: string;
    contentType: string;
    content?: string; // Base64
  }[];
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
  adminSupabase?: SupabaseClient; // Added for privileged operations like token refresh
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

    const sendEmail = async (fromEmail: string) => {
        const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            from: fromEmail,
            to: req.to,
            cc: req.cc,
            bcc: req.bcc,
            subject: req.subject,
            html: req.body,
            text: req.text,
            reply_to: req.replyTo,
            attachments: req.attachments?.map(a => ({
            filename: a.filename,
            content: a.content,
            })),
        }),
        });
        return res;
    };

    let res = await sendEmail(req.from || "SOS Logistics <notifications@soslogistics.pro>");
    let data = await res.json();

    // Fallback for unverified domains: Try onboarding@resend.dev
    if (!res.ok && data.message?.includes("domain is not verified")) {
        console.warn("Domain not verified. Retrying with onboarding@resend.dev");
        res = await sendEmail("SOS Logistics <onboarding@resend.dev>");
        data = await res.json();
    }

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
    const supabase = this.config.adminSupabase || this.config.supabase;

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
    const hasAttachments = req.attachments && req.attachments.length > 0;
    const boundary = `mixed_boundary_${Date.now()}`;
    const altBoundary = `alt_boundary_${Date.now()}`;
    const replyTo = req.replyTo || "";
    const unsubscribeEmail = Deno.env.get("EMAIL_UNSUBSCRIBE_MAILTO") || "unsubscribe@soslogistics.pro";
    const unsubscribeUrl = req.variables?.unsubscribe_url || Deno.env.get("EMAIL_UNSUBSCRIBE_URL") || "";
    const listUnsubscribe = [
      unsubscribeEmail ? `<mailto:${unsubscribeEmail}>` : "",
      unsubscribeUrl ? `<${unsubscribeUrl}>` : "",
    ].filter(Boolean).join(", ");
    
    let messageLines = [
      senderEmail ? `From: ${account.display_name ? `"${account.display_name}" <${senderEmail}>` : senderEmail}` : "",
      `To: ${req.to.join(", ")}`,
      req.cc?.length ? `Cc: ${req.cc.join(", ")}` : "",
      `Subject: ${req.subject}`,
      replyTo ? `Reply-To: ${replyTo}` : "",
      listUnsubscribe ? `List-Unsubscribe: ${listUnsubscribe}` : "",
      unsubscribeUrl ? `List-Unsubscribe-Post: List-Unsubscribe=One-Click` : "",
      "MIME-Version: 1.0",
      `Content-Type: multipart/${hasAttachments ? 'mixed' : 'alternative'}; boundary="${boundary}"`,
      "",
      `--${boundary}`,
    ];

    if (hasAttachments) {
       // Start alternative part
       messageLines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
       messageLines.push("");
       messageLines.push(`--${altBoundary}`);
    }

    // Text Body
    messageLines.push(`Content-Type: text/plain; charset=UTF-8`);
    messageLines.push("");
    messageLines.push(req.text || (req.body || "").replace(/<[^>]+>/g, ""));
    messageLines.push("");
    
    // HTML Body
    messageLines.push(`--${hasAttachments ? altBoundary : boundary}`);
    messageLines.push(`Content-Type: text/html; charset=UTF-8`);
    messageLines.push("");
    messageLines.push(req.body || "");
    messageLines.push("");
    
    if (hasAttachments) {
      messageLines.push(`--${altBoundary}--`);
      messageLines.push("");
      
      // Add attachments
      for (const att of req.attachments!) {
        messageLines.push(`--${boundary}`);
        messageLines.push(`Content-Type: ${att.contentType}; name="${att.filename}"`);
        messageLines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
        messageLines.push(`Content-Transfer-Encoding: base64`);
        messageLines.push("");
        messageLines.push(att.content!); 
        messageLines.push("");
      }
    }
    
    messageLines.push(`--${boundary}--`);
    messageLines = messageLines.filter(l => l !== undefined);

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

// --- SMTP Provider (User/Credentials) ---
export class SMTPProvider extends EmailProvider {
  async send(req: EmailRequest): Promise<EmailResponse> {
    console.log("Sending via SMTP");
    const account = this.config.account;

    if (!account.smtp_host || !account.smtp_username || !account.smtp_password) {
      throw new Error("SMTP settings incomplete.");
    }

    const transporter = nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port || 587,
      secure: account.smtp_port === 465, // true for 465, false for other ports
      auth: {
        user: account.smtp_username,
        pass: account.smtp_password,
      },
      tls: {
          rejectUnauthorized: false // Often needed for self-signed certs or some providers
      }
    });

    // Resolve Sender
    const senderEmail = account.email_address || account.smtp_username;
    const from = req.from || (account.display_name ? `"${account.display_name}" <${senderEmail}>` : senderEmail);

    try {
      const info = await transporter.sendMail({
        from: from,
        to: req.to,
        cc: req.cc,
        bcc: req.bcc,
        replyTo: req.replyTo,
        subject: req.subject,
        text: req.text,
        html: req.body,
        attachments: req.attachments?.map(a => ({
          filename: a.filename,
          content: a.content,
          encoding: 'base64',
          contentType: a.contentType
        }))
      });

      console.log("SMTP sent:", info.messageId);

      return {
        success: true,
        messageId: info.messageId,
        verified: true,
        verificationMethod: "smtp"
      };
    } catch (error: any) {
      console.error("SMTP Error:", error);
      throw new Error(`SMTP Error: ${error.message}`);
    }
  }
}

// --- Office 365 Provider (User/OAuth) ---
export class Office365Provider extends EmailProvider {
  async send(req: EmailRequest): Promise<EmailResponse> {
    console.log("Sending via Microsoft Graph API");
    const account = this.config.account;
    const supabase = this.config.adminSupabase || this.config.supabase;

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
        replyTo: req.replyTo ? [{ emailAddress: { address: req.replyTo } }] : [],
        toRecipients: req.to.map(addr => ({ emailAddress: { address: addr } })),
        ccRecipients: req.cc?.map(addr => ({ emailAddress: { address: addr } })) || [],
        bccRecipients: req.bcc?.map(addr => ({ emailAddress: { address: addr } })) || [],
        attachments: req.attachments?.map(a => ({
          "@odata.type": "#microsoft.graph.fileAttachment",
          "name": a.filename,
          "contentType": a.contentType,
          "contentBytes": a.content
        })) || []
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

async function prepareAttachments(supabase: SupabaseClient, attachments: any[]) {
  if (!attachments || attachments.length === 0) return [];
  
  const processed = [];
  for (const att of attachments) {
    if (att.content) {
      processed.push(att); // Already base64
      continue;
    }
    
    if (att.path) {
      const { data, error } = await supabase.storage
        .from('email-attachments')
        .download(att.path);
        
      if (error) {
        console.error(`Failed to download attachment ${att.path}:`, error);
        continue;
      }
      
      const buffer = await data.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      
      processed.push({
        filename: att.filename,
        contentType: att.contentType,
        content: base64
      });
    }
  }
  return processed;
}

function stripHtmlToText(input: string) {
  const normalized = String(input || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const withoutScripts = normalized
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  const withBreaks = withoutScripts
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<\/div\s*>/gi, "\n")
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<\/h[1-6]\s*>/gi, "\n\n");
  const withoutTags = withBreaks.replace(/<[^>]+>/g, "");
  const decoded = withoutTags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
  return decoded.replace(/\n{3,}/g, "\n\n").trim();
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeInnerHtml(body: string) {
  const raw = String(body || "").trim();
  if (!raw) return "";
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(raw);
  if (looksLikeHtml) return raw;
  return escapeHtml(raw).replace(/\n/g, "<br>");
}

function rewriteLinks(html: string, trackingBase: string, emailId: string): string {
  if (!trackingBase || !emailId) return html;
  const baseUrl = trackingBase.replace(/\/$/, "");
  
  return html.replace(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi, (match, quote, url) => {
    // Skip anchors, mailto, tel, and already tracked links
    if (url.startsWith("#") || url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith(baseUrl)) {
      return match;
    }
    const trackingUrl = `${baseUrl}/click?id=${encodeURIComponent(emailId)}&url=${encodeURIComponent(url)}`;
    return match.replace(url, trackingUrl);
  });
}

function renderBrandedEmail(params: {
  subject: string;
  innerHtml: string;
  innerText: string;
  to: string[];
  fromLabel?: string;
  replyTo?: string;
  variables?: Record<string, string>;
  emailId?: string;
}) {
  const brandName = Deno.env.get("EMAIL_BRAND_NAME") || "SOS Logistics";
  const logoUrl = Deno.env.get("EMAIL_BRAND_LOGO_URL") || "";
  const brandUrl = Deno.env.get("EMAIL_BRAND_WEBSITE_URL") || "https://soslogistics.pro";
  const primaryColor = Deno.env.get("EMAIL_BRAND_PRIMARY_COLOR") || "#0B3D91";
  const supportEmail = Deno.env.get("EMAIL_SUPPORT_EMAIL") || "support@soslogistics.pro";
  const supportPhone = Deno.env.get("EMAIL_SUPPORT_PHONE") || "";
  const companyAddress = Deno.env.get("EMAIL_COMPANY_ADDRESS") || "";
  const unsubscribeEmail = Deno.env.get("EMAIL_UNSUBSCRIBE_MAILTO") || "unsubscribe@soslogistics.pro";
  const unsubscribeUrl = params.variables?.unsubscribe_url || Deno.env.get("EMAIL_UNSUBSCRIBE_URL") || "";
  const trackingBase = Deno.env.get("EMAIL_TRACKING_PIXEL_BASE_URL") || "";
  const recipientName = params.variables?.recipient_name || "";
  const greeting = recipientName ? `Hi ${recipientName},` : "Hello,";
  const closingName = params.variables?.sender_name || brandName;
  const signatureTitle = params.variables?.sender_title || "";

  const preheaderText = params.innerText.slice(0, 120).replace(/\s+/g, " ").trim();
  const trackingPixelUrl = trackingBase && params.emailId ? `${trackingBase.replace(/\/$/, "")}/open?id=${encodeURIComponent(params.emailId)}` : "";

  const footerLines: string[] = [];
  footerLines.push(`${brandName}`);
  if (companyAddress) footerLines.push(companyAddress);
  footerLines.push(`Support: ${supportEmail}${supportPhone ? ` | ${supportPhone}` : ""}`);
  footerLines.push(unsubscribeUrl
    ? `Unsubscribe: ${unsubscribeUrl}`
    : `Unsubscribe: mailto:${unsubscribeEmail}`);

  const text = [
    greeting,
    "",
    params.innerText || "",
    "",
    "Regards,",
    closingName,
    signatureTitle ? signatureTitle : "",
    "",
    footerLines.join("\n"),
  ].filter(Boolean).join("\n");

  const headerLogo = logoUrl
    ? `<a href="${escapeHtml(brandUrl)}" style="text-decoration:none;"><img src="${escapeHtml(logoUrl)}" width="160" alt="${escapeHtml(brandName)}" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:160px;" /></a>`
    : `<a href="${escapeHtml(brandUrl)}" style="color:#ffffff;text-decoration:none;font-weight:700;font-size:18px;line-height:24px;">${escapeHtml(brandName)}</a>`;

  let html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(params.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7fb;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
    ${escapeHtml(preheaderText)}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f7fb;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6eaf2;">
          <tr>
            <td style="background:${escapeHtml(primaryColor)};padding:16px 20px;">
              ${headerLogo}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 20px 12px 20px;font-family:Calibri,Segoe UI,Arial,sans-serif;color:#0f172a;">
              <div style="font-size:16px;line-height:24px;margin:0 0 14px 0;">${escapeHtml(greeting)}</div>
              <div style="font-size:14px;line-height:22px;color:#0f172a;">
                ${params.innerHtml}
              </div>
              <div style="margin-top:18px;font-size:14px;line-height:22px;">
                <div style="margin:0;">Regards,</div>
                <div style="margin:0;font-weight:600;">${escapeHtml(closingName)}</div>
                ${signatureTitle ? `<div style="margin:0;color:#475569;">${escapeHtml(signatureTitle)}</div>` : ""}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 20px 20px 20px;background-color:#f8fafc;font-family:Calibri,Segoe UI,Arial,sans-serif;color:#475569;">
              <div style="font-size:12px;line-height:18px;">
                <div style="font-weight:600;color:#0f172a;">${escapeHtml(brandName)}</div>
                ${companyAddress ? `<div>${escapeHtml(companyAddress)}</div>` : ""}
                <div>Support: <a href="mailto:${escapeHtml(supportEmail)}" style="color:${escapeHtml(primaryColor)};text-decoration:none;">${escapeHtml(supportEmail)}</a>${supportPhone ? ` | ${escapeHtml(supportPhone)}` : ""}</div>
                <div style="margin-top:10px;">
                  ${unsubscribeUrl
                    ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:${escapeHtml(primaryColor)};text-decoration:none;">Unsubscribe</a>`
                    : `<a href="mailto:${escapeHtml(unsubscribeEmail)}?subject=Unsubscribe" style="color:${escapeHtml(primaryColor)};text-decoration:none;">Unsubscribe</a>`}
                </div>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  ${trackingPixelUrl ? `<img src="${escapeHtml(trackingPixelUrl)}" width="1" height="1" alt="" style="display:none;opacity:0;" />` : ""}
</body>
</html>`;

  // Rewrite links if tracking is enabled
  if (params.emailId && trackingBase) {
    html = rewriteLinks(html, trackingBase, params.emailId);
  }

  return { html, text, unsubscribeUrl, unsubscribeEmail };
}

// --- Main Handler ---

serve(async (req: Request) => {
  const headers = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create Supabase client with Auth context (User or Service Role)
    const authHeader = req.headers.get('Authorization');
    let supabase: SupabaseClient;

    // Always create admin client for privileged operations (fetching secrets, updating tokens)
    const adminSupabase = createClient(supabaseUrl, serviceKey);

    if (authHeader && authHeader.includes(serviceKey)) {
      // System/Admin call (e.g. from scheduler)
      supabase = createClient(supabaseUrl, serviceKey);
    } else {
      // User call (RLS enforced)
      supabase = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader || '' } },
      });
    }

    const payload = await req.json();
    const { 
      accountId, 
      to, cc, bcc, 
      subject: reqSubject, 
      body: reqBody, 
      from, reply_to, 
      provider: requestedProvider,
      templateId,
      variables,
      attachments
    } = payload;

    if (!to) throw new Error("Missing required field: to");

    // Process attachments
    const processedAttachments = await prepareAttachments(supabase, attachments);

    // 1. Process Template if present
    let subject = reqSubject;
    let body = reqBody;

    if (templateId) {
      const templateData = await processTemplate(supabase, templateId, variables);
      subject = templateData.subject;
      body = templateData.body;
    }

    if (!subject) throw new Error("Missing required field: subject (or valid template)");
    if (!body) body = "";

    let renderedHtml = "";
    let renderedText = "";
    let unsubscribeUrl = "";
    let unsubscribeEmail = "";
    // Generate ID upfront for tracking consistency
    const emailId = crypto.randomUUID(); 
    
    try {
      const innerHtml = normalizeInnerHtml(body);
      const innerText = stripHtmlToText(body);
      const rendered = renderBrandedEmail({
        subject,
        innerHtml,
        innerText,
        to: Array.isArray(to) ? to : [to],
        replyTo: reply_to,
        variables,
        emailId, // Pass emailId for pixel/link rewriting
      });
      renderedHtml = rendered.html;
      renderedText = rendered.text;
      unsubscribeUrl = rendered.unsubscribeUrl;
      unsubscribeEmail = rendered.unsubscribeEmail;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ success: false, error: `Email generation failed: ${msg}` }), {
        headers: { ...headers, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 2. Determine Provider Strategy
    const providers: EmailProvider[] = [];
    let account = null;
    let finalReplyTo = reply_to;

    if (requestedProvider === 'resend' || (!accountId && !requestedProvider)) {
      // System Email Strategy - Support Failover in future by adding more providers to this array
      providers.push(new ResendProvider({
        apiKey: Deno.env.get("RESEND_API_KEY") || "re_HE1deVM5_NuVR5nihEuzSf3cMZP4n5U1R",
        supabase,
        adminSupabase
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

      // Set Reply-To to account email if not specified
      if (!finalReplyTo && account.email_address) {
        finalReplyTo = account.email_address;
      }

      if (account.provider === "gmail") {
        providers.push(new GmailProvider({ supabase, account, adminSupabase }));
      } else if (account.provider === "office365") {
        providers.push(new Office365Provider({ supabase, account, adminSupabase }));
      } else if (account.provider === "smtp_imap") {
          console.log("SMTP account selected. Using SMTP Provider.");
          providers.push(new SMTPProvider({ supabase, account, adminSupabase }));
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
          body: renderedHtml,
          text: renderedText,
          from,
          replyTo: finalReplyTo,
          variables,
          attachments: processedAttachments
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
      const normalizeEmail = (v: string) => String(v || "").trim().toLowerCase();
      await supabase.from("emails").insert({
        id: emailId, // Use the pre-generated ID
        account_id: account.id,
        tenant_id: account.tenant_id,
        franchise_id: account.franchise_id,
        message_id: response.messageId || `sent-${Date.now()}`,
        subject,
        from_email: normalizeEmail(account.email_address),
        from_name: account.display_name,
        to_emails: (Array.isArray(to) ? to : [to]).map(e => ({ email: normalizeEmail(e) })).filter(e => e.email),
        cc_emails: cc ? (Array.isArray(cc) ? cc : [cc]).map(e => ({ email: normalizeEmail(e) })).filter(e => e.email) : [],
        bcc_emails: bcc ? (Array.isArray(bcc) ? bcc : [bcc]).map(e => ({ email: normalizeEmail(e) })).filter(e => e.email) : [],
        body_text: renderedText,
        body_html: renderedHtml,
        direction: "outbound",
        status: "sent",
        folder: "sent",
        sent_at: new Date().toISOString(),
        raw_headers: {
          reply_to: reply_to || null,
          list_unsubscribe: unsubscribeUrl ? { url: unsubscribeUrl, mailto: unsubscribeEmail } : { mailto: unsubscribeEmail },
          tracking_id: emailId,
        },
      });
    }

    return new Response(JSON.stringify(response), {
      headers: { ...headers, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Email Send Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...headers, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
