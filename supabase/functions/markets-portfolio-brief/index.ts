// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// markets-portfolio-brief — generate (and persist) an AI-written brief
// for a specific portfolio.
//
// POST { portfolio_id: uuid }
// Headers: Authorization: Bearer <user_jwt>, x-tenant-id, x-franchise-id
//
// Flow:
//   1. requireAuth (JWT-scoped supabaseClient → RLS applies)
//   2. checkDomainAccess('markets') for the tenant
//   3. Load the portfolio via the JWT-scoped client → RLS confirms ownership
//   4. Load holdings (may be empty in v1 — no real holdings ingested yet)
//   5. Load recent news (last 7 days, top 12) via service-role
//      (markets.news_events is shared reference data; the user-scoped client
//      also has SELECT, but we use admin here to keep the load deterministic)
//   6. callLLM('markets.daily_brief', { portfolio_name, holdings_json, news_json })
//   7. Insert into markets.briefs via the JWT-scoped client (RLS owner-insert)
//   8. Return brief + LLM usage metadata
//
// Per design doc §11 T2: "LLM analysis engines: Brief Generator". This is
// the headline markets-domain feature; everything we've built (Gateway,
// news, primitives) lands here.

import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { checkDomainAccess, PlatformDomains } from "../_shared/domain-access.ts";
import { callLLM, LlmGatewayError } from "../_shared/llm-gateway.ts";
import { checkRateLimit, rlKey, rateLimitResponse, POLICIES } from "../_shared/rate-limit.ts";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

