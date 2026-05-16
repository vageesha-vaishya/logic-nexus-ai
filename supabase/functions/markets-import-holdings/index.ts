// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// markets-import-holdings
//
// Bulk-imports existing holdings into a portfolio by creating "buy" or
// "transfer_in" transactions for each row.
//
// POST body:
//   {
//     portfolio_id: string,
//     rows: ImportRow[],
//     txn_type?: "buy" | "transfer_in"   (default: "transfer_in")
//   }
//
// ImportRow:
//   {
//     symbol:        string          // NSE symbol, AMFI code, MCX symbol …
//     exchange?:     string          // "NSE" | "BSE" | "AMFI" | "MCX" | …
//     isin?:         string          // used for better instrument matching
//     qty:           number
//     avg_cost:      number          // price per unit / NAV
//     purchase_date?: string         // YYYY-MM-DD, defaults to today
//     asset_class?:  string
//     notes?:        string
//     folio_number?: string          // MF folio
//   }
//
// Returns:
//   { imported: N, skipped: N, errors: [{row, symbol, reason}] }

import { serveWithLogger }          from "../_shared/logger.ts";
import { corsHeaders, preflight }   from "../_shared/cors.ts";
import { requireAuth }              from "../_shared/auth.ts";
import { checkDomainAccess, PlatformDomains } from "../_shared/domain-access.ts";
import { logAccess, logAudit, extractIp, extractRequestId } from "../_shared/audit.ts";
import { checkRateLimit, rlKey, rateLimitResponse, POLICIES } from "../_shared/rate-limit.ts";

declare const Deno: any;

const jsonH = { ...corsHeaders, "Content-Type": "application/json" };

const VALID_ASSET_CLASSES = new Set([
  "equity","mutual_fund","commodity","forex","fixed_income",
  "derivative","reit","cash","other","etf",
]);

const EXCHANGE_PRIORITY = ["NSE","BSE","AMFI","MCX","NSE_FO"];

// Default exchange per asset class when caller doesn't supply one
const DEFAULT_EXCHANGE: Record<string, string> = {
  equity:       "NSE",
  etf:          "NSE",
  mutual_fund:  "AMFI",
  commodity:    "MCX",
  reit:         "NSE",
  fixed_income: "NSE",
  derivative:   "NSE_FO",
};

