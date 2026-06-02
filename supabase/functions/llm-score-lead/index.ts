// llm-score-lead — second production callsite for the unified LLM gateway.
// Per design §7.2 first-wave. Called by LeadScoringCard's "AI rescore"
// button. Returns the gateway-rendered `sales.lead.score_evaluation`
// prompt's structured output (ai_score 1-10 + stage_fit + reasoning +
// next_action).
//
// Same pattern as supabase/functions/llm-explain-hits (compliance).
// Differs only in the prompt key and the variables shape.
//
// Env vars (shared with other gateway-calling edge functions):
//   LLM_GATEWAY_URL
//   LLM_GATEWAY_SERVICE_TOKEN
//   LLM_GATEWAY_PLATFORM_ID (default: logic-nexus-ai)

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { Logger } from "../_shared/logger.ts";

// @ts-ignore
declare const Deno: any;

const PROMPT_KEY = "sales.lead.score_evaluation";

interface ScoreLeadRequest {
  lead_id: string;
  lead: {
    company_name: string;
    title?: string;
    industry?: string;
    estimated_value?: number;
    source?: string;
    rule_score?: number;
  };
  activity_count?: number;
  activities?: Array<Record<string, unknown>>;
}

function bad(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: { code: status === 401 ? "UNAUTHORIZED" : "INVALID_REQUEST", message } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function parseInputs(raw: unknown): ScoreLeadRequest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  const lead_id = typeof r.lead_id === "string" ? r.lead_id : "";
  if (!lead_id) return { error: "lead_id required" };
  const lead = r.lead as ScoreLeadRequest["lead"] | undefined;
  if (!lead || typeof lead.company_name !== "string" || lead.company_name.length === 0) {
    return { error: "lead.company_name required" };
  }
  return {
    lead_id,
    lead,
    activity_count: typeof r.activity_count === "number" ? r.activity_count : undefined,
    activities: Array.isArray(r.activities) ? (r.activities as Array<Record<string, unknown>>) : undefined,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad("POST only", 405);

  const logger = new Logger("llm-score-lead");

  const { user, error: authErr, supabaseClient } = await requireAuth(req, logger);
  if (authErr || !user) return bad(authErr ?? "auth failed", 401);

  let body: unknown;
  try { body = await req.json(); } catch { return bad("invalid JSON body"); }
  const parsed = parseInputs(body);
  if ("error" in parsed) return bad(parsed.error);

  // Tenant context from the caller's role row (RLS-respecting).
  const { data: profile, error: profileErr } = await supabaseClient
    .from("user_roles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
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
      module: "sales",
      feature: "lead.score_evaluation",
      prompt_key: PROMPT_KEY,
      variables: {
        lead: parsed.lead,
        activity_count: parsed.activity_count ?? 0,
        activities: parsed.activities ?? [],
      },
      subject: { type: "lead", id: parsed.lead_id },
      required_capabilities: ["json_mode"],
    }),
  });

  const gatewayBody = await gatewayRes.json().catch(() => ({}));
  if (!gatewayRes.ok) {
    logger.error("gateway non-2xx", {
      status: gatewayRes.status,
      code: (gatewayBody as { error?: { code?: string } })?.error?.code,
      lead_id: parsed.lead_id,
    });
    return new Response(JSON.stringify(gatewayBody), {
      status: gatewayRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = gatewayBody as {
    invocation_id: string; output: unknown; cost_usd: number; latency_ms: number; warnings?: string[];
  };
  logger.info("score-lead completed", {
    user_id: user.id,
    tenant_id: profile.tenant_id,
    lead_id: parsed.lead_id,
    invocation_id: result.invocation_id,
    cost_usd: result.cost_usd,
    latency_ms: result.latency_ms,
    wall_ms: Date.now() - startedAt,
  });

  return new Response(
    JSON.stringify({
      lead_id: parsed.lead_id,
      invocation_id: result.invocation_id,
      output: result.output,
      cost_usd: result.cost_usd,
      latency_ms: result.latency_ms,
      warnings: result.warnings,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
