// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// markets-portfolio-diagnostic — Phase 1 Addendum T19.
//
// GET (or POST) → returns today's portfolio health diagnostic for the
// authed user. Idempotent: one row per user per day in
// markets.portfolio_diagnostics. If today's row exists we return it
// without calling the LLM. Otherwise we compute metrics, ask the LLM
// for a structured JSON interpretation, and persist.
//
// The LLM contract is enforced in _shared/llm-gateway PROMPTS — the
// model is instructed to return a single JSON object matching:
//   { headline, findings[], suggested_actions[] }
// We parse + validate; if the model returns malformed JSON, we fall
// back to a templated diagnostic so the card never crashes on the user.

import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { checkDomainAccess, PlatformDomains } from "../_shared/domain-access.ts";
import { callLLM, LlmGatewayError } from "../_shared/llm-gateway.ts";
import { checkRateLimit, rlKey, rateLimitResponse, POLICIES } from "../_shared/rate-limit.ts";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

type ActionType = "rebalance" | "view_harvest" | "view_stress_test" | "view_portfolio";

interface SuggestedAction {
  type:    ActionType;
  tier?:   "foundation" | "core" | "satellite";
  symbol?: string;
  reason:  string;
}

interface DiagnosticPayload {
  headline:          string;
  findings:          string[];
  suggested_actions: SuggestedAction[];
  metrics: {
    concentration_score: number | null;
    tier_skew_score:     number | null;
    drawdown_score:      number | null;
    beta_score:          number | null;
    top1_symbol:         string | null;
    top1_weight_pct:     number | null;
    top3_weight_pct:     number | null;
  };
}

const TIER_NAME_BY_NUMBER: Record<number, "foundation" | "core" | "satellite"> = {
  1: "foundation",
  2: "core",
  3: "satellite",
};

