// provision-retail-user — post-signup Auth-hook handler.
//
// Triggered by Supabase Auth "After user is created" hook AND (as a
// fallback) by the frontend if the user lands on /onboarding without a
// provisioned tenant/franchise/portfolio.
//
// Wraps the markets.provision_new_retail_user(p_user_id uuid) SQL function
// which atomically creates:
//   - public.profiles
//   - public.user_roles (binds to SOS Services tenant + SOS-RETAIL franchise)
//   - markets.portfolios (paper mode, "My Portfolio")
//   - markets.paper_capital (₹1,00,000 initial / ₹70,000 available)
//   - markets.holdings (30% NIFTY 50 ETF seed at LTP)
//   - markets.retail_profile
//
// Idempotent — re-running for the same user is safe; returns the existing
// portfolio_id.
//
// verify_jwt is disabled because Auth hooks don't send a user JWT. The
// SQL function validates user_id by looking up auth.users — non-existent
// UUIDs raise EXCEPTION there. For public launch, harden by adding a
// webhook-signature check (Supabase Auth Hook HMAC) and/or a per-user
// JWT-sub match for the frontend retry path.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function extractUserId(body: any): string | null {
  if (!body) return null;
  if (body.record && typeof body.record.id === "string") return body.record.id;
  if (body.user   && typeof body.user.id   === "string") return body.user.id;
  if (typeof body.user_id === "string") return body.user_id;
  return null;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Body must be valid JSON" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const userId = extractUserId(body);
  if (!userId) {
    console.warn("provision-retail-user: unrecognised payload", {
      keys: body ? Object.keys(body) : [],
    });
    return new Response(JSON.stringify({
      error: "Could not extract user_id from payload",
      hint:  "Expect Auth hook { record: { id } } or { user_id } from frontend",
    }), { status: 400, headers: jsonHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    console.error("provision-retail-user: missing env");
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500, headers: jsonHeaders,
    });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const t0 = Date.now();
  const { data: portfolioId, error } = await supabase
    .schema("markets")
    .rpc("provision_new_retail_user", { p_user_id: userId });

  if (error) {
    console.error("provision-retail-user: RPC failed", {
      user_id:     userId,
      error:       error.message,
      duration_ms: Date.now() - t0,
    });
    return new Response(JSON.stringify({
      error:   "Provisioning failed",
      details: error.message,
      user_id: userId,
    }), { status: 500, headers: jsonHeaders });
  }

  console.log("provision-retail-user: success", {
    user_id:      userId,
    portfolio_id: portfolioId,
    duration_ms:  Date.now() - t0,
  });
  return new Response(JSON.stringify({
    ok:           true,
    user_id:      userId,
    portfolio_id: portfolioId,
  }), { status: 200, headers: jsonHeaders });
});