interface BriefRequest {
  portfolio_id: string;
}

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: `Method ${req.method} not allowed` }),
      { status: 405, headers: { ...jsonHeaders, Allow: "POST, OPTIONS" } },
    );
  }

  try {
    // 1. Auth
    const { user, error: authError, supabaseClient } = await requireAuth(req, logger);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: authError ?? "Unauthorized" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    // 2. Tenant context
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

    // 3. Rate limit — LLM calls are expensive; 20/min per tenant
    const rl = await checkRateLimit(rlKey("brief.generate", tenantId, user.id), POLICIES.llm_call);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    // 4. Domain access (markets must be enabled for this tenant)
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

    // 4. Body
    let body: BriefRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: jsonHeaders },
      );
    }
    const portfolioId = body?.portfolio_id;
    if (!portfolioId || typeof portfolioId !== "string") {
      return new Response(
        JSON.stringify({ error: "portfolio_id is required (uuid string)" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // 5. Load the portfolio (JWT-scoped → RLS confirms it's owned by this user)
    const marketsDb = (supabaseClient as any).schema("markets");
    const { data: portfolio, error: portfolioErr } = await marketsDb
      .from("portfolios")
      .select("id, name, description, mode, base_currency")
      .eq("id", portfolioId)
      .maybeSingle();
    if (portfolioErr) {
      logger.error("portfolio load failed", { error: portfolioErr.message });
      return new Response(
        JSON.stringify({ error: portfolioErr.message }),
        { status: 500, headers: jsonHeaders },
      );
    }
    if (!portfolio) {
      // RLS-hidden or genuinely absent — same error from the user's perspective.
      return new Response(
        JSON.stringify({ error: "Portfolio not found or not accessible" }),
        { status: 404, headers: jsonHeaders },
      );
    }

    // 6a. Load holdings (may be empty in v1).
    const { data: holdings, error: holdingsErr } = await marketsDb
      .from("holdings")
      .select("instrument_id, qty, avg_cost")
      .eq("portfolio_id", portfolioId);
    if (holdingsErr) {
      logger.warn("holdings load failed", { error: holdingsErr.message });
    }

    // 6b. Load the user's watchlists and their items (RLS-scoped). We use these
    //     to bias news selection toward instruments the user actually cares about
    //     and to give the LLM a concise "what I track" summary.
    const { data: watchlists } = await marketsDb
      .from("watchlists")
      .select("id, name, is_default");
    const { data: watchlistItems } = await marketsDb
      .from("watchlist_items")
      .select("watchlist_id, instrument_id, note");

    // 6c. Look up symbols for every instrument referenced by holdings + watchlists.
    const trackedInstrumentIds = Array.from(new Set([
      ...((holdings ?? []) as any[]).map((h) => h.instrument_id),
      ...((watchlistItems ?? []) as any[]).map((i) => i.instrument_id),
    ].filter(Boolean)));

    const instrumentBySymbol: Record<string, any> = {};
    const instrumentById: Record<string, any> = {};
    if (trackedInstrumentIds.length > 0) {
      const { data: insts } = await (supabaseAdmin as any)
        .schema("markets")
        .from("instruments")
        .select("id, symbol, exchange, instrument_type, isin")
        .in("id", trackedInstrumentIds);
      for (const i of (insts ?? []) as any[]) {
        instrumentById[i.id] = i;
        instrumentBySymbol[i.symbol] = i;
      }
    }

    const trackedSymbols = Array.from(new Set([
      ...((holdings ?? []) as any[]).map((h) => instrumentById[h.instrument_id]?.symbol),
      ...((watchlistItems ?? []) as any[]).map((i) => instrumentById[i.instrument_id]?.symbol),
    ].filter(Boolean) as string[]));

    // Build a compact `{ "watchlist name": ["SYMBOL", ...] }` shape for the prompt.
    const watchlistByName: Record<string, string[]> = {};
    for (const item of (watchlistItems ?? []) as any[]) {
      const wl = (watchlists ?? []).find((w: any) => w.id === item.watchlist_id);
      const sym = instrumentById[item.instrument_id]?.symbol;
      if (!wl || !sym) continue;
      if (!watchlistByName[wl.name]) watchlistByName[wl.name] = [];
      watchlistByName[wl.name].push(sym);
    }

    // 7. News selection. Strategy:
    //    a) prioritized: up to 12 items in the last 7 days mentioning any tracked symbol
    //    b) fall back to top general news to fill the remainder
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const NEWS_LIMIT = 12;

    let news: any[] = [];
    if (trackedSymbols.length > 0) {
      const { data: focused, error: focusedErr } = await (supabaseAdmin as any)
        .schema("markets")
        .from("news_events")
        .select("id, ts, source, title, instruments, sentiment_score, raw_url")
        .gte("ts", sevenDaysAgo)
        .overlaps("instruments", trackedSymbols)
        .order("ts", { ascending: false })
        .limit(NEWS_LIMIT);
      if (focusedErr) {
        logger.warn("focused news load failed", { error: focusedErr.message });
      } else {
        news = focused ?? [];
      }
    }

    const remaining = NEWS_LIMIT - news.length;
    if (remaining > 0) {
      const excludeIds = news.map((n: any) => n.id);
      let q = (supabaseAdmin as any)
        .schema("markets")
        .from("news_events")
        .select("id, ts, source, title, instruments, sentiment_score, raw_url")
        .gte("ts", sevenDaysAgo)
        .order("ts", { ascending: false })
        .limit(remaining);
      // PostgREST `not in (...)` requires the literal list — only add when non-empty.
      if (excludeIds.length > 0) {
        q = q.not("id", "in", `(${excludeIds.join(",")})`);
      }
      const { data: general, error: generalErr } = await q;
      if (generalErr) {
        logger.warn("general news load failed", { error: generalErr.message });
      } else {
        news = [...news, ...(general ?? [])];
      }
    }

    const holdingsJson = JSON.stringify(holdings ?? []);
    const newsJson = JSON.stringify(news);
    const watchlistJson = JSON.stringify(watchlistByName);
    const trackedSymbolsCsv = trackedSymbols.join(", ") || "(none)";

    // 8. LLM Gateway call
    let llmResult;
    try {
      llmResult = await callLLM(
        "markets.daily_brief",
        {
          portfolio_name: portfolio.name,
          holdings_json: holdingsJson,
          news_json: newsJson,
          watchlist_json: watchlistJson,
          tracked_symbols_csv: trackedSymbolsCsv,
        },
        {
          tenantId,
          franchiseId,
          userId: user.id,
          supabaseAdmin,
          logger,
        },
      );
    } catch (e: any) {
      const code = e?.code ?? "llm_error";
      const status = e instanceof LlmGatewayError ? e.status : 502;
      logger.error("LLM gateway call failed", { code, error: e?.message ?? String(e) });
      return new Response(
        JSON.stringify({
          error: e?.message ?? "LLM call failed",
          code,
          hint:
            code === "missing_api_key"
              ? "Set ANTHROPIC_API_KEY via `supabase secrets set` to enable brief generation."
              : undefined,
        }),
        { status, headers: jsonHeaders },
      );
    }

    // 9. Persist the brief via JWT-scoped client (RLS owner-insert)
    const sources = (news ?? []).map((n: any) => ({
      title: n.title,
      url: n.raw_url,
      ts: n.ts,
      source: n.source,
    }));

    const briefRow = {
      tenant_id: tenantId,
      franchise_id: franchiseId,
      owner_user_id: user.id,
      scope: "portfolio",
      scope_ref_id: portfolio.id,
      title: `Daily brief — ${portfolio.name}`,
      body: llmResult.text,
      sources,
      llm_provider: llmResult.provider,
      llm_model: llmResult.model,
      input_tokens: llmResult.inputTokens,
      output_tokens: llmResult.outputTokens,
      cost_usd: llmResult.costUsd,
      metadata: {
        prompt_version: llmResult.promptVersion,
        latency_ms: llmResult.latencyMs,
        holdings_count: (holdings ?? []).length,
        news_count: news.length,
        watchlist_count: (watchlists ?? []).length,
        tracked_symbol_count: trackedSymbols.length,
        focused_news_count: trackedSymbols.length > 0
          ? news.filter((n: any) =>
              Array.isArray(n.instruments) &&
              n.instruments.some((sym: string) => trackedSymbols.includes(sym)),
            ).length
          : 0,
      },
    };

    const { data: insertedBrief, error: briefErr } = await marketsDb
      .from("briefs")
      .insert(briefRow)
      .select(
        "id, ts, title, body, sources, llm_provider, llm_model, input_tokens, output_tokens, cost_usd, metadata",
      )
      .single();

    if (briefErr) {
      logger.error("brief insert failed", { error: briefErr.message });
      return new Response(
        JSON.stringify({
          error: briefErr.message,
          // Still hand back the brief text — the LLM was called and billed,
          // so the user shouldn't lose the result.
          unsaved_brief: {
            body: llmResult.text,
            provider: llmResult.provider,
            model: llmResult.model,
            cost_usd: llmResult.costUsd,
          },
        }),
        { status: 500, headers: jsonHeaders },
      );
    }

    return new Response(
      JSON.stringify({ data: insertedBrief }),
      { status: 201, headers: jsonHeaders },
    );
  } catch (e: any) {
    logger.error("markets-portfolio-brief unhandled", { error: e?.message ?? String(e) });
    return new Response(
      JSON.stringify({ error: e?.message ?? "Internal server error" }),
      { status: 500, headers: jsonHeaders },
    );
  }
}, "markets-portfolio-brief");
