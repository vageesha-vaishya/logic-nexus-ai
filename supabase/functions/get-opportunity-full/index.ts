// Deno Edge Function: get-opportunity-full
// Returns complete opportunity data with nested account and contact info
// Uses service role to bypass tenant filters for quote editing scenarios

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

serve(async (req) => {
  const headers = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json().catch(() => ({}));
    const id = payload?.id ?? payload?.opportunityId ?? payload?.opportunity_id;
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing opportunity id" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch opportunity with account and contact data
    const { data, error } = await supabase
      .from("opportunities")
      .select(`
        id,
        name,
        account_id,
        contact_id,
        accounts:account_id (
          id,
          name
        ),
        contacts:contact_id (
          id,
          first_name,
          last_name
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching opportunity:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data || null), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Exception in get-opportunity-full:", e);
    return new Response(JSON.stringify({ error: (e as any)?.message || String(e) }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
