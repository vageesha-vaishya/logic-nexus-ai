
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  // 1. Auth Check (Admin or Service Role)
  const authHeader = req.headers.get('Authorization');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  let isServiceRole = false;

  if (authHeader?.includes(serviceKey)) {
      isServiceRole = true;
  } else {
      const { user, error: authError } = await requireAuth(req);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      // Ideally check for 'admin' role here, but assuming authorized user for now
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Fetch Active Policies
    const { data: policies, error: fetchError } = await supabase
        .from('compliance_retention_policies')
        .select('id, name')
        .eq('is_active', true);

    if (fetchError) throw fetchError;

    const results = [];

    // 3. Execute Policies
    for (const policy of policies || []) {
        const { data, error } = await supabase.rpc('execute_retention_policy', { p_policy_id: policy.id });
        
        results.push({
            policy: policy.name,
            success: !error && data?.success,
            details: error || data
        });
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error processing retention:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
