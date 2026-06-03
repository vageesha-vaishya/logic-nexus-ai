// llm-charges-suggestion — second logistics LLM feature. Master plan §7.4
// Phase 10 Tier-1: given a shipment + carrier + optional historical-rate
// hints, propose a complete operator-reviewable charge spine (freight,
// THC, fuel, surcharges, customs filing, etc.) with magnitudes,
// rationale, and incoterm-driven payable_by allocation.
//
// Non-modal: this feature takes structured JSON only. The gateway
// invocation does NOT carry image/PDF attachments.
//
// Output drives an operator-reviewed invoice draft — magnitudes are
// estimates and the operator confirms before commit.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { Logger } from "../_shared/logger.ts";

// @ts-ignore
declare const Deno: any;

const PROMPT_KEY = "logistics.charges.suggestion";

type Mode =
  | "ocean_fcl"
  | "ocean_lcl"
  | "air"
  | "road"
  | "rail"
  | "multimodal"
  | "courier";

interface ChargesRequest {
  shipment: {
    shipment_id: string;
    mode: Mode;
    origin: { country: string; port_or_airport?: string | null; city?: string | null };
    destination: { country: string; port_or_airport?: string | null; city?: string | null };
    packages: {
      total_pieces?: number | null;
      total_weight_kg?: number | null;
      total_volume_m3?: number | null;
      chargeable_weight_kg?: number | null;
    };
    containers?: Array<{ type: string; count: number }> | null;
    hazmat: { is_hazmat: boolean; un_numbers: string[]; imdg_class?: string | null };
    temp_controlled: { required: boolean; range_celsius?: string | null };
    incoterm?: string | null;
    currency: string;
    declared_value?: { amount?: number | null; currency?: string | null };
    line_items: Array<{
      description: string;
      hs_code?: string | null;
      qty: number;
      weight_kg?: number | null;
    }>;
    service_terms: {
      door_pickup: boolean;
      door_delivery: boolean;
      customs_clearance: "origin" | "destination" | "both" | "neither";
    };
  };
  carrier: {
    name?: string | null;
    type?: string | null;
    service_level?: string | null;
  };
  tariff_hints?: {
    lane_avg_charges?: Array<{ charge_code: string; amount: number; currency: string }> | null;
    last_invoiced_on_lane?: string | null;
    fuel_surcharge_pct?: number | null;
  } | null;
}

function bad(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({
      error: { code: status === 401 ? "UNAUTHORIZED" : "INVALID_REQUEST", message },
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

const VALID_MODES = new Set([
  "ocean_fcl", "ocean_lcl", "air", "road", "rail", "multimodal", "courier",
]);

function parseInputs(raw: unknown): ChargesRequest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  const s = r.shipment as ChargesRequest["shipment"] | undefined;
  if (!s || typeof s !== "object") return { error: "shipment object required" };
  if (typeof s.shipment_id !== "string" || !s.shipment_id) {
    return { error: "shipment.shipment_id required" };
  }
  if (!VALID_MODES.has(s.mode)) {
    return { error: `shipment.mode must be one of ${Array.from(VALID_MODES).join("|")}` };
  }
  if (!s.origin?.country || !/^[A-Z]{2}$/.test(s.origin.country)) {
    return { error: "shipment.origin.country required (ISO-3166-1 alpha-2)" };
  }
  if (!s.destination?.country || !/^[A-Z]{2}$/.test(s.destination.country)) {
    return { error: "shipment.destination.country required (ISO-3166-1 alpha-2)" };
  }
  if (typeof s.currency !== "string" || !/^[A-Z]{3}$/.test(s.currency)) {
    return { error: "shipment.currency required (ISO-4217)" };
  }
  if (!s.packages || typeof s.packages !== "object") {
    return { error: "shipment.packages object required (fields may be null)" };
  }
  if (!s.hazmat || typeof s.hazmat.is_hazmat !== "boolean") {
    return { error: "shipment.hazmat.is_hazmat required" };
  }
  if (!s.temp_controlled || typeof s.temp_controlled.required !== "boolean") {
    return { error: "shipment.temp_controlled.required required" };
  }
  if (!Array.isArray(s.line_items)) {
    return { error: "shipment.line_items array required (may be empty)" };
  }
  if (!s.service_terms || typeof s.service_terms.door_pickup !== "boolean") {
    return { error: "shipment.service_terms required" };
  }
  const c = r.carrier as ChargesRequest["carrier"] | undefined;
  if (!c || typeof c !== "object") return { error: "carrier object required (fields may be null)" };

  return {
    shipment: s,
    carrier: c,
    tariff_hints: (r.tariff_hints as ChargesRequest["tariff_hints"]) ?? null,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad("POST only", 405);

  const logger = new Logger("llm-charges-suggestion");

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
      module: "logistics",
      feature: "charges.suggestion",
      prompt_key: PROMPT_KEY,
      variables: {
        shipment: parsed.shipment,
        carrier: parsed.carrier,
        tariff_hints: parsed.tariff_hints,
      },
      subject: { type: "shipment", id: parsed.shipment.shipment_id },
      required_capabilities: ["json_mode"],
    }),
  });

  const gatewayBody = await gatewayRes.json().catch(() => ({}));
  if (!gatewayRes.ok) {
    logger.error("gateway non-2xx", {
      status: gatewayRes.status,
      code: (gatewayBody as { error?: { code?: string } })?.error?.code,
      shipment_id: parsed.shipment.shipment_id,
      mode: parsed.shipment.mode,
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
  logger.info("charges suggestion completed", {
    user_id: user.id,
    tenant_id: profile.tenant_id,
    shipment_id: parsed.shipment.shipment_id,
    mode: parsed.shipment.mode,
    origin_country: parsed.shipment.origin.country,
    destination_country: parsed.shipment.destination.country,
    incoterm: parsed.shipment.incoterm,
    hazmat: parsed.shipment.hazmat.is_hazmat,
    temp_controlled: parsed.shipment.temp_controlled.required,
    invocation_id: result.invocation_id,
    cost_usd: result.cost_usd,
    latency_ms: result.latency_ms,
    wall_ms: Date.now() - startedAt,
  });

  return new Response(
    JSON.stringify({
      invocation_id: result.invocation_id,
      output: result.output,
      cost_usd: result.cost_usd,
      latency_ms: result.latency_ms,
      warnings: result.warnings,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
