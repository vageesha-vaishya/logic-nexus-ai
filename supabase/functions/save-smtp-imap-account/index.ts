import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { serveWithLogger } from "../_shared/logger.ts";
import { setEmailCredential } from "../_shared/email-credentials.ts";

declare const Deno: any;

const REQUIRED_FIELDS = [
  "display_name", "email_address",
  "smtp_host", "smtp_port", "smtp_username", "smtp_password",
  "imap_host", "imap_port", "imap_username", "imap_password",
] as const;

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

    for (const field of REQUIRED_FIELDS) {
      if (!payload?.[field]) {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const {
      accountId, provider, display_name, email_address, is_primary,
      smtp_host, smtp_port, smtp_username, smtp_password, smtp_use_tls,
      imap_host, imap_port, imap_username, imap_password, imap_use_ssl,
    } = payload;

    const { data: userRole } = await supabaseAdmin
      .from("user_roles")
      .select("tenant_id, franchise_id")
      .eq("user_id", user.id)
      .single();

    if (!userRole?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Unable to resolve your tenant. Contact your administrator." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nonCredentialFields = {
      provider: provider || "smtp_imap",
      display_name,
      email_address,
      is_primary: Boolean(is_primary),
      smtp_host,
      smtp_port: Number(smtp_port),
      smtp_username,
      smtp_use_tls: smtp_use_tls !== false,
      imap_host,
      imap_port: Number(imap_port),
      imap_username,
      imap_use_ssl: imap_use_ssl !== false,
      updated_at: new Date().toISOString(),
    };

    let savedAccountId: string;

    if (accountId) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("email_accounts")
        .select("id, tenant_id")
        .eq("id", accountId)
        .maybeSingle();

      if (existingError || !existing || existing.tenant_id !== userRole.tenant_id) {
        return new Response(JSON.stringify({ error: "Account not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabaseAdmin
        .from("email_accounts")
        .update(nonCredentialFields)
        .eq("id", accountId);

      if (updateError) throw updateError;
      savedAccountId = accountId;
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("email_accounts")
        .insert({
          ...nonCredentialFields,
          user_id: user.id,
          tenant_id: userRole.tenant_id,
          franchise_id: userRole.franchise_id ?? null,
          is_active: true,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      savedAccountId = inserted.id;
    }

    const smtpResult = await setEmailCredential(
      supabaseAdmin,
      { account_id: savedAccountId, purpose: "smtp_password", value: smtp_password, tenant_id: userRole.tenant_id },
      logger,
    );
    const imapResult = await setEmailCredential(
      supabaseAdmin,
      { account_id: savedAccountId, purpose: "imap_password", value: imap_password, tenant_id: userRole.tenant_id },
      logger,
    );

    if (!smtpResult.ok || !imapResult.ok) {
      return new Response(
        JSON.stringify({ error: "Account saved, but credential storage failed. Please try saving again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ id: savedAccountId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logger.error("Error saving SMTP/IMAP account:", { error });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}, "save-smtp-imap-account");
