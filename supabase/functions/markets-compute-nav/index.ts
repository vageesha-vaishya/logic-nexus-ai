// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// markets-compute-nav
//
// Computes portfolio NAV from live price_history data and persists results:
//   • portfolios.metadata  → nav_value, invested_value, unrealized_pnl,
//                            unrealized_pct, day_change, day_change_pct
//   • portfolio_snapshots  → daily snapshot row per portfolio
//
// POST {}                      → refresh all portfolios
// POST { portfolio_id: "..." } → refresh one portfolio (on-demand, user-triggered)
//
// Auth:
//   • Service role → cron / internal callers
//   • User JWT     → triggers refresh for their own portfolios only

import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight, apiHeaders } from "../_shared/cors.ts";
import { requireAuth, isServiceRoleAuthorizationHeader } from "../_shared/auth.ts";

declare const Deno: any;

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;

  const h = apiHeaders();

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const isService  = isServiceRoleAuthorizationHeader(authHeader, serviceKey);

    let userId: string | null = null;
    if (!isService) {
      const { user, error } = await requireAuth(req);
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: h });
      }
      userId = user.id;
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    let requestedPortfolioId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.portfolio_id === "string") requestedPortfolioId = body.portfolio_id;
      } catch { /* empty body */ }
    }

    // If user (not service role), restrict to their own portfolios
    const targetPortfolioId = requestedPortfolioId;

    logger.info("markets-compute-nav start", {
      is_service: isService,
      portfolio_id: targetPortfolioId ?? "all",
    });

    // ── 1. Compute NAV via Postgres function ────────────────────────────────
    const rpcResult = await (supabaseAdmin as any).rpc(
      "refresh_portfolio_nav",
      targetPortfolioId ? { p_portfolio_id: targetPortfolioId } : {},
      { get: false },
    );

    if (rpcResult.error) {
      logger.error("refresh_portfolio_nav rpc failed", { error: rpcResult.error.message });
      return new Response(
        JSON.stringify({ error: rpcResult.error.message }),
        { status: 500, headers: h },
      );
    }

    const rows: Array<{
      portfolio_id:   string;
      nav_value:      number;
      invested_value: number;
      unrealized_pnl: number;
      unrealized_pct: number;
      day_change:     number;
      day_change_pct: number;
      holdings_count: number;
    }> = rpcResult.data ?? [];

    if (rows.length === 0) {
      logger.info("no portfolios with holdings found");
      return new Response(JSON.stringify({ updated: 0 }), { headers: h });
    }

    // ── 2. Update portfolios.metadata ───────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const metaUpdates = rows.map(r => ({
      id: r.portfolio_id,
      metadata: {
        nav_value:      r.nav_value,
        invested_value: r.invested_value,
        unrealized_pnl: r.unrealized_pnl,
        unrealized_pct: r.unrealized_pct,
        day_change_value: r.day_change,
        day_change_pct: r.day_change_pct,
        holdings_count: r.holdings_count,
        last_computed_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }));

    // Upsert metadata one-by-one (no batch PATCH in PostgREST without conflicts)
    let metaUpdated = 0;
    for (const upd of metaUpdates) {
      const { error: metaErr } = await (supabaseAdmin as any)
        .schema("markets")
        .from("portfolios")
        .update({ metadata: upd.metadata, updated_at: upd.updated_at })
        .eq("id", upd.id);
      if (metaErr) {
        logger.warn("metadata update failed", { portfolio_id: upd.id, error: metaErr.message });
      } else {
        metaUpdated++;
      }
    }

    // ── 3. Upsert portfolio_snapshots ───────────────────────────────────────
    const snapshotRows = rows.map(r => ({
      portfolio_id:    r.portfolio_id,
      snapshot_date:   today,
      total_nav:       r.nav_value,
      invested_value:  r.invested_value,
      unrealized_pnl:  r.unrealized_pnl,
      day_change:      r.day_change,
      day_change_pct:  r.day_change_pct,
    }));

    const { error: snapErr } = await (supabaseAdmin as any)
      .schema("markets")
      .from("portfolio_snapshots")
      .upsert(snapshotRows, { onConflict: "portfolio_id,snapshot_date", ignoreDuplicates: false });

    if (snapErr) {
      logger.warn("snapshot upsert failed", { error: snapErr.message });
    }

    const result = {
      updated:   metaUpdated,
      snapshots: snapshotRows.length,
      portfolios: rows.map(r => ({
        portfolio_id:   r.portfolio_id,
        nav_value:      r.nav_value,
        unrealized_pnl: r.unrealized_pnl,
        day_change:     r.day_change,
        day_change_pct: r.day_change_pct,
      })),
    };

    logger.info("markets-compute-nav done", result);
    return new Response(JSON.stringify(result), { headers: h });

  } catch (e: any) {
    logger.error("markets-compute-nav unhandled", { error: e?.message });
    return new Response(JSON.stringify({ error: e?.message }), { status: 500, headers: h });
  }
}, "markets-compute-nav");
