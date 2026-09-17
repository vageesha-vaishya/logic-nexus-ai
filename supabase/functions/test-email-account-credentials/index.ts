import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { serveWithLogger } from "../_shared/logger.ts";
import { getEmailCredential } from "../_shared/email-credentials.ts";

declare const Deno: any;

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { user, error: authError } = await requireAuth(req);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { accountId } = payload || {};
    if (!accountId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: accountId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Authorization is ownership-based, matching the RLS policy on
    // email_accounts: USING (user_id = auth.uid() OR is_platform_admin(...)).
    // A tenant-membership check would let any colleague read this account's
    // IMAP password in plaintext.
    const { data: account, error: accountError } = await supabaseAdmin
      .from("email_accounts")
      .select("user_id, imap_host, imap_port, imap_username, imap_use_ssl, email_address")
      .eq("id", accountId)
      .maybeSingle();

    if (accountError) {
      return new Response(JSON.stringify({ error: "Failed to look up account. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!account) {
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (account.user_id !== user.id) {
      const { data: isPlatformAdmin } = await supabaseAdmin.rpc("is_platform_admin", {
        check_user_id: user.id,
      });
      if (!isPlatformAdmin) {
        return new Response(JSON.stringify({ error: "Account not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!account.imap_host || !account.imap_username) {
      return new Response(
        JSON.stringify({ success: false, error: "IMAP host/username not configured for this account." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const imapPassword = await getEmailCredential(
      supabaseAdmin,
      { account_id: accountId, purpose: "imap_password" },
      logger,
    );

    if (!imapPassword) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No IMAP password saved for this account yet — save your SMTP/IMAP credentials first.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const functionsBaseUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
    const verifyResponse = await fetch(`${functionsBaseUrl}/verify-email-credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        imap: {
          host: account.imap_host,
          port: account.imap_port || 993,
          username: account.imap_username || account.email_address,
          password: imapPassword,
          secure: account.imap_use_ssl ?? true,
        },
      }),
    });
    const verifyResult = await verifyResponse.json().catch(() => ({}));

    if (verifyResult?.success) {
      return new Response(
        JSON.stringify({ success: true, message: verifyResult.message || "Connection successful" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: verifyResult?.error || "Connection test failed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    logger.error("Error testing email account credentials:", { error });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}, "test-email-account-credentials");
