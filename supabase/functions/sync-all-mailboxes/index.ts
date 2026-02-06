// /// <reference types="https://esm.sh/@supabase/functions@1.3.1/types.ts" />
// /// <reference types="https://esm.sh/@supabase/functions@1.3.1/types.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: verify service role key or authenticated user (admin manually triggering)
  const authHeaderCheck = req.headers.get('Authorization');
  const serviceKeyCheck = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!authHeaderCheck || !authHeaderCheck.includes(serviceKeyCheck)) {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  try {
    const requireEnv = (name: string) => {
      const v = Deno.env.get(name);
      if (!v) throw new Error(`Missing environment variable: ${name}`);
      return v;
    };

    const baseUrl = requireEnv("SUPABASE_URL");
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(baseUrl, serviceKey);

    let payload: { tenantId: string; franchiseId?: string; limit?: number } | null;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { tenantId, franchiseId } = (payload || {}) as { tenantId: string; franchiseId?: string; limit?: number };
    let { limit = 50 } = (payload || {}) as { tenantId: string; franchiseId?: string; limit?: number };

    if (!tenantId) {
      throw new Error("Missing required field: tenantId");
    }

    // Normalize and clamp limit
    limit = Number(limit);
    if (!Number.isFinite(limit)) limit = 50;
    limit = Math.max(1, Math.min(500, limit));

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

    const syncUrl = `${baseUrl}/functions/v1/sync-emails-v2`;
    const authHeader = req.headers.get("Authorization") || `Bearer ${serviceKey}`;

    let synced = 0;
    for (const acc of accounts || []) {
      try {
        const res = await fetch(syncUrl, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
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
  } catch (error: unknown) {
    console.error("Error syncing all mailboxes:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error instanceof Error) ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});