// llm-directive-applicability — sixth production callsite for the unified
// LLM gateway, first AMRO LLM feature shipped from master plan §7.4 Phase
// 8 LLM features list (#1 directive applicability inference).
//
// Used by AMRO compliance workflows: when a directive (FAA AD / EASA SB /
// CAAC / SACAA equivalent) is configured against a tenant's fleet, the
// LLM evaluates whether the directive applies to each aircraft in scope.
// Output drives a human-in-the-loop triage queue. The output schema
// requires confidence + matched/unmatched criteria so the operator UI
// can show evidence-of-applicability before commit.
//
// Bias toward applies=true with lower confidence when inputs are
// incomplete — safety domain, false negatives matter.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { Logger } from "../_shared/logger.ts";

// @ts-ignore
declare const Deno: any;

const PROMPT_KEY = "amro.directive.applicability";

interface DirectiveInput {
  issuing_authority: string;
  directive_id: string;
  kind: string;
  title: string;
  effective_date: string;
  applies_to: string;
  compliance_action: string;
  relevant_ata_chapters?: string[];
}

interface AircraftInput {
  manufacturer: string;
  model: string;
  serial_number: string;
  registration?: string;
  engines?: Array<{ manufacturer?: string; model?: string; serial_number?: string }>;
  configurations?: string[];
  hours_since_new?: number | null;
  cycles_since_new?: number | null;
}

interface ApplicabilityRequest {
  directive: DirectiveInput;
  aircraft: AircraftInput;
}

function bad(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({
      error: { code: status === 401 ? "UNAUTHORIZED" : "INVALID_REQUEST", message },
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function parseInputs(raw: unknown): ApplicabilityRequest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  const d = r.directive as DirectiveInput | undefined;
  const a = r.aircraft as AircraftInput | undefined;
  if (!d || typeof d !== "object") return { error: "directive object required" };
  if (!a || typeof a !== "object") return { error: "aircraft object required" };
  // Validate required directive fields.
  for (const field of ["issuing_authority", "directive_id", "kind", "title", "effective_date", "applies_to", "compliance_action"] as const) {
    if (typeof d[field] !== "string" || !(d[field] as string).trim()) {
      return { error: `directive.${field} required (non-empty string)` };
    }
  }
  // Validate required aircraft fields.
  for (const field of ["manufacturer", "model", "serial_number"] as const) {
    if (typeof a[field] !== "string" || !(a[field] as string).trim()) {
      return { error: `aircraft.${field} required (non-empty string)` };
    }
  }
  return { directive: d, aircraft: a };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad("POST only", 405);

  const logger = new Logger("llm-directive-applicability");

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
      feature: "directive.applicability",
      prompt_key: PROMPT_KEY,
      variables: {
        directive: parsed.directive,
        aircraft: parsed.aircraft,
      },
      subject: {
        type: "amro_directive_x_aircraft",
        id: `${parsed.directive.directive_id}|${parsed.aircraft.serial_number}`,
      },
      required_capabilities: ["json_mode"],
    }),
  });

  const gatewayBody = await gatewayRes.json().catch(() => ({}));
  if (!gatewayRes.ok) {
    logger.error("gateway non-2xx", {
      status: gatewayRes.status,
      code: (gatewayBody as { error?: { code?: string } })?.error?.code,
      directive_id: parsed.directive.directive_id,
      aircraft_serial: parsed.aircraft.serial_number,
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
  logger.info("directive applicability evaluated", {
    user_id: user.id,
    tenant_id: profile.tenant_id,
    directive_id: parsed.directive.directive_id,
    issuing_authority: parsed.directive.issuing_authority,
    aircraft_serial: parsed.aircraft.serial_number,
    invocation_id: result.invocation_id,
    cost_usd: result.cost_usd,
    latency_ms: result.latency_ms,
    wall_ms: Date.now() - startedAt,
  });

  return new Response(
    JSON.stringify({
      directive_id: parsed.directive.directive_id,
      aircraft_serial: parsed.aircraft.serial_number,
      invocation_id: result.invocation_id,
      output: result.output,
      cost_usd: result.cost_usd,
      latency_ms: result.latency_ms,
      warnings: result.warnings,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
