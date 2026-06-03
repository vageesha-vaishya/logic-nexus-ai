// llm-aog-triage — seventh production callsite for the unified LLM
// Gateway, second AMRO LLM feature shipped from master plan §7.4
// Phase 8 LLM features list (#5 AOG triage).
//
// Use case: an AOG (Aircraft on Ground) alert arrives. The operations
// controller needs a structured triage plan within 60 seconds —
// priority, recommended actions ordered by deadline, parts to
// pre-order, escalation chain, MEL recommendation, safety flags.
//
// Time-critical: prompt sized at max_tokens=1500 + claude-sonnet-4-6
// for fast latency. Cache TTL is 0 because every AOG alert is unique.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { Logger } from "../_shared/logger.ts";

// @ts-ignore
declare const Deno: any;

const PROMPT_KEY = "amro.aog.triage";

interface TriageRequest {
  alert: Record<string, unknown>;
  aircraft: Record<string, unknown>;
  fleet_context: Record<string, unknown>;
}

function bad(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({
      error: { code: status === 401 ? "UNAUTHORIZED" : "INVALID_REQUEST", message },
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function parseInputs(raw: unknown): TriageRequest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  if (!r.alert || typeof r.alert !== "object") return { error: "alert object required" };
  if (!r.aircraft || typeof r.aircraft !== "object") return { error: "aircraft object required" };
  if (!r.fleet_context || typeof r.fleet_context !== "object") {
    return { error: "fleet_context object required" };
  }

  const alert = r.alert as Record<string, unknown>;
  for (const field of ["alert_id", "reported_at", "airport_iata", "defect_summary"] as const) {
    if (typeof alert[field] !== "string" || !(alert[field] as string).trim()) {
      return { error: `alert.${field} required (non-empty string)` };
    }
  }
  const aircraft = r.aircraft as Record<string, unknown>;
  for (const field of ["registration", "model", "serial_number"] as const) {
    if (typeof aircraft[field] !== "string" || !(aircraft[field] as string).trim()) {
      return { error: `aircraft.${field} required (non-empty string)` };
    }
  }

  return {
    alert,
    aircraft,
    fleet_context: r.fleet_context as Record<string, unknown>,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad("POST only", 405);

  const logger = new Logger("llm-aog-triage");

  const { user, error: authErr, supabaseClient } = await requireAuth(req, logger);
  if (authErr || !user) return bad(authErr ?? "auth failed", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("invalid JSON body");
  }
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
      module: "amro",
      feature: "aog.triage",
      prompt_key: PROMPT_KEY,
      variables: {
        alert: parsed.alert,
        aircraft: parsed.aircraft,
        fleet_context: parsed.fleet_context,
      },
      subject: {
        type: "amro_aog_alert",
        id: String(parsed.alert.alert_id),
      },
      required_capabilities: ["json_mode"],
    }),
  });

  const gatewayBody = await gatewayRes.json().catch(() => ({}));
  if (!gatewayRes.ok) {
    logger.error("gateway non-2xx", {
      status: gatewayRes.status,
      code: (gatewayBody as { error?: { code?: string } })?.error?.code,
      alert_id: parsed.alert.alert_id,
      aircraft_registration: parsed.aircraft.registration,
    });
    return new Response(JSON.stringify(gatewayBody), {
      status: gatewayRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = gatewayBody as {
    invocation_id: string;
    output: unknown;
    cost_usd: number;
    latency_ms: number;
    warnings?: string[];
  };
  logger.info("aog triage completed", {
    user_id: user.id,
    tenant_id: profile.tenant_id,
    alert_id: parsed.alert.alert_id,
    airport_iata: parsed.alert.airport_iata,
    aircraft_registration: parsed.aircraft.registration,
    invocation_id: result.invocation_id,
    cost_usd: result.cost_usd,
    latency_ms: result.latency_ms,
    wall_ms: Date.now() - startedAt,
  });

  return new Response(
    JSON.stringify({
      alert_id: parsed.alert.alert_id,
      invocation_id: result.invocation_id,
      output: result.output,
      cost_usd: result.cost_usd,
      latency_ms: result.latency_ms,
      warnings: result.warnings,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
