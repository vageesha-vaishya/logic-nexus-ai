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

    const { email, tenantId, accountId, direction, page = 1, pageSize = 25 } = await req.json();

    if (!email) {
      throw new Error("Missing required field: email");
    }

    const targetEmail = String(email).toLowerCase().trim();
    const fromFilters: any = {
      select: "*",
    };

    // Base query builder
    let baseQuery = supabase.from("emails").select("*");
    if (tenantId) baseQuery = baseQuery.eq("tenant_id", tenantId);
    if (accountId) baseQuery = baseQuery.eq("account_id", accountId);
    if (direction) baseQuery = baseQuery.eq("direction", direction);

    // Paging
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 1) From address direct match
    const { data: fromMatches, error: fromErr } = await baseQuery
      .ilike("from_email", targetEmail)
      .order("received_at", { ascending: false })
      .range(from, to);

    if (fromErr) {
      throw new Error(`Query error (from): ${fromErr.message}`);
    }

    // 2) To/CC/BCC contains target
    const { data: toMatches, error: toErr } = await supabase
      .from("emails")
      .select("*")
      .contains("to_emails", [{ email: targetEmail }]);

    const { data: ccMatches, error: ccErr } = await supabase
      .from("emails")
      .select("*")
      .contains("cc_emails", [{ email: targetEmail }]);

    const { data: bccMatches, error: bccErr } = await supabase
      .from("emails")
      .select("*")
      .contains("bcc_emails", [{ email: targetEmail }]);

    if (toErr || ccErr || bccErr) {
      throw new Error(
        `Query error (recipients): ${toErr?.message || ccErr?.message || bccErr?.message}`
      );
    }

    // Merge and de-duplicate by id
    const byId: Record<string, any> = {};
    for (const arr of [fromMatches || [], toMatches || [], ccMatches || [], bccMatches || []]) {
      for (const e of arr) {
        byId[e.id] = e;
      }
    }
    const merged = Object.values(byId).sort(
      (a: any, b: any) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
    );

    return new Response(
      JSON.stringify({
        success: true,
        count: merged.length,
        data: merged.slice(0, pageSize),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error searching emails:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});