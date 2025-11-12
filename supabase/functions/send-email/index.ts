declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};
// @ts-expect-error Supabase Edge (Deno) resolves URL imports at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// @ts-expect-error Deno global in Edge runtime
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requireEnv = (name: string) => {
      const v = Deno.env.get(name);
      if (!v) throw new Error(`Missing environment variable: ${name}`);
      return v;
    };
    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    let payload: {
      accountId: string;
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      body: string;
      attachments?: unknown[];
    } | null;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { accountId, to, cc, bcc, subject, body, attachments } = (payload || {}) as {
      accountId: string;
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      body: string;
      attachments?: unknown[];
    };

    if (!accountId || !to || !subject) {
      throw new Error("Missing required fields: accountId, to, subject");
    }

    // Fetch email account details
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    if (accountError || !account) {
      throw new Error("Email account not found");
    }

    let emailSent = false;
    let verified = false;
    let messageId = `${Date.now()}@${account.email_address}`;

    // Send email based on provider
    if (account.provider === "smtp_imap") {
      console.log("SMTP/IMAP send requested, but direct SMTP is not supported from Edge functions.");
      throw new Error(
        "Direct SMTP (ports 25/465/587) is blocked in the Edge runtime. Please connect your account via OAuth in Email Management → Accounts (Gmail or Office 365), or set up a Resend API key and verified domain."
      );
    } else if (account.provider === "gmail") {
      // Use Gmail API
      console.log("Sending via Gmail API");
      
      // Check if we have a valid access token
      if (!account.access_token) {
        throw new Error("Gmail account is not properly connected. Please reconnect your Gmail account.");
      }

      // Check if token is expired and refresh if needed
      let accessToken = account.access_token;
      if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
        if (!account.refresh_token) {
          throw new Error("Gmail access token expired and no refresh token available. Please reconnect your Gmail account.");
        }

        // Refresh the token
        const { data: oauthConfig } = await supabase
          .from("oauth_configurations")
          .select("client_id, client_secret")
          .eq("user_id", account.user_id)
          .eq("provider", "gmail")
          .eq("is_active", true)
          .single();

        if (!oauthConfig) {
          throw new Error("OAuth configuration not found. Please reconnect your Gmail account.");
        }

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

        if (!tokenResponse.ok) {
          throw new Error("Failed to refresh Gmail access token. Please reconnect your Gmail account.");
        }

        const tokenData = await tokenResponse.json();
        accessToken = tokenData.access_token;

        // Update the access token in database
        await supabase
          .from("email_accounts")
          .update({
            access_token: accessToken,
            token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          })
          .eq("id", accountId);
      }

      // Resolve sender email if missing
      let senderEmail = account.email_address;
      if (!senderEmail) {
        try {
          const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (profileRes.ok) {
            const profile = await profileRes.json();
            senderEmail = profile.email || senderEmail;
            // Persist if we learned it
            if (senderEmail && !account.email_address) {
              await supabase.from("email_accounts").update({ email_address: senderEmail }).eq("id", accountId);
            }
          }
        } catch (e) {
          console.log("Failed to resolve Gmail sender email", e);
        }
      }
      
      // Create MIME email message (multipart/alternative with text and HTML)
      const toList = to.join(", ");
      const ccList = cc ? cc.join(", ") : "";
      const boundary = `mixed_boundary_${Date.now()}`;
      const plainBody = (body || "").replace(/<[^>]+>/g, "");

      const message = [
        senderEmail ? `From: ${senderEmail}` : "",
        `To: ${toList}`,
        ccList ? `Cc: ${ccList}` : "",
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        `Content-Type: text/plain; charset=UTF-8`,
        "",
        plainBody,
        "",
        `--${boundary}`,
        `Content-Type: text/html; charset=UTF-8`,
        "",
        body,
        "",
        `--${boundary}--`
      ].filter(line => line !== null && line !== undefined).join("\r\n");

      // Base64url encode the message
      const encodedMessage = btoa(unescape(encodeURIComponent(message)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send via Gmail API
      const gmailResponse = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            raw: encodedMessage,
          }),
        }
      );

      if (!gmailResponse.ok) {
        const error = await gmailResponse.text();
        console.error("Gmail API error:", error);
        throw new Error(`Failed to send email via Gmail: ${error}`);
      }

      const gmailData = await gmailResponse.json();
      messageId = gmailData.id || messageId;
      emailSent = true;
    } else if (account.provider === "office365") {
      // Use Microsoft Outlook REST API (matches configured scopes)
      console.log("Sending via Microsoft Graph API");

      // Validate token
      if (!account.access_token) {
        throw new Error("Office 365 account is not properly connected. Please reconnect your Microsoft account.");
      }

      // Refresh token if expired
      let accessToken = account.access_token as string;
      if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
        if (!account.refresh_token) {
          throw new Error("Office 365 access token expired and no refresh token available. Please reconnect your Microsoft account.");
        }

        const { data: oauthConfig } = await supabase
          .from("oauth_configurations")
          .select("client_id, client_secret, tenant_id_provider")
          .eq("user_id", account.user_id)
          .eq("provider", "office365")
          .eq("is_active", true)
          .single();

        if (!oauthConfig) {
          throw new Error("OAuth configuration not found. Please configure Office 365 OAuth settings.");
        }

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
            scope: [
              "https://graph.microsoft.com/Mail.Read",
              "https://graph.microsoft.com/Mail.Send",
              "https://graph.microsoft.com/Mail.ReadWrite",
              "offline_access",
              "openid",
              "profile",
              "email",
            ].join(" "),
          }),
        });

        if (!tokenResponse.ok) {
          const errTxt = await tokenResponse.text();
          throw new Error(`Failed to refresh Office 365 token: ${errTxt}`);
        }

        const tokenData = await tokenResponse.json();
        accessToken = tokenData.access_token;

        // Update the access token in database
        await supabase
          .from("email_accounts")
          .update({
            access_token: accessToken,
            token_expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
          })
          .eq("id", accountId);
      }

      // Resolve sender email if missing
      let senderEmail: string | null = account.email_address || null;
      if (!senderEmail) {
        try {
          const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (profileRes.ok) {
            const profile = await profileRes.json();
            senderEmail = profile?.mail || profile?.userPrincipalName || senderEmail;
            if (senderEmail && !account.email_address) {
              await supabase.from("email_accounts").update({ email_address: senderEmail }).eq("id", accountId);
            }
          }
        } catch (e) {
          console.log("Failed to resolve Office 365 sender email", e);
        }
      }

      // Build Graph API payload
      const toRecipients = (to as string[]).map((addr) => ({ emailAddress: { address: addr } }));
      const ccRecipients = (cc as string[] | undefined)?.map((addr) => ({ emailAddress: { address: addr } })) || [];
      const bccRecipients = (bcc as string[] | undefined)?.map((addr) => ({ emailAddress: { address: addr } })) || [];

      const sendBody = {
        message: {
          subject: subject,
          body: { contentType: "HTML", content: body },
          toRecipients,
          ccRecipients,
          bccRecipients,
        },
        saveToSentItems: true,
      };

      const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sendBody),
      });

      if (!graphResponse.ok) {
        let errorText = await graphResponse.text();
        try {
          const j = JSON.parse(errorText);
          errorText = j?.error?.message || j?.message || errorText;
        } catch { void 0; }
        console.error("Microsoft Graph SendMail error:", errorText);
        throw new Error(`Failed to send email via Office 365: ${errorText}`);
      }

      // No message id returned; keep generated fallback
      emailSent = true;

      // Attempt verification by inspecting Sent Items (Microsoft Graph)
      try {
        const sentItemsRes = await fetch(
          "https://graph.microsoft.com/v1.0/me/mailFolders/SentItems/messages?$top=10&$orderby=receivedDateTime%20desc",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (sentItemsRes.ok) {
          const list = await sentItemsRes.json();
          type GraphRecipient = { emailAddress?: { address?: string } };
          type GraphMessage = { subject?: string; toRecipients?: GraphRecipient[] };
          const messages: GraphMessage[] = Array.isArray(list?.value) ? list.value : [];
          const normalizedSubject = String(subject || "").trim().toLowerCase();
          const toSet = new Set((to as string[]).map((a) => a.toLowerCase()));

          verified = messages.some((m) => {
            const subj = String(m?.subject || "").trim().toLowerCase();
            if (subj !== normalizedSubject) return false;
            const msgTo = (Array.isArray(m?.toRecipients) ? m.toRecipients : [])
              .map((r) => String(r?.emailAddress?.address || "").toLowerCase());
            return msgTo.some((addr) => toSet.has(addr));
          });
        }
      } catch (verErr) {
        console.log("Office 365 verification check failed:", verErr);
      }
    }

    if (!emailSent) {
      throw new Error(`Unsupported email provider: ${account.provider}`);
    }

    // Store email in database
    const { error: insertError } = await supabase.from("emails").insert({
      account_id: accountId,
      tenant_id: account.tenant_id,
      franchise_id: account.franchise_id,
      message_id: messageId,
      subject,
      from_email: account.email_address || null,
      from_name: account.display_name || account.email_address || null,
      to_emails: to.map((email: string) => ({ email })),
      cc_emails: cc ? cc.map((email: string) => ({ email })) : [],
      bcc_emails: bcc ? bcc.map((email: string) => ({ email })) : [],
      body_text: body,
      body_html: body,
      direction: "outbound",
      status: "sent",
      folder: "sent",
      sent_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("Error storing email:", insertError);
    }

    const verificationCheckedAt = new Date().toISOString();
    return new Response(
      JSON.stringify({
        success: true,
        messageId,
        message: "Email sent successfully",
        verified,
        verificationMethod: account.provider === "office365" ? "graph_sent_items" : undefined,
        verificationCheckedAt,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error instanceof Error) ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
