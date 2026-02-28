// Deno Edge Function: get-contact-label
// Returns minimal label information (id, first_name, last_name) for a contact id
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

    const { data, error } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, account_id")
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