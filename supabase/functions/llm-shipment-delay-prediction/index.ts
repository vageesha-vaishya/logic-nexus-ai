// llm-shipment-delay-prediction — fourteenth production callsite for
// the unified LLM Gateway, first Phase 10 Tier-2 logistics feature.
// Given a shipment + carrier history + lane conditions, predict
// breach probability + slip hours + risk factors + mitigation options.
//
// Non-modal: structured JSON only.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { Logger } from "../_shared/logger.ts";

// @ts-ignore
declare const Deno: any;

const PROMPT_KEY = "logistics.shipment.delay_prediction";

type Mode =
  | "ocean_fcl" | "ocean_lcl" | "air" | "road" | "rail" | "multimodal" | "courier";

interface DelayPredictionRequest {
  shipment: {
    shipment_id: string;
    mode: Mode;
    origin: { country: string; port_or_airport?: string | null };
    destination: { country: string; port_or_airport?: string | null };
    committed_delivery_iso: string;
    current_status: string;
    last_known_location?: string | null;
    last_update_iso: string;
    days_in_transit_so_far: number;
    declared_value?: { amount: number; currency: string } | null;
    hazmat?: { is_hazmat: boolean; un_numbers: string[] } | null;
  };
  carrier_history: {
    carrier_name?: string | null;
    on_time_rate_pct_lane_90d?: number | null;
    on_time_rate_pct_global_90d?: number | null;
    avg_transit_days_lane?: number | null;
    shipments_observed_lane_90d?: number | null;
    recent_disruption_count_30d: number;
    reliability_tier: "tier_1" | "tier_2" | "tier_3" | "unknown";
  };
  lane_conditions: {
    port_congestion_signal: "low" | "medium" | "high" | "critical" | "unknown";
    weather_disruption: "none" | "watch" | "active" | "severe" | "unknown";
    customs_processing_delay_days?: number | null;
    holiday_or_strike_flag: boolean;
    alternative_routes_available: number;
  };
}

function bad(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({
      error: { code: status === 401 ? "UNAUTHORIZED" : "INVALID_REQUEST", message },
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

const VALID_MODES = new Set(["ocean_fcl", "ocean_lcl", "air", "road", "rail", "multimodal", "courier"]);
const VALID_STATUSES = new Set([
  "booked", "picked_up", "in_transit_origin", "departed_origin", "in_transit",
  "arrived_destination_port", "customs", "out_for_delivery", "delivered", "exception",
]);
const VALID_TIERS = new Set(["tier_1", "tier_2", "tier_3", "unknown"]);
const VALID_CONGESTION = new Set(["low", "medium", "high", "critical", "unknown"]);
const VALID_WEATHER = new Set(["none", "watch", "active", "severe", "unknown"]);

function parseInputs(raw: unknown): DelayPredictionRequest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  const s = r.shipment as DelayPredictionRequest["shipment"] | undefined;
  if (!s || typeof s !== "object") return { error: "shipment object required" };
  if (typeof s.shipment_id !== "string" || !s.shipment_id) return { error: "shipment.shipment_id required" };
  if (!VALID_MODES.has(s.mode)) return { error: `shipment.mode must be one of ${Array.from(VALID_MODES).join("|")}` };
  if (!s.origin?.country || !/^[A-Z]{2}$/.test(s.origin.country)) return { error: "shipment.origin.country required (ISO-3166)" };
  if (!s.destination?.country || !/^[A-Z]{2}$/.test(s.destination.country)) return { error: "shipment.destination.country required (ISO-3166)" };
  if (typeof s.committed_delivery_iso !== "string") return { error: "shipment.committed_delivery_iso required" };
  if (!VALID_STATUSES.has(s.current_status)) return { error: "shipment.current_status invalid enum" };
  if (typeof s.last_update_iso !== "string") return { error: "shipment.last_update_iso required" };
  if (typeof s.days_in_transit_so_far !== "number") return { error: "shipment.days_in_transit_so_far required" };

  const h = r.carrier_history as DelayPredictionRequest["carrier_history"] | undefined;
  if (!h || typeof h !== "object") return { error: "carrier_history object required" };
  if (typeof h.recent_disruption_count_30d !== "number") return { error: "carrier_history.recent_disruption_count_30d required" };
  if (!VALID_TIERS.has(h.reliability_tier)) return { error: "carrier_history.reliability_tier invalid" };

  const l = r.lane_conditions as DelayPredictionRequest["lane_conditions"] | undefined;
  if (!l || typeof l !== "object") return { error: "lane_conditions object required" };
  if (!VALID_CONGESTION.has(l.port_congestion_signal)) return { error: "lane_conditions.port_congestion_signal invalid" };
  if (!VALID_WEATHER.has(l.weather_disruption)) return { error: "lane_conditions.weather_disruption invalid" };
  if (typeof l.holiday_or_strike_flag !== "boolean") return { error: "lane_conditions.holiday_or_strike_flag required" };
  if (typeof l.alternative_routes_available !== "number") return { error: "lane_conditions.alternative_routes_available required" };

  return { shipment: s, carrier_history: h, lane_conditions: l };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad("POST only", 405);

  const logger = new Logger("llm-shipment-delay-prediction");

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
      feature: "shipment.delay_prediction",
      prompt_key: PROMPT_KEY,
      variables: {
        shipment: parsed.shipment,
        carrier_history: parsed.carrier_history,
        lane_conditions: parsed.lane_conditions,
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
  logger.info("delay prediction completed", {
    user_id: user.id,
    tenant_id: profile.tenant_id,
    shipment_id: parsed.shipment.shipment_id,
    mode: parsed.shipment.mode,
    current_status: parsed.shipment.current_status,
    carrier_tier: parsed.carrier_history.reliability_tier,
    congestion: parsed.lane_conditions.port_congestion_signal,
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
