// Deno Edge Function: get-opportunity-full
// Returns complete opportunity data with nested account and contact info
// Uses service role to bypass tenant filters for quote editing scenarios

import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { serveWithLogger } from "../_shared/logger.ts";

serveWithLogger(async (req, logger, supabase) => {
  const headers = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      logger.warn(`Unauthorized request: ${authError}`);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
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
      logger.error(`Database error fetching opportunity ${id}: ${error.message}`);
      throw error;
    }

    return new Response(JSON.stringify(data || null), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logger.error(`Error in get-opportunity-full: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}, "get-opportunity-full");
