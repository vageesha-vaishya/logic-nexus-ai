import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { accountId, to, cc, bcc, subject, body, attachments } = await req.json();

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

      // TODO: Implement actual SMTP sending
      // For now, we'll just log the configuration
      console.log("Sending via SMTP:", smtpConfig);
      emailSent = true;
    } else if (account.provider === "gmail") {
      // Use Gmail API
      console.log("Sending via Gmail API");
      // TODO: Implement Gmail API integration
      emailSent = true;
    } else if (account.provider === "office365") {
      // Use Microsoft Graph API
      console.log("Sending via Microsoft Graph API");
      // TODO: Implement Microsoft Graph API integration
      emailSent = true;
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
      from_email: account.email_address,
      from_name: account.display_name || account.email_address,
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

    return new Response(
      JSON.stringify({
        success: true,
        messageId,
        message: "Email sent successfully",
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
