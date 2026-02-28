// Deno Edge Function: get-account-label
// Returns minimal label information (id, name) for an account id
// Uses service role to bypass tenant filters, but only exposes safe fields

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
    const id = payload?.id ?? payload?.accountId ?? payload?.account_id;
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing id" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // supabase client injected by serveWithLogger is already service role
    const { data, error } = await supabase
      .from("accounts")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      logger.error(`Error fetching account label for ${id}:`, { error: error });
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (!data) {
      return new Response(JSON.stringify({ id, name: null }), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ id: data.id, name: data.name }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    logger.error("Get Account Label Error:", { error: err });
    const msg = err?.message || "Unexpected error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}, "get-account-label");