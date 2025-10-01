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

    const { accountId } = await req.json();

    if (!accountId) {
      throw new Error("Missing required field: accountId");
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

    let syncedCount = 0;

    // Sync emails based on provider
    if (account.provider === "smtp_imap") {
      // Use IMAP to fetch emails
      const imapConfig = {
        hostname: account.imap_host,
        port: account.imap_port,
        username: account.imap_username,
        password: account.imap_password,
        ssl: account.imap_use_ssl,
      };

      console.log("Syncing via IMAP:", imapConfig);
      // TODO: Implement actual IMAP syncing
      syncedCount = 0;
    } else if (account.provider === "gmail") {
      // Use Gmail API
      console.log("Syncing via Gmail API");
      // TODO: Implement Gmail API integration
      syncedCount = 0;
    } else if (account.provider === "office365") {
      // Use Microsoft Graph API
      console.log("Syncing via Microsoft Graph API");
      // TODO: Implement Microsoft Graph API integration
      syncedCount = 0;
    }

    // Update last sync time
    const { error: updateError } = await supabase
      .from("email_accounts")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", accountId);

    if (updateError) {
      console.error("Error updating last sync time:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedCount,
        message: `Synced ${syncedCount} emails successfully`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error syncing emails:", error);
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