const VALID_ACTION_TYPES: ReadonlySet<ActionType> = new Set([
  "rebalance",
  "view_harvest",
  "view_stress_test",
  "view_portfolio",
]);

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: `Method ${req.method} not allowed` }),
      { status: 405, headers: { ...jsonHeaders, Allow: "GET, POST, OPTIONS" } },
    );
  }

  try {
    const { user, error: authError, supabaseClient } = await requireAuth(req, logger);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: authError ?? "Unauthorized" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    const tenantId = req.headers.get("x-tenant-id");
    const franchiseId = req.headers.get("x-franchise-id");
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "Missing x-tenant-id header" }),
        { status: 400, headers: jsonHeaders },
      );
    }
    if (!franchiseId) {
      return new Response(
        JSON.stringify({ error: "Missing x-franchise-id header" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const access = await checkDomainAccess(supabaseAdmin, tenantId, PlatformDomains.MARKETS);
    if (!access.allowed) {
      return new Response(
        JSON.stringify({
          error: "Tenant does not have the markets domain enabled",
          reason: access.reason,
        }),
        { status: 403, headers: jsonHeaders },
      );
    }

    const marketsDb     = (supabaseClient as any).schema("markets");
    const marketsAdmin  = (supabaseAdmin  as any).schema("markets");
    const today         = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD

    // Idempotent fast path: return today's row if it exists.
    const { data: existing, error: existingErr } = await marketsDb
      .from("portfolio_diagnostics")
      .select("id, generated_at, payload, source, llm_model, llm_provider")
      .eq("user_id", user.id)
      .eq("generated_on", today)
      .maybeSingle();
    if (existingErr) {
      logger.warn("diagnostic lookup failed", { error: existingErr.message });
    }
    if (existing) {
      return new Response(
        JSON.stringify({ data: existing }),
        { status: 200, headers: jsonHeaders },
      );
    }

    // Rate limit only the generate path — cached reads above are free.
    const rl = await checkRateLimit(rlKey("diagnostic.generate", tenantId, user.id), POLICIES.llm_call);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    // 1. Latest risk score components — supplies 4 of the 5 metrics.
    const { data: riskRow } = await marketsDb
      .from("portfolio_risk_history")
      .select("score, target_score, components, computed_at")
      .eq("user_id", user.id)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Portfolio tiers — target allocations for the prompt.
    const { data: tiers } = await marketsDb
      .from("portfolio_tiers")
      .select("tier_number, name, portfolio_id, target_amount");
    const tierRows = (tiers ?? []) as Array<{
      tier_number: number; name: string; portfolio_id: string | null; target_amount: number | null;
    }>;
    const totalTarget = tierRows.reduce((s, t) => s + Number(t.target_amount ?? 0), 0);
    const targetAllocations: Record<string, number> = {};
    for (const t of tierRows) {
      const key = TIER_NAME_BY_NUMBER[t.tier_number] ?? t.name;
      const pct = totalTarget > 0 ? Math.round((Number(t.target_amount ?? 0) / totalTarget) * 100) : 0;
      targetAllocations[key] = pct;
    }

    // 3. Holdings — top-holding concentration computation.
    const portfolioIds = tierRows
      .map((t) => t.portfolio_id)
      .filter((x): x is string => !!x);
    let topHoldings: Array<{ symbol: string; weight_pct: number }> = [];
    let top1Weight  = 0;
    let top3Weight  = 0;
    let top1Symbol: string | null = null;

    if (portfolioIds.length > 0) {
      const { data: holdings } = await marketsDb
        .from("holdings")
        .select("instrument_id, qty, avg_cost")
        .in("portfolio_id", portfolioIds);
      const holdingRows = (holdings ?? []) as Array<{ instrument_id: string; qty: number; avg_cost: number }>;

      if (holdingRows.length > 0) {
        const instIds = Array.from(new Set(holdingRows.map((h) => h.instrument_id))).filter(Boolean);
        const { data: insts } = await marketsAdmin
          .from("instruments")
          .select("id, symbol")
          .in("id", instIds);
        const symbolById: Record<string, string> = {};
        for (const i of (insts ?? []) as Array<{ id: string; symbol: string }>) {
          symbolById[i.id] = i.symbol;
        }

        const valueBySymbol: Record<string, number> = {};
        let totalValue = 0;
        for (const h of holdingRows) {
          const sym = symbolById[h.instrument_id];
          if (!sym) continue;
          const v = Number(h.qty) * Number(h.avg_cost);
          if (!Number.isFinite(v) || v <= 0) continue;
          valueBySymbol[sym] = (valueBySymbol[sym] ?? 0) + v;
          totalValue += v;
        }

        if (totalValue > 0) {
          const ranked = Object.entries(valueBySymbol)
            .map(([symbol, v]) => ({ symbol, weight_pct: (v / totalValue) * 100 }))
            .sort((a, b) => b.weight_pct - a.weight_pct);
          topHoldings = ranked.slice(0, 5).map((h) => ({
            symbol: h.symbol,
            weight_pct: Math.round(h.weight_pct * 10) / 10,
          }));
          top1Symbol = topHoldings[0]?.symbol ?? null;
          top1Weight = topHoldings[0]?.weight_pct ?? 0;
          top3Weight = ranked.slice(0, 3).reduce((s, h) => s + h.weight_pct, 0);
          top3Weight = Math.round(top3Weight * 10) / 10;
        }
      }
    }

    // 4. Assemble metrics for the prompt.
    const components = (riskRow?.components ?? {}) as {
      concentration_score?: number;
      tier_skew_score?:     number;
      drawdown_score?:      number;
      beta_score?:          number;
    };
    const metricsJson = JSON.stringify({
      concentration_score: components.concentration_score ?? null,
      tier_skew_score:     components.tier_skew_score     ?? null,
      drawdown_score:      components.drawdown_score      ?? null,
      beta_score:          components.beta_score          ?? null,
      risk_score:          riskRow?.score        ?? null,
      target_score:        riskRow?.target_score ?? null,
      top1_symbol:         top1Symbol,
      top1_weight_pct:     top1Weight,
      top3_weight_pct:     top3Weight,
    });
    const topHoldingsJson      = JSON.stringify(topHoldings);
    const targetAllocationsJson = JSON.stringify(targetAllocations);

    const metricsBase = {
      concentration_score: components.concentration_score ?? null,
      tier_skew_score:     components.tier_skew_score     ?? null,
      drawdown_score:      components.drawdown_score      ?? null,
      beta_score:          components.beta_score          ?? null,
      top1_symbol:         top1Symbol,
      top1_weight_pct:     top1Weight || null,
      top3_weight_pct:     top3Weight || null,
    };

    // 5. LLM call.
    let llmResult;
    try {
      llmResult = await callLLM(
        "markets.portfolio_diagnostic",
        {
          metrics_json:             metricsJson,
          top_holdings_json:        topHoldingsJson,
          target_allocations_json:  targetAllocationsJson,
        },
        { tenantId, franchiseId, userId: user.id, supabaseAdmin, logger },
      );
    } catch (e: any) {
      // Templated fallback — diagnostic should never hard-fail on the user.
      const fallback = templatedFallback(metricsBase);
      const inserted = await persistDiagnostic({
        marketsAdmin, userId: user.id, today,
        payload: fallback, source: "fallback",
      }, logger);
      logger.warn("LLM gateway failed; templated fallback used", {
        error: e?.message ?? String(e),
        code: e instanceof LlmGatewayError ? e.code : "unknown",
      });
      return new Response(
        JSON.stringify({ data: inserted ?? { payload: fallback, source: "fallback" } }),
        { status: 200, headers: jsonHeaders },
      );
    }

    // 6. Parse + validate LLM JSON. Fall back to templated diagnostic on
    //    malformed output rather than show the user a broken card.
    const parsed = parseDiagnosticJson(llmResult.text, metricsBase);
    const source: "llm" | "fallback" = parsed.ok ? "llm" : "fallback";
    const payload: DiagnosticPayload = parsed.payload;

    const inserted = await persistDiagnostic({
      marketsAdmin, userId: user.id, today,
      payload, source,
      llmProvider: llmResult.provider,
      llmModel:    llmResult.model,
      inputTokens: llmResult.inputTokens,
      outputTokens: llmResult.outputTokens,
      costUsd:     llmResult.costUsd,
    }, logger);

    return new Response(
      JSON.stringify({ data: inserted ?? { payload, source } }),
      { status: 201, headers: jsonHeaders },
    );
  } catch (e: any) {
    logger.error("markets-portfolio-diagnostic unhandled", { error: e?.message ?? String(e) });
    return new Response(
      JSON.stringify({ error: e?.message ?? "Internal server error" }),
      { status: 500, headers: jsonHeaders },
    );
  }
}, "markets-portfolio-diagnostic");

// ─── Helpers ───────────────────────────────────────────────────────────

function parseDiagnosticJson(
  text: string,
  metricsBase: DiagnosticPayload["metrics"],
): { ok: boolean; payload: DiagnosticPayload } {
  // The model is instructed to return raw JSON — but be tolerant of code
  // fences in case it slips up.
  const cleaned = text.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  let obj: any;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    return { ok: false, payload: templatedFallback(metricsBase) };
  }

  const headline = typeof obj?.headline === "string" ? obj.headline.slice(0, 120) : "";
  const findings = Array.isArray(obj?.findings)
    ? obj.findings.filter((f: any) => typeof f === "string").slice(0, 3).map((f: string) => f.slice(0, 200))
    : [];
  const rawActions = Array.isArray(obj?.suggested_actions) ? obj.suggested_actions : [];
  const actions: SuggestedAction[] = [];
  for (const a of rawActions) {
    if (!a || typeof a !== "object") continue;
    const type = a.type;
    if (!VALID_ACTION_TYPES.has(type)) continue;
    const action: SuggestedAction = {
      type,
      reason: typeof a.reason === "string" ? a.reason.slice(0, 200) : "",
    };
    if (a.tier === "foundation" || a.tier === "core" || a.tier === "satellite") action.tier = a.tier;
    if (typeof a.symbol === "string" && a.symbol.length <= 20) action.symbol = a.symbol;
    actions.push(action);
    if (actions.length >= 4) break;
  }

  if (!headline) return { ok: false, payload: templatedFallback(metricsBase) };

  return {
    ok: true,
    payload: {
      headline,
      findings,
      suggested_actions: actions,
      metrics: metricsBase,
    },
  };
}

