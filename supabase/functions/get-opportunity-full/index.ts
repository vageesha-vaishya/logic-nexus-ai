// Deno Edge Function: get-opportunity-full
// Returns complete opportunity data with nested account and contact info.
// Uses the service-role client so the accounts/contacts join always
// resolves (RLS on those tables can otherwise make the join unreliable),
// but that also means the tenant boundary must be checked explicitly in
// code -- see the requester-role check below. "Bypass tenant filters" was
// never meant to mean "any tenant can read any other tenant's data."

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

    // requireAuth only checks *some* user is authenticated; the service-role
    // client this uses (see file header) bypasses RLS entirely, and the
    // fetch below was scoped only by opportunity id, so any authenticated
    // user could read another tenant's opportunity name plus its linked
    // account name and contact first/last name -- resolve the caller's
    // tenant scope and check the fetched row against it before returning.
    const { data: requesterRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", user.id);
    if (rolesError) {
      logger.error(`Failed to resolve requester roles for ${user.id}: ${rolesError.message}`);
      return new Response(JSON.stringify({ error: "Forbidden: cannot resolve requester role scope" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    const roles = requesterRoles || [];
    const isPlatformAdmin = roles.some((r: any) => r.role === "platform_admin");
    const allowedTenantIds = isPlatformAdmin
      ? null
      : new Set(roles.map((r: any) => r.tenant_id).filter((tid: string | null) => !!tid));

    // Fetch opportunity with account and contact data
    const { data, error } = await supabase
      .from("opportunities")
      .select(`
        id,
        name,
        tenant_id,
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

    if (data && allowedTenantIds && !allowedTenantIds.has((data as any).tenant_id)) {
      return new Response(JSON.stringify({ error: "Forbidden: opportunity outside caller scope" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
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
