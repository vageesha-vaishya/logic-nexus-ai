/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { ImapService } from "./services/imap.ts";
import { Pop3Service } from "./services/pop3.ts";
import { GmailService } from "./services/gmail.ts";
import { saveSyncLog, getAdminSupabaseClient } from "./utils/db.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const adminSupabase = getAdminSupabaseClient();
    
    // Check for Service Role Key to bypass user auth (for Cron/Admin tasks)
    // SUPABASE_SERVICE_ROLE_KEY is not exposed by default, so we use PRIVATE_SERVICE_ROLE_KEY
    const serviceRoleKey = Deno.env.get("PRIVATE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");
    const isServiceRole = authHeader && serviceRoleKey && authHeader.includes(serviceRoleKey);

    if (!isServiceRole) {
      // Explicitly extract token to ensure getUser verifies the one from the request
      const token = authHeader?.replace(/^Bearer\s+/i, "");
      
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser(token);

      if (userError || !user) {
        console.error("Auth error:", userError?.message || "User is null");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { accountId, forceFullSync } = await req.json();

    if (!accountId) {
      return new Response(JSON.stringify({ error: "Missing accountId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: account, error: accountError } = await supabase
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
      service = new GmailService(account, supabase, adminSupabase);
    } else if (account.provider === "smtp" || account.provider === "imap" || account.provider === "smtp_imap") {
      service = new ImapService(account, supabase, adminSupabase);
    } else if (account.provider === "pop3") {
      service = new Pop3Service(account, supabase, adminSupabase);
    } else {
      throw new Error(`Unsupported provider: ${account.provider}`);
    }

    console.log(`Starting sync for account ${account.email_address} (${account.provider})`);
    const result = await service.syncEmails(forceFullSync);

    await saveSyncLog(supabase, {
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
    console.error("Sync error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
