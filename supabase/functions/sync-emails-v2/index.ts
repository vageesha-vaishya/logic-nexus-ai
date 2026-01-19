
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from "./utils/db.ts";
import { ImapService } from "./services/imap.ts";
import { Pop3Service } from "./services/pop3.ts";
import { GmailService } from "./services/gmail.ts";

console.log("Sync-emails-v2 function loaded");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    
    // Parse body
            let body: any = {};
            try {
                body = await req.json();
            } catch {
                // Body might be empty
            }
            
            const { accountId, mode, pop3 } = body;
            
            if (mode === "test_pop3" && pop3) {
                 const result = await Pop3Service.testConnection({
                     host: pop3.hostname,
                     port: pop3.port,
                     username: pop3.username,
                     password: pop3.password,
                     ssl: pop3.ssl
                 });
                 if (result.success) {
                     return new Response(
                        JSON.stringify({ success: true }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                 } else {
                     return new Response(
                        JSON.stringify({ success: false, error: result.error }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                 }
            }
            
            if (!accountId) {
                return new Response(
                    JSON.stringify({ success: false, error: "Missing accountId" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
    
    // Fetch account
    const { data: account, error: accErr } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("id", accountId)
        .single();
        
    if (accErr || !account) {
        return new Response(
            JSON.stringify({ success: false, error: "Account not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
    
    console.log(`Starting sync for account ${account.email_address} (${account.provider})`);
    
    if (account.provider === "smtp_imap") {
        const service = new ImapService(account, supabase);
        await service.sync();
    } else if (account.provider === "pop3") {
        const service = new Pop3Service(account, supabase);
        await service.sync();
    } else if (account.provider === "gmail") {
        const service = new GmailService(account, supabase);
        await service.sync();
    } else {
        return new Response(
            JSON.stringify({ success: false, error: "Unsupported provider" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
    
    // Update last sync timestamp
    await supabase.from("email_accounts")
        .update({ last_sync_at: new Date().toISOString(), sync_status: "success", sync_error: null })
        .eq("id", accountId);

    return new Response(
        JSON.stringify({ success: true, message: "Sync completed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("Sync failed:", e);
    const msg = e instanceof Error ? e.message : String(e);
    
    return new Response(
        JSON.stringify({ success: false, error: msg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
