// Deno Edge Function: get-opportunity-label
// Returns minimal label information (id, name) for an opportunity id
// Uses service role to bypass tenant filters, but only exposes safe fields.
// "Bypass tenant filters" was never meant to mean "any tenant can read any
// other tenant's opportunity name" -- the tenant boundary is checked in code.

import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { serveWithLogger } from "../_shared/logger.ts";

serveWithLogger(async (req, logger, supabase) => {
  const headers = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      logger.warn(`Unauthorized request: ${authError}`);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Missing id" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // supabase client is already initialized with service role by
    // serveWithLogger -- requireAuth only checks *some* user is
    // authenticated, so the tenant boundary must be checked explicitly here.
    const { data: requesterRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", user.id);
    if (rolesError) {
      logger.error(`Failed to resolve requester roles for ${user.id}:`, { error: rolesError });
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

    const { data, error } = await supabase
      .from("opportunities")
      .select("id, name, tenant_id")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      logger.error(`Database error fetching opportunity ${id}: ${error.message}`, { error });
      throw error;
    }

    if (data && allowedTenantIds && !allowedTenantIds.has((data as any).tenant_id)) {
      return new Response(JSON.stringify({ error: "Forbidden: opportunity outside caller scope" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logger.error(`Error in get-opportunity-label:`, { error: error });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}, "get-opportunity-label");