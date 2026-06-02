// llm-classify-inbound — third production callsite for the unified
// LLM gateway. Called from the EmailDetailDialog "Classify with AI"
// button. Returns the gateway-rendered comms.inbound.classify prompt's
// structured output (intent + urgency + language + summary).
//
// Mirrors supabase/functions/llm-explain-hits + llm-score-lead.
//
// Env vars (shared):
//   LLM_GATEWAY_URL
//   LLM_GATEWAY_SERVICE_TOKEN
//   LLM_GATEWAY_PLATFORM_ID (default: logic-nexus-ai)

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { Logger } from "../_shared/logger.ts";

// @ts-ignore
declare const Deno: any;

const PROMPT_KEY = "comms.inbound.classify";

interface ClassifyRequest {
  message_id: string;
  message: {
    from: string;
    subject: string;
    body: string;
  };
}

function bad(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: { code: status === 401 ? "UNAUTHORIZED" : "INVALID_REQUEST", message } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function parseInputs(raw: unknown): ClassifyRequest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  const message_id = typeof r.message_id === "string" ? r.message_id : "";
  if (!message_id) return { error: "message_id required" };
  const m = r.message as ClassifyRequest["message"] | undefined;
  if (!m || typeof m.from !== "string" || typeof m.subject !== "string" || typeof m.body !== "string") {
    return { error: "message.from + .subject + .body required" };
  }
  // Cap body at 16 KB to match the gateway prompt's input_schema maxLength
  const trimmedBody = m.body.length > 16_000 ? m.body.slice(0, 16_000) : m.body;
  return {
    message_id,
    message: { from: m.from, subject: m.subject, body: trimmedBody },
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad("POST only", 405);

  const logger = new Logger("llm-classify-inbound");

  const { user, error: authErr, supabaseClient } = await requireAuth(req, logger);
  if (authErr || !user) return bad(authErr ?? "auth failed", 401);

  let body: unknown;
  try { body = await req.json(); } catch { return bad("invalid JSON body"); }
  const parsed = parseInputs(body);
  if ("error" in parsed) return bad(parsed.error);

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
  if (!gatewayUrl) return bad("gateway not configured", 503);
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
      module: "comms",
      feature: "inbound.classify",
      prompt_key: PROMPT_KEY,
      variables: { message: parsed.message },
      subject: { type: "email", id: parsed.message_id },
      required_capabilities: ["json_mode"],
    }),
  });

  const gatewayBody = await gatewayRes.json().catch(() => ({}));
  if (!gatewayRes.ok) {
    logger.error("gateway non-2xx", {
      status: gatewayRes.status,
      code: (gatewayBody as { error?: { code?: string } })?.error?.code,
      message_id: parsed.message_id,
    });
    return new Response(JSON.stringify(gatewayBody), {
      status: gatewayRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = gatewayBody as {
    invocation_id: string; output: unknown; cost_usd: number; latency_ms: number; warnings?: string[];
  };
  logger.info("classify-inbound completed", {
    user_id: user.id,
    tenant_id: profile.tenant_id,
    message_id: parsed.message_id,
    invocation_id: result.invocation_id,
    cost_usd: result.cost_usd,
    latency_ms: result.latency_ms,
    wall_ms: Date.now() - startedAt,
  });

  return new Response(
    JSON.stringify({
      message_id: parsed.message_id,
      invocation_id: result.invocation_id,
      output: result.output,
      cost_usd: result.cost_usd,
      latency_ms: result.latency_ms,
      warnings: result.warnings,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