function today(): string {
  return new Date().toISOString().split("T")[0];
}

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;

  const requestId = extractRequestId(req);
  const ip        = extractIp(req);
  const userAgent = req.headers.get("user-agent") ?? null;
  const op        = "POST /markets-import-holdings";
  const t0        = Date.now();

  try {
    const { user, error: authError, supabaseClient } = await requireAuth(req, logger);
    if (authError || !user) {
      logAccess(supabaseAdmin, {
        requestId, domain: "markets", op, decision: "deny",
        reason: "unauthorized", ms: Date.now() - t0,
      });
      return new Response(JSON.stringify({ error: authError ?? "Unauthorized" }), { status: 401, headers: jsonH });
    }

    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) {
      logAccess(supabaseAdmin, {
        requestId, domain: "markets", op, userId: user.id,
        decision: "deny", reason: "missing_tenant_id", ms: Date.now() - t0,
      });
      return new Response(JSON.stringify({ error: "Missing x-tenant-id header" }), { status: 400, headers: jsonH });
    }

    const access = await checkDomainAccess(supabaseAdmin, tenantId, PlatformDomains.MARKETS);
    if (!access.allowed) {
      logAccess(supabaseAdmin, {
        requestId, domain: "markets", op, userId: user.id, tenantId,
        decision: "deny", reason: access.reason ?? "domain_not_enabled", ms: Date.now() - t0,
      });
      return new Response(JSON.stringify({ error: "Markets domain not enabled", reason: access.reason }), { status: 403, headers: jsonH });
    }

    logAccess(supabaseAdmin, {
      requestId, domain: "markets", op, userId: user.id, tenantId,
      decision: "allow", ms: Date.now() - t0,
    });

    // 5 imports/min per tenant+user (bulk operation — expensive)
    const rl = await checkRateLimit(rlKey("holdings.import", tenantId, user.id), POLICIES.import_holdings);
    if (!rl.allowed) return new Response(
      JSON.stringify({ error: "Too many requests", retry_after_ms: rl.retryAfter }),
      { status: 429, headers: { ...jsonH, "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } },
    );

    let body: any;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: jsonH });
    }

    const portfolioId = typeof body?.portfolio_id === "string" ? body.portfolio_id : null;
    const rawRows:     any[] = Array.isArray(body?.rows) ? body.rows : [];
    const txnType     = body?.txn_type === "buy" ? "buy" : "transfer_in";

    if (!portfolioId)
      return new Response(JSON.stringify({ error: "portfolio_id is required" }), { status: 400, headers: jsonH });
    if (rawRows.length === 0)
      return new Response(JSON.stringify({ error: "rows array is empty" }), { status: 400, headers: jsonH });
    if (rawRows.length > 500)
      return new Response(JSON.stringify({ error: "Maximum 500 rows per import" }), { status: 400, headers: jsonH });

    const marketsAdmin = (supabaseAdmin as any).schema("markets");
    const marketsUser  = (supabaseClient as any).schema("markets");

    // ── Resolve instruments ──────────────────────────────────────────────
    // Build a lookup from all distinct (symbol, exchange) pairs in the batch
    const lookupKeys = new Map<string, { symbol: string; exchange: string; isin?: string; asset_class?: string }>();
    for (const r of rawRows) {
      const sym  = typeof r.symbol   === "string" ? r.symbol.trim().toUpperCase()   : "";
      const exch = typeof r.exchange === "string" ? r.exchange.trim().toUpperCase() : "";
      if (!sym) continue;
      const key = `${sym}::${exch || "AUTO"}`;
      if (!lookupKeys.has(key)) {
        lookupKeys.set(key, {
          symbol: sym, exchange: exch,
          isin:        typeof r.isin         === "string" ? r.isin.trim()         : undefined,
          asset_class: typeof r.asset_class  === "string" ? r.asset_class.trim()  : undefined,
        });
      }
    }

    // Fetch existing instruments by symbol (may match multiple exchanges)
    const symbols = [...new Set([...lookupKeys.values()].map(v => v.symbol))];
    const { data: existingInstrs } = await marketsAdmin
      .from("instruments")
      .select("id, symbol, exchange, instrument_type, asset_class, isin")
      .in("symbol", symbols);

    // Index by "symbol::exchange" and "symbol::*" (any exchange)
    const instrById   = new Map<string, string>(); // "SYM::EXCH" → instrument_id
    const instrByISIN = new Map<string, string>(); // isin → instrument_id
    for (const i of (existingInstrs ?? []) as any[]) {
      instrById.set(`${i.symbol}::${i.exchange}`, i.id);
      if (i.isin) instrByISIN.set(i.isin, i.id);
    }

    // For keys not yet resolved, try auto-creation
    const instrIdMap = new Map<string, string>(); // key → instrument_id

    for (const [key, meta] of lookupKeys) {
      const { symbol, exchange, isin, asset_class } = meta;

      // 1. Exact ISIN match
      if (isin && instrByISIN.has(isin)) {
        instrIdMap.set(key, instrByISIN.get(isin)!);
        continue;
      }

      // 2. Exact symbol+exchange match
      if (exchange && instrById.has(`${symbol}::${exchange}`)) {
        instrIdMap.set(key, instrById.get(`${symbol}::${exchange}`)!);
        continue;
      }

      // 3. Symbol match on priority exchange list
      if (!exchange) {
        for (const exch of EXCHANGE_PRIORITY) {
          if (instrById.has(`${symbol}::${exch}`)) {
            instrIdMap.set(key, instrById.get(`${symbol}::${exch}`)!);
            break;
          }
        }
        if (instrIdMap.has(key)) continue;
      }

      // 4. Auto-create instrument (unknown broker symbol)
      const inferredExch   = exchange || DEFAULT_EXCHANGE[asset_class ?? ""] || "NSE";
      const inferredType   = asset_class === "mutual_fund" ? "mf_equity"
                           : asset_class === "commodity"   ? "commodity_spot"
                           : asset_class === "etf"         ? "etf"
                           : "equity";
      const inferredClass  = asset_class && VALID_ASSET_CLASSES.has(asset_class) ? asset_class : "equity";

      const { data: created, error: createErr } = await marketsAdmin
        .from("instruments")
        .insert({
          symbol: symbol, exchange: inferredExch,
          instrument_type: inferredType, asset_class: inferredClass,
          isin: isin ?? null, is_active: true,
          currency_code: "INR", country_code: "IN",
          metadata: { auto_created: true, created_by: "import" },
        })
        .select("id")
        .single();

      if (createErr) {
        // Might be a race/duplicate — try fetching again
        const { data: retry } = await marketsAdmin.from("instruments")
          .select("id").eq("symbol", symbol).eq("exchange", inferredExch).maybeSingle();
        if (retry) instrIdMap.set(key, (retry as any).id);
        // else: will be reported as error per-row
      } else if (created) {
        instrIdMap.set(key, (created as any).id);
      }
    }

    // ── Process rows ─────────────────────────────────────────────────────
    const imported: any[] = [];
    const errors:   any[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i];
      const sym  = typeof r.symbol   === "string" ? r.symbol.trim().toUpperCase()   : "";
      const exch = typeof r.exchange === "string" ? r.exchange.trim().toUpperCase() : "";
      if (!sym) { errors.push({ row: i + 1, symbol: sym, reason: "Symbol is required" }); continue; }

      const qty      = typeof r.qty      === "number" ? r.qty      : parseFloat(r.qty ?? "0");
      const avgCost  = typeof r.avg_cost === "number" ? r.avg_cost : parseFloat(r.avg_cost ?? "0");

      if (isNaN(qty) || qty <= 0)     { errors.push({ row: i + 1, symbol: sym, reason: "qty must be a positive number" }); continue; }
      if (isNaN(avgCost) || avgCost < 0) { errors.push({ row: i + 1, symbol: sym, reason: "avg_cost must be >= 0" }); continue; }

      const key          = `${sym}::${exch || "AUTO"}`;
      const instrumentId = instrIdMap.get(key) ?? null;
      if (!instrumentId) {
        errors.push({ row: i + 1, symbol: sym, reason: `Could not resolve instrument${exch ? ` on ${exch}` : ""}` });
        continue;
      }

      const assetClass = typeof r.asset_class === "string" && VALID_ASSET_CLASSES.has(r.asset_class) ? r.asset_class : "equity";
      const txnDate    = typeof r.purchase_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.purchase_date)
                         ? r.purchase_date : today();

      imported.push({
        portfolio_id:  portfolioId,
        instrument_id: instrumentId,
        txn_type:      txnType,
        txn_date:      txnDate,
        qty, price: avgCost,
        charges: 0,
        net_amount: qty * avgCost,
        currency:  typeof r.currency === "string" ? r.currency.toUpperCase() : "INR",
        fx_rate:   1,
        asset_class:    assetClass,
        notes:          typeof r.notes          === "string" ? r.notes.trim()          : null,
        folio_number:   typeof r.folio_number   === "string" ? r.folio_number.trim()   : null,
        source:         "import",
        owner_user_id:  user.id,
        tenant_id:      tenantId,
      });
    }

    if (imported.length === 0) {
      return new Response(JSON.stringify({ imported: 0, skipped: errors.length, errors }), { headers: jsonH });
    }

    // ── Bulk insert transactions (use admin client to bypass per-row RLS overhead) ─
    const CHUNK = 100;
    let insertedCount = 0;

    for (let i = 0; i < imported.length; i += CHUNK) {
      const chunk = imported.slice(i, i + CHUNK);
      const { error: txnErr } = await marketsAdmin
        .from("transactions")
        .insert(chunk);

      if (txnErr) {
        logger.error("bulk transaction insert failed", { error: txnErr.message, chunk_start: i });
        return new Response(
          JSON.stringify({ error: `Batch insert failed at row ${i + 1}: ${txnErr.message}`, imported: insertedCount, errors }),
          { status: 500, headers: jsonH },
        );
      }
      insertedCount += chunk.length;
    }

    // ── Rebuild holdings from tax lots (use admin for all affected instruments) ───
    const affectedInstrumentIds = [...new Set(imported.map((r) => r.instrument_id))];
    for (const instrId of affectedInstrumentIds) {
      // Aggregate buy qty / avg cost from all open lots for this instrument
      const { data: txns } = await marketsAdmin
        .from("transactions")
        .select("qty, price, txn_type")
        .eq("portfolio_id", portfolioId)
        .eq("instrument_id", instrId)
        .in("txn_type", ["buy","sip","transfer_in"]);

      const totalQty  = (txns as any[] ?? []).reduce((s: number, t: any) => s + Number(t.qty), 0);
      const totalCost = (txns as any[] ?? []).reduce((s: number, t: any) => s + Number(t.qty) * Number(t.price), 0);
      const avgCost   = totalQty > 0 ? totalCost / totalQty : 0;

      if (totalQty > 0) {
        await marketsAdmin.from("holdings").upsert({
          portfolio_id: portfolioId, instrument_id: instrId,
          qty: totalQty, avg_cost: avgCost, last_updated_at: new Date().toISOString(),
        }, { onConflict: "portfolio_id,instrument_id" });
      }

      // Also seed tax lots for each transaction we just inserted
      const newRows = imported.filter(r => r.instrument_id === instrId);
      // Fetch the IDs of the rows we just inserted
      const { data: insertedTxns } = await marketsAdmin
        .from("transactions")
        .select("id, qty, price, txn_date, asset_class")
        .eq("portfolio_id", portfolioId)
        .eq("instrument_id", instrId)
        .eq("source", "import")
        .order("created_at", { ascending: false })
        .limit(newRows.length);

      const lotRows = (insertedTxns as any[] ?? []).map((t: any) => ({
        portfolio_id: portfolioId, instrument_id: instrId,
        buy_txn_id:   t.id, buy_date: t.txn_date,
        buy_qty: t.qty, buy_price: t.price, remaining_qty: t.qty,
        is_closed: false, asset_class: t.asset_class,
        owner_user_id: user.id,
      }));

      if (lotRows.length > 0) {
        await marketsAdmin.from("tax_lots").upsert(lotRows, { onConflict: "buy_txn_id", ignoreDuplicates: true }).catch(() => null);
      }
    }

    logger.info("holdings import complete", {
      portfolio_id: portfolioId, imported: insertedCount, skipped: errors.length,
    });

    logAudit(supabaseAdmin, {
      requestId, domain: "markets", op, opMs: Date.now() - t0,
      tenantId, userId: user.id, ip, userAgent,
      resourceType: "portfolio", resourceId: portfolioId,
      action: "import",
      after: { imported: insertedCount, skipped: errors.length, instrument_count: affectedInstrumentIds.length },
    });

    return new Response(
      JSON.stringify({ success: true, imported: insertedCount, skipped: errors.length, errors }),
      { status: 201, headers: jsonH },
    );

  } catch (e: any) {
    logger.error("markets-import-holdings error", { error: e?.message });
    return new Response(JSON.stringify({ error: e?.message ?? "Internal server error" }), { status: 500, headers: jsonH });
  }
}, "markets-import-holdings");
