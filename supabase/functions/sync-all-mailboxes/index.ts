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

    const { tenantId, franchiseId, limit = 50 } = await req.json();

    if (!tenantId) {
      throw new Error("Missing required field: tenantId");
    }

    // Fetch active accounts for tenant
    let q = supabase
      .from("email_accounts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .limit(limit);

    if (franchiseId) q = q.eq("franchise_id", franchiseId);

    const { data: accounts, error } = await q;
    if (error) throw error;

    const baseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const syncUrl = `${baseUrl}/functions/v1/sync-emails`;

    let synced = 0;
    for (const acc of accounts || []) {
      try {
        const res = await fetch(syncUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ accountId: acc.id }),
        });
        if (res.ok) {
          const j = await res.json();
          synced += j?.syncedCount || 0;
        } else {
          console.error("Sync-emails call failed for", acc.id, await res.text());
        }
      } catch (e) {
        console.error("Sync call error for", acc.id, e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, accountsProcessed: (accounts || []).length, totalSynced: synced }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error syncing all mailboxes:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});