import { ImapService } from "./services/imap.ts";
// @ts-ignore
import { Pop3Service } from "./services/pop3.ts";
// @ts-ignore
import { GmailService } from "./services/gmail.ts";
import { saveSyncLog } from "./utils/db.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { serveWithLogger } from "../_shared/logger.ts";
import { requireAuth } from "../_shared/auth.ts";

declare const Deno: any;

serveWithLogger(async (req, logger, adminSupabase) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Determine if request is from Service Role (Cron/Admin) or User
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization");
    const isServiceRole = authHeader?.includes(serviceRoleKey);

    let userSupabase = adminSupabase; // Default to admin if service role
    let user = null;

    if (!isServiceRole) {
      // User context - verify auth
      const authResult = await requireAuth(req, logger);
      if (authResult.error || !authResult.user) {
        logger.error("Auth error:", { error: authResult.error || "User is null" });
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      user = authResult.user;
      
      // Use user-scoped client from requireAuth for RLS
      userSupabase = authResult.supabaseClient;
    }

    const { accountId, forceFullSync } = await req.json();

    if (!accountId) {
      return new Response(JSON.stringify({ error: "Missing accountId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use userSupabase to respect RLS when fetching the account
    // If service role, it bypasses RLS anyway (adminSupabase)
    const { data: account, error: accountError } = await userSupabase
      .from("email_accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    if (accountError || !account) {
      return new Response(JSON.stringify({ error: "Account not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let service;
    if (account.provider === "gmail") {
      service = new GmailService(account, userSupabase, adminSupabase, logger);
    } else if (account.provider === "smtp" || account.provider === "imap" || account.provider === "smtp_imap") {
      service = new ImapService(account, userSupabase, adminSupabase, logger);
    } else if (account.provider === "pop3") {
      service = new Pop3Service(account, userSupabase, adminSupabase, logger);
    } else {
      throw new Error(`Unsupported provider: ${account.provider}`);
    }

    logger.info(`Starting sync for account ${account.email_address} (${account.provider})`);
    const result = await service.syncEmails(forceFullSync);

    await saveSyncLog(adminSupabase, {
        account_id: account.id,
        status: 'success',
        emails_synced: result.syncedCount,
        details: { 
            message: 'Sync completed successfully',
            debug: (result as any).debug 
        }
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logger.error("Sync failed:", { error: error });
    
    // Attempt to log failure if we have an account ID (need to parse body again safely or store it)
    // For now, we rely on the logger
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}, "sync-emails-v2");
