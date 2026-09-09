// Deno Edge Function: get-contact-label
// Returns minimal label information (id, first_name, last_name) for a contact id
// Uses service role to bypass tenant filters, but only exposes safe fields.
// "Bypass tenant filters" was never meant to mean "any tenant can read any
// other tenant's contact name" -- the tenant boundary is checked in code.

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
    const id = payload?.id ?? payload?.contactId ?? payload?.contact_id;
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing id" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // requireAuth only checks *some* user is authenticated, so the tenant
    // boundary must be checked explicitly here.
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
      .from("v_contacts")
      .select("id, first_name, last_name, account_id, tenant_id")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      logger.error(`Database error fetching contact ${id}:`, { error: error });
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (!data) {
      return new Response(JSON.stringify({ id, first_name: null, last_name: null, account_id: null }), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (allowedTenantIds && !allowedTenantIds.has(data.tenant_id)) {
      return new Response(JSON.stringify({ error: "Forbidden: contact outside caller scope" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ id: data.id, first_name: data.first_name, last_name: data.last_name, account_id: data.account_id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = (err as any)?.message || "Unexpected error";
    logger.error(`Error in get-contact-label:`, { error: err });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}, "get-contact-label");