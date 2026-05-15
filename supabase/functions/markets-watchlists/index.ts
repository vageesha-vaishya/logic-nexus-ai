// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// markets-watchlists — CRUD for watchlists + their items, plus instrument search.
//
// Endpoints (all JWT-scoped; markets.watchlists RLS enforces ownership):
//   GET    /markets-watchlists                              → list watchlists for the user
//   GET    /markets-watchlists?id=<uuid>                    → watchlist row + its items (with instrument detail)
//   POST   /markets-watchlists { name, is_default? }        → create watchlist
//   PATCH  /markets-watchlists?id=<uuid> { name?, is_default? } → update
//   DELETE /markets-watchlists?id=<uuid>                    → delete (cascades to items)
//   POST   /markets-watchlists?id=<uuid>&path=items
//          { instrument_id, note? }                         → add an item
//   DELETE /markets-watchlists?id=<uuid>&item_id=<uuid>     → remove an item
//   GET    /markets-watchlists?path=search-instruments&q=<query>&limit=<n>
//                                                          → autocomplete-friendly instrument search
//
// Auth: any authenticated user with markets domain access. Per-tenant scoping via
// x-tenant-id (+ x-franchise-id on writes that need to stamp those fields).

import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { checkDomainAccess, PlatformDomains } from "../_shared/domain-access.ts";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const { user, error: authError, supabaseClient } = await requireAuth(req, logger);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: authError ?? "Unauthorized" }), {
        status: 401, headers: jsonHeaders,
      });
    }

    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Missing x-tenant-id header" }), {
        status: 400, headers: jsonHeaders,
      });
    }

    const access = await checkDomainAccess(supabaseAdmin, tenantId, PlatformDomains.MARKETS);
    if (!access.allowed) {
      return new Response(
        JSON.stringify({ error: "Tenant does not have the markets domain enabled", reason: access.reason }),
        { status: 403, headers: jsonHeaders },
      );
    }

    const url = new URL(req.url);
    const watchlistId = url.searchParams.get("id");
    const path = url.searchParams.get("path");
    const itemId = url.searchParams.get("item_id");

    const marketsDb = supabaseClient.schema("markets" as any);

    // ─── Instrument detail (metadata + watchlists holding it + recent news) ───
    // GET ?path=instrument-detail&instrument_id=<uuid>
    if (req.method === "GET" && path === "instrument-detail") {
      const instrumentId = url.searchParams.get("instrument_id") ?? "";
      if (!instrumentId) {
        return new Response(JSON.stringify({ error: "instrument_id is required" }), { status: 400, headers: jsonHeaders });
      }

      // 1. Instrument record (service-role; reference data).
      const { data: instrument, error: instErr } = await (supabaseAdmin as any)
        .schema("markets")
        .from("instruments")
        .select("id, symbol, exchange, isin, instrument_type, lot_size, tick_size, expiry, strike, metadata, is_active, created_at")
        .eq("id", instrumentId)
        .maybeSingle();
      if (instErr) {
        return new Response(JSON.stringify({ error: instErr.message }), { status: 500, headers: jsonHeaders });
      }
      if (!instrument) {
        return new Response(JSON.stringify({ error: "Instrument not found" }), { status: 404, headers: jsonHeaders });
      }

      // 2. Which of the user's watchlists contain this instrument? RLS-scoped.
      const { data: items } = await marketsDb
        .from("watchlist_items" as any)
        .select("id, watchlist_id, note, added_at")
        .eq("instrument_id", instrumentId);
      const watchlistIds = (items ?? []).map((i: any) => i.watchlist_id);
      let watchlistMap: Record<string, { id: string; name: string; is_default: boolean }> = {};
      if (watchlistIds.length > 0) {
        const { data: wls } = await marketsDb
          .from("watchlists" as any)
          .select("id, name, is_default")
          .in("id", watchlistIds);
        watchlistMap = Object.fromEntries((wls ?? []).map((w: any) => [w.id, w]));
      }
      const onWatchlists = (items ?? []).map((i: any) => ({
        watchlist_id: i.watchlist_id,
        watchlist_name: watchlistMap[i.watchlist_id]?.name ?? "(unknown)",
        is_default: watchlistMap[i.watchlist_id]?.is_default ?? false,
        item_id: i.id,
        note: i.note,
        added_at: i.added_at,
      }));

      // 3. Recent news mentioning the symbol (last 30 days; service-role since
      //    news_events is shared reference data with RLS readable to authenticated).
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data: news } = await (supabaseAdmin as any)
        .schema("markets")
        .from("news_events")
        .select("id, ts, source, title, sentiment_score, raw_url, instruments")
        .gte("ts", thirtyDaysAgo)
        .contains("instruments", [instrument.symbol])
        .order("ts", { ascending: false })
        .limit(25);

      // 4. Sentiment summary over last 7 days.
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const last7d = (news ?? []).filter((n: any) => n.ts >= sevenDaysAgo);
      const scored7d = last7d.filter((n: any) => typeof n.sentiment_score === "number");
      const avg7d = scored7d.length > 0
        ? scored7d.reduce((s: number, n: any) => s + n.sentiment_score, 0) / scored7d.length
        : null;

      return new Response(JSON.stringify({
        data: {
          instrument,
          on_watchlists: onWatchlists,
          news: news ?? [],
          sentiment_summary: {
            count_7d: last7d.length,
            count_scored_7d: scored7d.length,
            avg_score_7d: avg7d,
            count_30d: (news ?? []).length,
          },
        },
      }), { headers: jsonHeaders });
    }

    // ─── Instrument search (autocomplete) ─────────────────────────────────
    // GET ?path=search-instruments&q=<query>&limit=<n>
    if (req.method === "GET" && path === "search-instruments") {
      const q = (url.searchParams.get("q") ?? "").trim();
      const limit = clampInt(url.searchParams.get("limit"), 10, 1, 50);
      if (q.length === 0) {
        return new Response(JSON.stringify({ data: [] }), { headers: jsonHeaders });
      }
      // Instruments are shared reference data — use service-role for predictable
      // search regardless of any RLS subtleties.
      const { data, error } = await (supabaseAdmin as any)
        .schema("markets")
        .from("instruments")
        .select("id, symbol, exchange, isin, instrument_type")
        .eq("is_active", true)
        .or(`symbol.ilike.%${q}%,isin.ilike.%${q}%`)
        .order("symbol", { ascending: true })
        .limit(limit);
      if (error) {
        logger.error("instrument search failed", { error: error.message });
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ data: data ?? [] }), { headers: jsonHeaders });
    }

    // ─── Single watchlist (detail + items) ────────────────────────────────
    // GET ?id=<uuid>
    if (req.method === "GET" && watchlistId) {
      const { data: wl, error: wlErr } = await marketsDb
        .from("watchlists" as any)
        .select("id, name, is_default, metadata, created_at, updated_at")
        .eq("id", watchlistId)
        .maybeSingle();
      if (wlErr) {
        return new Response(JSON.stringify({ error: wlErr.message }), { status: 500, headers: jsonHeaders });
      }
      if (!wl) {
        return new Response(JSON.stringify({ error: "Watchlist not found" }), { status: 404, headers: jsonHeaders });
      }

      // Items + joined instrument detail. We do the join via service-role on the
      // instruments side so we always get the symbol/exchange even if instruments
      // RLS narrows things; ownership of items is still enforced by RLS on the
      // watchlist_items select above.
      const { data: items, error: itemsErr } = await marketsDb
        .from("watchlist_items" as any)
        .select("id, instrument_id, note, added_at")
        .eq("watchlist_id", watchlistId)
        .order("added_at", { ascending: false });
      if (itemsErr) {
        return new Response(JSON.stringify({ error: itemsErr.message }), { status: 500, headers: jsonHeaders });
      }

      let instrumentMap: Record<string, any> = {};
      const ids = (items ?? []).map((i: any) => i.instrument_id).filter(Boolean);
      if (ids.length > 0) {
        const { data: insts, error: instErr } = await (supabaseAdmin as any)
          .schema("markets")
          .from("instruments")
          .select("id, symbol, exchange, isin, instrument_type")
          .in("id", ids);
        if (instErr) {
          logger.warn("instrument lookup failed", { error: instErr.message });
        }
        instrumentMap = Object.fromEntries((insts ?? []).map((i: any) => [i.id, i]));
      }

      const enriched = (items ?? []).map((i: any) => ({
        ...i,
        instrument: instrumentMap[i.instrument_id] ?? null,
      }));

      return new Response(
        JSON.stringify({ data: { ...wl, items: enriched } }),
        { headers: jsonHeaders },
      );
    }

    // ─── List watchlists ──────────────────────────────────────────────────
    if (req.method === "GET") {
      const { data, error } = await marketsDb
        .from("watchlists" as any)
        .select("id, name, is_default, metadata, created_at, updated_at")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) {
        logger.error("list watchlists failed", { error: error.message });
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: jsonHeaders });
      }
      // Also fetch item counts in one shot — cheap aggregate via service-role.
      const ids = (data ?? []).map((w: any) => w.id);
      let counts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: countRows } = await (supabaseAdmin as any)
          .schema("markets")
          .from("watchlist_items")
          .select("watchlist_id")
          .in("watchlist_id", ids)
          .eq("owner_user_id", user.id);
        for (const r of countRows ?? []) {
          counts[(r as any).watchlist_id] = (counts[(r as any).watchlist_id] ?? 0) + 1;
        }
      }
      const enriched = (data ?? []).map((w: any) => ({ ...w, item_count: counts[w.id] ?? 0 }));
      return new Response(JSON.stringify({ data: enriched, count: enriched.length }), { headers: jsonHeaders });
    }

    // ─── Add item to a watchlist ─────────────────────────────────────────
    // POST ?id=<watchlist>&path=items  { instrument_id, note? }
    if (req.method === "POST" && watchlistId && path === "items") {
      const franchiseId = req.headers.get("x-franchise-id");
      if (!franchiseId) {
        return new Response(JSON.stringify({ error: "Missing x-franchise-id header" }), {
          status: 400, headers: jsonHeaders,
        });
      }
      let body: any;
      try { body = await req.json(); } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: jsonHeaders });
      }
      const instrumentId = typeof body?.instrument_id === "string" ? body.instrument_id : "";
      if (!instrumentId) {
        return new Response(JSON.stringify({ error: "instrument_id is required" }), { status: 400, headers: jsonHeaders });
      }
      const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null;

      const insertRow = {
        watchlist_id: watchlistId,
        instrument_id: instrumentId,
        tenant_id: tenantId,
        franchise_id: franchiseId,
        owner_user_id: user.id,
        note,
      };
      const { data, error } = await marketsDb
        .from("watchlist_items" as any)
        .insert(insertRow as any)
        .select("id, instrument_id, note, added_at")
        .single();
      if (error) {
        logger.error("add watchlist item failed", { error: error.message, code: (error as any).code });
        // Likely 23505 unique-violation if the same instrument is added twice (if there's a unique constraint),
        // 42501 RLS denial, otherwise generic 400.
        const code = (error as any).code;
        const status = code === "42501" ? 403 : code === "23505" ? 409 : 400;
        return new Response(JSON.stringify({ error: error.message, code }), { status, headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ data }), { status: 201, headers: jsonHeaders });
    }

    // ─── Remove item ─────────────────────────────────────────────────────
    // DELETE ?id=<watchlist>&item_id=<uuid>
    if (req.method === "DELETE" && watchlistId && itemId) {
      const { error } = await marketsDb
        .from("watchlist_items" as any)
        .delete()
        .eq("id", itemId)
        .eq("watchlist_id", watchlistId);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ data: { id: itemId, deleted: true } }), { headers: jsonHeaders });
    }

    // ─── Create watchlist ────────────────────────────────────────────────
    if (req.method === "POST") {
      const franchiseId = req.headers.get("x-franchise-id");
      if (!franchiseId) {
        return new Response(JSON.stringify({ error: "Missing x-franchise-id header" }), {
          status: 400, headers: jsonHeaders,
        });
      }
      let body: any;
      try { body = await req.json(); } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: jsonHeaders });
      }
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (!name) {
        return new Response(JSON.stringify({ error: "name is required" }), { status: 400, headers: jsonHeaders });
      }
      const isDefault = body?.is_default === true;

      const insertRow = {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        owner_user_id: user.id,
        name: name.slice(0, 120),
        is_default: isDefault,
      };
      const { data, error } = await marketsDb
        .from("watchlists" as any)
        .insert(insertRow as any)
        .select("id, name, is_default, metadata, created_at, updated_at")
        .single();
      if (error) {
        logger.error("create watchlist failed", { error: error.message });
        const code = (error as any).code;
        const status = code === "42501" ? 403 : 400;
        return new Response(JSON.stringify({ error: error.message, code }), { status, headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ data: { ...data, item_count: 0 } }), { status: 201, headers: jsonHeaders });
    }

    // ─── Update watchlist ────────────────────────────────────────────────
    if (req.method === "PATCH" && watchlistId) {
      let body: any;
      try { body = await req.json(); } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: jsonHeaders });
      }
      const updates: any = {};
      if (typeof body?.name === "string" && body.name.trim()) updates.name = body.name.trim().slice(0, 120);
      if (typeof body?.is_default === "boolean") updates.is_default = body.is_default;
      if (Object.keys(updates).length === 0) {
        return new Response(JSON.stringify({ error: "Nothing to update" }), { status: 400, headers: jsonHeaders });
      }
      const { data, error } = await marketsDb
        .from("watchlists" as any)
        .update(updates as any)
        .eq("id", watchlistId)
        .select("id, name, is_default, metadata, created_at, updated_at")
        .single();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ data }), { headers: jsonHeaders });
    }

    // ─── Delete watchlist ────────────────────────────────────────────────
    if (req.method === "DELETE" && watchlistId) {
      const { error } = await marketsDb
        .from("watchlists" as any)
        .delete()
        .eq("id", watchlistId);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ data: { id: watchlistId, deleted: true } }), { headers: jsonHeaders });
    }

    return new Response(
      JSON.stringify({ error: `Unsupported request: ${req.method} ${url.pathname}${url.search}` }),
      { status: 405, headers: { ...jsonHeaders, Allow: "GET, POST, PATCH, DELETE, OPTIONS" } },
    );
  } catch (e: any) {
    logger.error("markets-watchlists unhandled", { error: e?.message ?? String(e) });
    return new Response(
      JSON.stringify({ error: e?.message ?? "Internal server error" }),
      { status: 500, headers: jsonHeaders },
    );
  }
}, "markets-watchlists");

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw == null ? NaN : parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
