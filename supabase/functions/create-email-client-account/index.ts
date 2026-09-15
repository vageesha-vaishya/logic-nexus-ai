//
// Creates an SMTP/IMAP email_accounts row and stores its credentials in
// the vault via core.write_email_account_credential, instead of the
// plaintext smtp_password/imap_password columns dropped by
// 20260529010000_drop_email_accounts_plaintext_credentials.sql. Follows
// the same shape exchange-oauth-token already established for OAuth
// accounts. See docs/superpowers/specs/2026-09-15-email-client-smtp-save-fix-design.md.
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { serveWithLogger } from "../_shared/logger.ts";
import { setEmailCredential } from "../_shared/email-credentials.ts";

function json(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serveWithLogger(async (req, logger, supabase) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { user, error: authError } = await requireAuth(req);
  if (authError || !user) {
    return json({ error: "Unauthorized" }, 401, corsHeaders);
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, corsHeaders);
    }

    const { display_name, email_address, is_primary, smtp, imap, settings } = body || {};
    if (!email_address || !smtp?.host || !smtp?.password || !imap?.host || !imap?.password) {
      return json({ error: "Missing required fields: email_address, smtp.host, smtp.password, imap.host, imap.password" }, 400, corsHeaders);
    }

    // Derive tenant/franchise from the caller's own role row -- never
    // trust a client-supplied tenant id, since this function runs as
    // service-role and bypasses RLS. .limit(1).maybeSingle(), not bare
    // .single(): user_roles allows multiple rows per user (one per
    // distinct role), so .single() would throw for a user holding two
    // roles.
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("tenant_id, franchise_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const accountPayload = {
      user_id: user.id,
      provider: "smtp_imap",
      email_address,
      display_name: display_name || null,
      is_primary: Boolean(is_primary),
      smtp_host: smtp.host,
      smtp_port: smtp.port,
      smtp_username: smtp.username,
      smtp_use_tls: Boolean(smtp.use_tls),
      imap_host: imap.host,
      imap_port: imap.port,
      imap_username: imap.username,
      imap_use_ssl: Boolean(imap.use_ssl),
      tenant_id: userRole?.tenant_id ?? null,
      franchise_id: userRole?.franchise_id ?? null,
      is_active: true,
      settings: settings ?? {},
    };

    const { data: account, error: insertError } = await supabase
      .from("email_accounts")
      .insert(accountPayload)
      .select()
      .single();

    if (insertError || !account) {
      logger.error("create-email-client-account: insert failed", { error: insertError });
      return json({ error: insertError?.message ?? "Failed to create account" }, 500, corsHeaders);
    }

    const smtpResult = await setEmailCredential(
      supabase,
      { account_id: account.id, purpose: "smtp_password", value: smtp.password, tenant_id: userRole?.tenant_id ?? null },
      logger,
    );
    if (!smtpResult.ok) {
      await supabase.from("email_accounts").delete().eq("id", account.id);
      logger.error("create-email-client-account: smtp_password write failed, rolled back", { error: smtpResult.error });
      return json({ error: "Failed to store SMTP password" }, 500, corsHeaders);
    }

    const imapResult = await setEmailCredential(
      supabase,
      { account_id: account.id, purpose: "imap_password", value: imap.password, tenant_id: userRole?.tenant_id ?? null },
      logger,
    );
    if (!imapResult.ok) {
      await supabase.from("email_accounts").delete().eq("id", account.id);
      // smtp_password already landed in core.secrets before this failure
      // -- core.secrets.subject_id has no FK to email_accounts.id, so
      // deleting the account row above does not cascade-clean it.
      await supabase.schema("core").from("secrets").delete()
        .eq("subject_kind", "comms.email_account")
        .eq("subject_id", account.id);
      logger.error("create-email-client-account: imap_password write failed, rolled back", { error: imapResult.error });
      return json({ error: "Failed to store IMAP password" }, 500, corsHeaders);
    }

    return json({ success: true, account }, 200, corsHeaders);
  } catch (error: any) {
    logger.error("create-email-client-account: unhandled error", { error });
    return json({ error: error?.message ?? "Internal Server Error" }, 500, corsHeaders);
  }
}, "create-email-client-account");
