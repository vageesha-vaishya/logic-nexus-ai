// llm-predict-quote-acceptance — thirteenth production callsite for
// the unified LLM Gateway, first quotation LLM feature. Master plan
// §7.4 Phase 10 Tier-1: given a draft quotation + customer history +
// optional competitive context, estimate P(accept) and propose 1-3
// specific, quantified adjustments.
//
// Non-modal: structured JSON only. Output is ADVISORY — the AM
// reviews and decides.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { Logger } from "../_shared/logger.ts";

// @ts-ignore
declare const Deno: any;

const PROMPT_KEY = "quotation.predict.acceptance";

type Mode =
  | "ocean_fcl" | "ocean_lcl" | "air" | "road" | "rail" | "multimodal" | "courier";

interface PredictRequest {
  quotation: {
    quote_id: string;
    customer_account_id: string;
    mode: Mode;
    lane: {
      origin_country: string;
      destination_country: string;
      origin_port_or_airport?: string | null;
      destination_port_or_airport?: string | null;
    };
    service_level: "standard" | "express" | "deferred" | "economy";
    total_amount: { amount: number; currency: string };
    line_count: number;
    top_lines: Array<{
      charge_code: string;
      label: string;
      amount: number;
      currency: string;
    }>;
    terms: {
      incoterm?: string | null;
      payment_terms_days: number;
      validity_days: number;
      credit_check_passed: boolean;
    };
    urgency_context: {
      requested_pickup_iso?: string | null;
      days_until_pickup?: number | null;
      spot_or_contract: "spot" | "contract";
    };
  };
  customer_history: {
    quotes_sent_last_180d: number;
    quotes_accepted_last_180d: number;
    quotes_rejected_last_180d: number;
    quotes_expired_unresponded_last_180d: number;
    typical_decision_window_hours?: number | null;
    acceptance_rate_pct?: number | null;
    avg_acceptance_value?: { amount: number; currency: string } | null;
    billing_reliability: "excellent" | "good" | "occasional_disputes" | "frequent_disputes" | "unknown";
    last_shipment_iso?: string | null;
    relationship_stage: "new_logo" | "active_account" | "winback" | "former_account" | "unknown";
  };
  competitive_context?: {
    lane_benchmark?: { amount: number; currency: string } | null;
    known_competitor_quote?: { amount: number; currency: string } | null;
    market_signal?: "rates_falling" | "rates_stable" | "rates_rising" | "unknown" | null;
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
const VALID_SERVICE_LEVELS = new Set(["standard", "express", "deferred", "economy"]);
const VALID_RELATIONSHIP_STAGES = new Set([
  "new_logo", "active_account", "winback", "former_account", "unknown",
]);
const VALID_BILLING_RELIABILITIES = new Set([
  "excellent", "good", "occasional_disputes", "frequent_disputes", "unknown",
]);

function parseInputs(raw: unknown): PredictRequest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body must be a JSON object" };
  const r = raw as Record<string, unknown>;

  const q = r.quotation as PredictRequest["quotation"] | undefined;
  if (!q || typeof q !== "object") return { error: "quotation object required" };
  if (typeof q.quote_id !== "string" || !q.quote_id) return { error: "quotation.quote_id required" };
  if (typeof q.customer_account_id !== "string" || !q.customer_account_id) {
    return { error: "quotation.customer_account_id required" };
  }
  if (!VALID_MODES.has(q.mode)) {
    return { error: `quotation.mode must be one of ${Array.from(VALID_MODES).join("|")}` };
  }
  if (!q.lane?.origin_country || !/^[A-Z]{2}$/.test(q.lane.origin_country)) {
    return { error: "quotation.lane.origin_country required (ISO-3166-1 alpha-2)" };
  }
  if (!q.lane?.destination_country || !/^[A-Z]{2}$/.test(q.lane.destination_country)) {
    return { error: "quotation.lane.destination_country required (ISO-3166-1 alpha-2)" };
  }
  if (!VALID_SERVICE_LEVELS.has(q.service_level)) {
    return { error: "quotation.service_level invalid" };
  }
  if (typeof q.total_amount?.amount !== "number" || !/^[A-Z]{3}$/.test(q.total_amount.currency || "")) {
    return { error: "quotation.total_amount.{amount,currency} required" };
  }
  if (!Array.isArray(q.top_lines)) return { error: "quotation.top_lines array required" };
  if (q.top_lines.length > 12) {
    return { error: "quotation.top_lines too large (max 12 — pass the largest by amount)" };
  }
  if (!q.terms || typeof q.terms.credit_check_passed !== "boolean") {
    return { error: "quotation.terms.credit_check_passed required" };
  }
  if (typeof q.terms.payment_terms_days !== "number" || typeof q.terms.validity_days !== "number") {
    return { error: "quotation.terms.{payment_terms_days,validity_days} required" };
  }
  if (!q.urgency_context || (q.urgency_context.spot_or_contract !== "spot" && q.urgency_context.spot_or_contract !== "contract")) {
    return { error: "quotation.urgency_context.spot_or_contract required" };
  }

  const h = r.customer_history as PredictRequest["customer_history"] | undefined;
  if (!h || typeof h !== "object") return { error: "customer_history object required" };
  if (!VALID_RELATIONSHIP_STAGES.has(h.relationship_stage)) {
    return { error: "customer_history.relationship_stage invalid" };
  }
  if (!VALID_BILLING_RELIABILITIES.has(h.billing_reliability)) {
    return { error: "customer_history.billing_reliability invalid" };
  }
  for (const k of [
    "quotes_sent_last_180d",
    "quotes_accepted_last_180d",
    "quotes_rejected_last_180d",
    "quotes_expired_unresponded_last_180d",
  ] as const) {
    if (typeof h[k] !== "number" || h[k] < 0) {
      return { error: `customer_history.${k} required (non-negative number)` };
    }
  }

  return {
    quotation: q,
    customer_history: h,
    competitive_context: (r.competitive_context as PredictRequest["competitive_context"]) ?? null,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad("POST only", 405);

  const logger = new Logger("llm-predict-quote-acceptance");

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
      module: "quotation",
      feature: "predict.acceptance",
      prompt_key: PROMPT_KEY,
      variables: {
        quotation: parsed.quotation,
        customer_history: parsed.customer_history,
        competitive_context: parsed.competitive_context,
      },
      subject: { type: "quotation", id: parsed.quotation.quote_id },
      required_capabilities: ["json_mode"],
    }),
  });

  const gatewayBody = await gatewayRes.json().catch(() => ({}));
  if (!gatewayRes.ok) {
    logger.error("gateway non-2xx", {
      status: gatewayRes.status,
      code: (gatewayBody as { error?: { code?: string } })?.error?.code,
      quote_id: parsed.quotation.quote_id,
      customer_account_id: parsed.quotation.customer_account_id,
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
  logger.info("predict quote acceptance completed", {
    user_id: user.id,
    tenant_id: profile.tenant_id,
    quote_id: parsed.quotation.quote_id,
    customer_account_id: parsed.quotation.customer_account_id,
    mode: parsed.quotation.mode,
    relationship_stage: parsed.customer_history.relationship_stage,
    has_benchmark: !!parsed.competitive_context?.lane_benchmark,
    has_competitor_quote: !!parsed.competitive_context?.known_competitor_quote,
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
