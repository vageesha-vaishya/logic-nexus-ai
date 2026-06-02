// llm-explain-hits — first production callsite for the unified LLM gateway.
// Per design §7.2 first-wave. Called by the compliance officer UI's
// "Explain hits" button on /dashboard/compliance/screenings/:id.
//
// Flow:
//   browser (JWT) → edge function:
//     1. requireAuth(req) — validates the user's session JWT
//     2. POST /v1/invoke (compliance.screening.hit_reasoning prompt) →
//        services/llm-gateway with the gateway service token from env
//     3. Return the gateway's structured output to the browser
//
// The gateway handles: PII redaction, 6-layer provider resolution,
// rendering the seeded prompt, A/B variant pick, provider call,
// un-redaction, audit, budget enforcement.
//
// Env vars:
//   LLM_GATEWAY_URL          — base URL of services/llm-gateway
//   LLM_GATEWAY_SERVICE_TOKEN — Bearer token (mint via gateway.mint_service_token)
//   LLM_GATEWAY_PLATFORM_ID  — defaults to 'logic-nexus-ai'

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { Logger } from "../_shared/logger.ts";

// @ts-ignore
declare const Deno: any;

const PROMPT_KEY = "compliance.screening.hit_reasoning";

interface ExplainHitsRequest {
  screening_id: string;
  party: { name: string; country: string; aliases?: string[] };
  hits: Array<{ list_name?: string; score?: number; matched_name?: string; [key: string]: unknown }>;
}

interface InvokeResponse {
  invocation_id: string;
  output: unknown;
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

function bad(message: string, status = 400, details?: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({ error: { code: status === 401 ? "UNAUTHORIZED" : "INVALID_REQUEST", message, details } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function parseInputs(raw: unknown): ExplainHitsRequest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  const screening_id = typeof r.screening_id === "string" ? r.screening_id : "";
  if (!screening_id) return { error: "screening_id required" };
  const party = r.party as ExplainHitsRequest["party"] | undefined;
  if (!party || typeof party.name !== "string" || typeof party.country !== "string") {
    return { error: "party.name + party.country required" };
  }
  const hits = Array.isArray(r.hits) ? (r.hits as ExplainHitsRequest["hits"]) : [];
  return { screening_id, party, hits };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad("POST only", 405);

  const logger = new Logger("llm-explain-hits");

  const { user, error: authErr, supabaseClient } = await requireAuth(req, logger);
  if (authErr || !user) return bad(authErr ?? "auth failed", 401);

  let body: unknown;
  try { body = await req.json(); } catch { return bad("invalid JSON body"); }
  const parsed = parseInputs(body);
  if ("error" in parsed) return bad(parsed.error);

  // Look up the tenant_id from the caller's session (RLS-respecting)
  const { data: profile, error: profileErr } = await supabaseClient
    .from("user_roles")
    .select("tenant_id")
    .eq("user_id", user.id).limit(1)
    .maybeSingle();
  if (profileErr || !profile?.tenant_id) {
    logger.error("tenant lookup failed", { user_id: user.id, err: profileErr?.message });
    return bad("tenant context not found", 403);
  }

  const gatewayUrl = Deno.env.get("LLM_GATEWAY_URL");
  if (!gatewayUrl) {
    logger.error("LLM_GATEWAY_URL not configured");
    return bad("gateway not configured", 503);
  }
  const serviceToken = Deno.env.get("LLM_GATEWAY_SERVICE_TOKEN");
  const platformId = Deno.env.get("LLM_GATEWAY_PLATFORM_ID") ?? "logic-nexus-ai";

  const startedAt = Date.now();
  const gatewayRes = await fetch(`${gatewayUrl.replace(/\/$/, "")}/v1/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(serviceToken ? { Authorization: `Bearer ${serviceToken}` } : {}),
      "X-Platform-Id": platformId,
      "X-Correlation-Id": req.headers.get("x-correlation-id") ?? crypto.randomUUID(),
    },
    body: JSON.stringify({
      tenant_id: profile.tenant_id,
      module: "compliance",
      feature: "screening.hit_reasoning",
      prompt_key: PROMPT_KEY,
      variables: {
        party: { name: parsed.party.name, country: parsed.party.country, aliases: parsed.party.aliases ?? [] },
        hits: parsed.hits,
      },
      subject: { type: "screening", id: parsed.screening_id },
      required_capabilities: ["json_mode"],
    }),
  });

  const gatewayBody = await gatewayRes.json().catch(() => ({}));
  if (!gatewayRes.ok) {
    logger.error("gateway non-2xx", {
      status: gatewayRes.status,
      code: (gatewayBody as { error?: { code?: string } })?.error?.code,
      screening_id: parsed.screening_id,
    });
    return new Response(JSON.stringify(gatewayBody), {
      status: gatewayRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = gatewayBody as InvokeResponse;
  logger.info("explain-hits completed", {
    user_id: user.id,
    tenant_id: profile.tenant_id,
    screening_id: parsed.screening_id,
    invocation_id: result.invocation_id,
    cost_usd: result.cost_usd,
    latency_ms: result.latency_ms,
    wall_ms: Date.now() - startedAt,
    warnings: result.warnings,
  });

  return new Response(
    JSON.stringify({
      screening_id: parsed.screening_id,
      invocation_id: result.invocation_id,
      output: result.output,
      cost_usd: result.cost_usd,
      latency_ms: result.latency_ms,
      warnings: result.warnings,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
