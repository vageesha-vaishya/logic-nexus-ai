// Ambient Deno typing for editors without Deno type support
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;
// @ts-ignore Supabase Edge (Deno) resolves URL imports at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// @ts-ignore Deno serve types
Deno.serve(async (req: any) => {
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

    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { accountId, to, cc, bcc, subject, body, attachments } = payload || {};

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
      // Use SMTP to send email
      const smtpConfig = {
        hostname: account.smtp_host,
        port: account.smtp_port,
        username: account.smtp_username,
        password: account.smtp_password,
        tls: account.smtp_use_tls,
      };

      console.log("Sending via SMTP:", smtpConfig);

      try {
        // Connect to SMTP server
        const conn = account.smtp_use_tls 
          ? await Deno.connectTls({ hostname: smtpConfig.hostname, port: smtpConfig.port })
          : await Deno.connect({ hostname: smtpConfig.hostname, port: smtpConfig.port });

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        // Helper to read server response
        const readResponse = async () => {
          const buffer = new Uint8Array(1024);
          const n = await conn.read(buffer);
          if (n === null) throw new Error("Connection closed");
          return decoder.decode(buffer.subarray(0, n));
        };

        // Helper to send command
        const sendCommand = async (cmd: string) => {
          await conn.write(encoder.encode(cmd + "\r\n"));
          return await readResponse();
        };

        // SMTP conversation
        await readResponse(); // Read greeting
        await sendCommand(`EHLO ${smtpConfig.hostname}`);
        
        // Authenticate
        await sendCommand("AUTH LOGIN");
        await sendCommand(btoa(smtpConfig.username));
        const authResp = await sendCommand(btoa(smtpConfig.password));
        
        if (!authResp.startsWith("235")) {
          throw new Error(`SMTP authentication failed: ${authResp}`);
        }

        // Send email
        await sendCommand(`MAIL FROM:<${account.email_address}>`);
        
        for (const recipient of to as string[]) {
          await sendCommand(`RCPT TO:<${recipient}>`);
        }
        
        if (cc) {
          for (const recipient of cc as string[]) {
            await sendCommand(`RCPT TO:<${recipient}>`);
          }
        }

        await sendCommand("DATA");

        // Build email message
        const message = [
          `From: ${account.email_address}`,
          `To: ${(to as string[]).join(", ")}`,
          cc && cc.length > 0 ? `Cc: ${(cc as string[]).join(", ")}` : "",
          `Subject: ${subject}`,
          `Date: ${new Date().toUTCString()}`,
          `Message-ID: <${messageId}>`,
          "MIME-Version: 1.0",
          "Content-Type: text/plain; charset=UTF-8",
          "",
          body,
          ".",
        ].filter(line => line !== "").join("\r\n");

        await sendCommand(message);
        await sendCommand("QUIT");

        conn.close();
        emailSent = true;
        console.log("Email sent successfully via SMTP");
      } catch (smtpError: any) {
        console.error("SMTP error:", smtpError);
        throw new Error(`Failed to send email via SMTP: ${smtpError.message}`);
      }
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
      
      // Create MIME email message
      const toList = to.join(", ");
      const ccList = cc ? cc.join(", ") : "";
      
      let message = [
        senderEmail ? `From: ${senderEmail}` : "",
        `To: ${toList}`,
        ccList ? `Cc: ${ccList}` : "",
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        `Content-Type: text/plain; charset=UTF-8`,
        "",
        body
      ].filter(line => line !== "").join("\r\n");

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
      console.log("Sending via Microsoft Outlook REST API");

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

        const tenantId = oauthConfig.tenant_id_provider || "common";
        const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: oauthConfig.client_id,
            client_secret: oauthConfig.client_secret,
            refresh_token: account.refresh_token,
            grant_type: "refresh_token",
            scope: [
              "https://outlook.office.com/Mail.Read",
              "https://outlook.office.com/Mail.Send",
              "https://outlook.office.com/Mail.ReadWrite",
              "offline_access",
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
          const profileRes = await fetch("https://outlook.office.com/api/v2.0/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (profileRes.ok) {
            const profile = await profileRes.json();
            senderEmail = profile?.Mailbox?.Address || profile?.EmailAddress || profile?.UserPrincipalName || senderEmail;
            if (senderEmail && !account.email_address) {
              await supabase.from("email_accounts").update({ email_address: senderEmail }).eq("id", accountId);
            }
          }
        } catch (e) {
          console.log("Failed to resolve Office 365 sender email", e);
        }
      }

      // Build REST API payload
      const toRecipients = (to as string[]).map((addr) => ({ EmailAddress: { Address: addr } }));
      const ccRecipients = (cc as string[] | undefined)?.map((addr) => ({ EmailAddress: { Address: addr } })) || [];
      const bccRecipients = (bcc as string[] | undefined)?.map((addr) => ({ EmailAddress: { Address: addr } })) || [];

      const sendBody = {
        Message: {
          Subject: subject,
          Body: { ContentType: "HTML", Content: body },
          ToRecipients: toRecipients,
          CcRecipients: ccRecipients,
          BccRecipients: bccRecipients,
          From: senderEmail ? { EmailAddress: { Address: senderEmail } } : undefined,
        },
        SaveToSentItems: true,
      };

      const outlookResponse = await fetch("https://outlook.office.com/api/v2.0/me/sendmail", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sendBody),
      });

      if (!outlookResponse.ok) {
        const errorText = await outlookResponse.text();
        console.error("Office 365 SendMail error:", errorText);
        throw new Error(`Failed to send email via Office 365: ${errorText}`);
      }

      // No message id returned; keep generated fallback
      emailSent = true;

      // Attempt verification by inspecting Sent Items
      try {
        const sentItemsRes = await fetch(
          "https://outlook.office.com/api/v2.0/me/MailFolders/SentItems/messages?$top=10&$orderby=ReceivedDateTime%20desc",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (sentItemsRes.ok) {
          const list = await sentItemsRes.json();
          const messages: any[] = Array.isArray(list?.value) ? list.value : [];
          const normalizedSubject = String(subject || "").trim().toLowerCase();
          const toSet = new Set((to as string[]).map((a) => a.toLowerCase()));

          verified = messages.some((m) => {
            const subj = String(m?.Subject || "").trim().toLowerCase();
            if (subj !== normalizedSubject) return false;
            const msgTo = (Array.isArray(m?.ToRecipients) ? m.ToRecipients : []).map((r: any) => String(r?.EmailAddress?.Address || "").toLowerCase());
            // Confirm at least one of provided recipients is in message
            return msgTo.some((addr: string) => toSet.has(addr));
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
        verificationMethod: account.provider === "office365" ? "outlook_sent_items" : undefined,
        verificationCheckedAt,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
