
import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";

serveWithLogger(async (req, logger, supabase) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  const access = await requireServiceRoleOrAdmin(req, supabase, logger);
  if (!access.authorized) {
    return new Response(JSON.stringify({ error: access.error || 'Unauthorized' }), {
      status: access.status,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  try {
    // supabase client injected by serveWithLogger is already service role
    
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
    logger.error("Error processing retention:", { error: error });
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
}, "process-email-retention");
