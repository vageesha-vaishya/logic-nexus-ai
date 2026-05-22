// provision-retail-user — post-signup Auth-hook dispatcher.
//
// Originally retail-only (hence the legacy URL); now the universal post-
// signup handler for the unified onboarding architecture (2026-05-22).
// Branches on raw_user_meta_data.domain_code on the auth.users row:
//
//   • undefined / 'sthira-retail' / 'SOS-RETAIL'   → retail flow
//       calls markets.provision_new_retail_user — creates portfolio, paper
//       cash, NIFTY ETF seed, retail_profile.
//
//   • 'logistics'                                  → B2B Logistics flow
//   • 'markets'                                    → B2B Markets-advisor flow
//       both call public.provision_org_tenant — creates tenant + default
//       franchise + tenant_admin user_roles + freemium tenant_domain_assignment
//       + user_active_membership.
//
// Triggered by Supabase Auth "After user is created" hook AND (as a
// fallback) by the frontend if the user lands on /onboarding without a
// provisioned account.
//
// Idempotent everywhere — re-running for the same user_id is a no-op
// that returns the existing ids. verify_jwt is disabled because Auth
// hooks don't send a user JWT. The SQL functions validate user_id by
// looking up auth.users — non-existent UUIDs raise EXCEPTION there.
//
// See:
//   - docs/plans/2026-05-22-unified-platform-onboarding-design.md
//   - docs/Runbooks/2026-05-22-supabase-auth-hook-config.md (webhook URL)

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

// Extract the signup metadata that the wizard wrote into raw_user_meta_data
// (see /signup/[domain] form: domain_code, org_name, country, first_name,
// last_name). The Auth-hook payload exposes it on body.record.raw_user_meta_data;
// the frontend-fallback payload exposes it on body.meta.
function extractMeta(body: any): {
  domain_code: string | null;
  org_name:    string | null;
  country:     string | null;
} {
  const meta =
    (body?.record?.raw_user_meta_data as Record<string, unknown> | undefined) ??
    (body?.meta as Record<string, unknown> | undefined) ??
    {};
  return {
    domain_code: typeof meta.domain_code === "string" ? meta.domain_code : null,
    org_name:    typeof meta.org_name    === "string" ? meta.org_name    : null,
    country:     typeof meta.country     === "string" ? meta.country     : null,
  };
}

// Map every supported domain_code value to a flow. Anything we don't
// recognise (including missing) falls through to retail — preserves the
// pre-2026-05-22 behaviour for users who signed up via the Sthira flow.
function pickFlow(code: string | null): "retail" | "logistics" | "markets" {
  if (code === "logistics") return "logistics";
  if (code === "markets")   return "markets";
  return "retail";
}

Deno.serve(async (req: Request) => {
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
    console.warn("provision-on-signup: unrecognised payload", {
      keys: body ? Object.keys(body) : [],
    });
    return new Response(JSON.stringify({
      error: "Could not extract user_id from payload",
      hint:  "Expect Auth hook { record: { id } } or { user_id } from frontend",
    }), { status: 400, headers: jsonHeaders });
  }

  const meta = extractMeta(body);
  const flow = pickFlow(meta.domain_code);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    console.error("provision-on-signup: missing env");
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500, headers: jsonHeaders,
    });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const t0 = Date.now();

  // ── Retail flow ─────────────────────────────────────────────────────────
  if (flow === "retail") {
    const { data: portfolioId, error } = await supabase
      .schema("markets")
      .rpc("provision_new_retail_user", { p_user_id: userId });

    if (error) {
      console.error("provision-on-signup: retail RPC failed", {
        user_id:     userId,
        error:       error.message,
        duration_ms: Date.now() - t0,
      });
      return new Response(JSON.stringify({
        error:   "Provisioning failed",
        details: error.message,
        user_id: userId,
        flow:    "retail",
      }), { status: 500, headers: jsonHeaders });
    }

    console.log("provision-on-signup: retail ok", {
      user_id:      userId,
      portfolio_id: portfolioId,
      duration_ms:  Date.now() - t0,
    });
    return new Response(JSON.stringify({
      ok:           true,
      flow:         "retail",
      user_id:      userId,
      portfolio_id: portfolioId,
    }), { status: 200, headers: jsonHeaders });
  }

  // ── B2B org flows (logistics, markets) ──────────────────────────────────
  if (!meta.org_name) {
    console.error("provision-on-signup: org_name missing for B2B signup", {
      user_id: userId, domain_code: meta.domain_code,
    });
    return new Response(JSON.stringify({
      error: "org_name is required for B2B signup",
      user_id: userId,
      domain_code: meta.domain_code,
    }), { status: 400, headers: jsonHeaders });
  }

  const { data: result, error } = await supabase
    .rpc("provision_org_tenant", {
      p_user_id:     userId,
      p_domain_code: flow,
      p_org_name:    meta.org_name,
      p_country:     meta.country ?? "IN",
    });

  if (error) {
    console.error("provision-on-signup: org RPC failed", {
      user_id:     userId,
      domain_code: flow,
      org_name:    meta.org_name,
      error:       error.message,
      duration_ms: Date.now() - t0,
    });
    return new Response(JSON.stringify({
      error:   "Provisioning failed",
      details: error.message,
      user_id: userId,
      flow,
    }), { status: 500, headers: jsonHeaders });
  }

  console.log("provision-on-signup: org ok", {
    user_id:     userId,
    flow,
    result,
    duration_ms: Date.now() - t0,
  });
  return new Response(JSON.stringify({
    ok:      true,
    flow,
    user_id: userId,
    ...(typeof result === "object" && result !== null ? result : {}),
  }), { status: 200, headers: jsonHeaders });
});