function templatedFallback(metrics: DiagnosticPayload["metrics"]): DiagnosticPayload {
  // Deterministic non-LLM diagnostic. Triggered when the LLM is
  // unavailable, the monthly budget is exceeded, or the model returns
  // unparseable output. Same JSON shape as the LLM path so the
  // frontend renders identically.
  const findings: string[] = [];
  const actions: SuggestedAction[] = [];

  if ((metrics.concentration_score ?? 0) >= 7 && metrics.top1_symbol && metrics.top1_weight_pct) {
    findings.push(`${metrics.top1_symbol} is ${metrics.top1_weight_pct.toFixed(1)}% of your portfolio — concentration is elevated.`);
    actions.push({ type: "rebalance", reason: "Concentration score is high." });
  }
  if ((metrics.tier_skew_score ?? 0) >= 6) {
    findings.push("Your allocation has drifted from your target plan.");
    if (!actions.some((a) => a.type === "rebalance")) {
      actions.push({ type: "rebalance", reason: "Tier allocation drift." });
    }
  }
  if ((metrics.drawdown_score ?? 0) >= 7) {
    findings.push("Recent drawdown is larger than usual — review stress-test scenarios.");
    actions.push({ type: "view_stress_test", reason: "Drawdown score is elevated." });
  }
  if ((metrics.beta_score ?? 0) >= 7) {
    findings.push("Portfolio beta is high — moves more than the market.");
  }

  const headline = findings.length === 0
    ? "Your portfolio looks on plan today."
    : "A couple of things to keep an eye on this week.";

  if (findings.length === 0) {
    findings.push("All headline risk indicators are within their target bands.");
  }

  return {
    headline,
    findings,
    suggested_actions: actions,
    metrics,
  };
}

async function persistDiagnostic(args: {
  marketsAdmin:  any;
  userId:        string;
  today:         string;
  payload:       DiagnosticPayload;
  source:        "llm" | "fallback";
  llmProvider?:  string;
  llmModel?:     string;
  inputTokens?:  number;
  outputTokens?: number;
  costUsd?:      number;
}, logger: any): Promise<any | null> {
  const { error, data } = await args.marketsAdmin
    .from("portfolio_diagnostics")
    .upsert({
      user_id:       args.userId,
      generated_on:  args.today,
      generated_at:  new Date().toISOString(),
      payload:       args.payload,
      source:        args.source,
      llm_provider:  args.llmProvider ?? null,
      llm_model:     args.llmModel    ?? null,
      input_tokens:  args.inputTokens ?? null,
      output_tokens: args.outputTokens ?? null,
      cost_usd:      args.costUsd     ?? null,
    }, { onConflict: "user_id,generated_on" })
    .select("id, generated_at, payload, source, llm_model, llm_provider")
    .single();
  if (error) {
    logger.warn("diagnostic persist failed", { error: error.message });
    return null;
  }
  return data;
}
