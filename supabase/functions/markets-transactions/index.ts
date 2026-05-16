// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// markets-transactions — CRUD on markets.transactions
//
// GET    /markets-transactions?portfolio_id=UUID[&limit=50&offset=0]
// POST   /markets-transactions  { portfolio_id, instrument_id?, txn_type, txn_date,
//                                  qty, price, charges?, notes?, currency?,
//                                  asset_class?, folio_number?, reference_id? }
// PATCH  /markets-transactions  { id, ...updatable fields }
// DELETE /markets-transactions  { id }
//
// On every write the edge function also:
//   • Updates markets.holdings (avg_cost recalculation, qty delta)
//   • Creates / closes markets.tax_lots (FIFO)
//
// Auth: user JWT + x-tenant-id header (domain check: MARKETS)

import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { checkDomainAccess, PlatformDomains } from "../_shared/domain-access.ts";
import { checkRateLimit, rlKey, rateLimitResponse, POLICIES } from "../_shared/rate-limit.ts";

const jsonH = { ...corsHeaders, "Content-Type": "application/json" };

const SELECT_FIELDS = `
  id, portfolio_id, instrument_id, txn_type, txn_date, settlement_date,
  qty, price, charges, net_amount, currency, fx_rate,
  asset_class, notes, source, reference_id, folio_number,
  owner_user_id, tenant_id, metadata, created_at, updated_at,
  instrument:instrument_id (symbol, exchange, instrument_type, asset_class, currency_code)
`.trim();

const VALID_TXN_TYPES = [
  "buy","sell","sip","redemption","dividend","interest",
  "bonus","split","transfer_in","transfer_out",
  "fd_deposit","fd_maturity","fee","adjustment",
] as const;

// ── Holdings recalculation ───────────────────────────────────────────────
async function recalcHolding(
  marketsDb: any,
  portfolioId: string,
  instrumentId: string,
  userId: string,
  logger: any,
) {
  // ── Open lots → current qty + avg_cost ──────────────────────────────────
  const { data: openLots } = await marketsDb
    .from("tax_lots")
    .select("remaining_qty, buy_price")
    .eq("portfolio_id", portfolioId)
    .eq("instrument_id", instrumentId)
    .eq("is_closed", false);

  const totalQty  = (openLots as any[] ?? []).reduce((s: number, l: any) => s + Number(l.remaining_qty), 0);
  const totalCost = (openLots as any[] ?? []).reduce((s: number, l: any) =>
    s + Number(l.remaining_qty) * Number(l.buy_price), 0);
  const avgCost   = totalQty > 0 ? totalCost / totalQty : 0;

  // ── Realized P&L: sell proceeds minus FIFO cost of sold shares ──────────
  // Cost of sold shares is derived from all lots (buy_qty - remaining_qty) × buy_price,
  // which exactly matches the FIFO quantities consumed by each sell transaction.
  const [allLotsRes, sellTxnsRes] = await Promise.all([
    marketsDb
      .from("tax_lots")
      .select("buy_qty, remaining_qty, buy_price")
      .eq("portfolio_id", portfolioId)
      .eq("instrument_id", instrumentId),
    marketsDb
      .from("transactions")
      .select("qty, price, charges")
      .eq("portfolio_id", portfolioId)
      .eq("instrument_id", instrumentId)
      .in("txn_type", ["sell", "redemption", "transfer_out"]),
  ]);

  const costOfSoldShares = ((allLotsRes.data ?? []) as any[]).reduce((s: number, l: any) =>
    s + (Number(l.buy_qty) - Number(l.remaining_qty)) * Number(l.buy_price), 0);
  const sellProceeds = ((sellTxnsRes.data ?? []) as any[]).reduce((s: number, t: any) =>
    s + Number(t.qty) * Number(t.price) - Number(t.charges ?? 0), 0);
  const realizedPnl = sellProceeds - costOfSoldShares;

  if (totalQty <= 0) {
    // Fully sold — remove holding row
    await marketsDb.from("holdings")
      .delete()
      .eq("portfolio_id", portfolioId)
      .eq("instrument_id", instrumentId);
    return;
  }

  await marketsDb.from("holdings").upsert({
    portfolio_id:   portfolioId,
    instrument_id:  instrumentId,
    qty:            totalQty,
    avg_cost:       avgCost,
    realized_pnl:   realizedPnl,
    last_updated_at: new Date().toISOString(),
  }, { onConflict: "portfolio_id,instrument_id" });
}

// ── Apply a BUY / SIP transaction to tax lots ────────────────────────────
async function applyBuy(marketsDb: any, txn: any, userId: string) {
  await marketsDb.from("tax_lots").insert({
    portfolio_id:  txn.portfolio_id,
    instrument_id: txn.instrument_id,
    buy_txn_id:    txn.id,
    buy_date:      txn.txn_date,
    buy_qty:       txn.qty,
    buy_price:     txn.price,
    remaining_qty: txn.qty,
    asset_class:   txn.asset_class,
    owner_user_id: userId,
  });
}

// ── Apply a SELL / REDEMPTION — FIFO lot matching ────────────────────────
async function applySell(marketsDb: any, txn: any, logger: any) {
  const { data: lots } = await marketsDb
    .from("tax_lots")
    .select("id, remaining_qty, buy_price")
    .eq("portfolio_id", txn.portfolio_id)
    .eq("instrument_id", txn.instrument_id)
    .eq("is_closed", false)
    .order("buy_date", { ascending: true });   // FIFO

  let qtyToSell = Number(txn.qty);
  for (const lot of (lots as any[] ?? [])) {
    if (qtyToSell <= 0) break;
    const consume = Math.min(Number(lot.remaining_qty), qtyToSell);
    const newQty  = Number(lot.remaining_qty) - consume;
    await marketsDb.from("tax_lots")
      .update({ remaining_qty: newQty, is_closed: newQty <= 0 })
      .eq("id", lot.id);
    qtyToSell -= consume;
  }
  if (qtyToSell > 0) {
    logger.warn("Sell qty exceeded open lots — possible data inconsistency", {
      portfolio_id: txn.portfolio_id, instrument_id: txn.instrument_id, excess: qtyToSell,
    });
  }
}

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const { user, error: authError, supabaseClient } = await requireAuth(req, logger);
    if (authError || !user)
      return new Response(JSON.stringify({ error: authError ?? "Unauthorized" }), { status: 401, headers: jsonH });

    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId)
      return new Response(JSON.stringify({ error: "Missing x-tenant-id header" }), { status: 400, headers: jsonH });

    const access = await checkDomainAccess(supabaseAdmin, tenantId, PlatformDomains.MARKETS);
    if (!access.allowed)
      return new Response(JSON.stringify({ error: "Markets domain not enabled", reason: access.reason }), { status: 403, headers: jsonH });

    // Rate limit: reads 120/min, mutations 30/min per tenant+user
    const isWrite = req.method !== "GET" && req.method !== "HEAD";
    const rl = await checkRateLimit(
      rlKey("transactions", tenantId, user.id),
      isWrite ? POLICIES.api_mutation : POLICIES.api_read,
    );
    if (!rl.allowed) return rateLimitResponse(rl, jsonH);

    const marketsDb = supabaseClient.schema("markets" as any);

    // ── GET ──────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const url = new URL(req.url);
      const portfolioId = url.searchParams.get("portfolio_id");
      const limit       = Math.min(Number(url.searchParams.get("limit")  ?? 100), 500);
      const offset      = Number(url.searchParams.get("offset") ?? 0);
      const assetClass  = url.searchParams.get("asset_class");

      if (!portfolioId)
        return new Response(JSON.stringify({ error: "portfolio_id query param required" }), { status: 400, headers: jsonH });

      let q = marketsDb.from("transactions" as any)
        .select(SELECT_FIELDS)
        .eq("portfolio_id", portfolioId)
        .order("txn_date", { ascending: false })
        .range(offset, offset + limit - 1);

      if (assetClass) q = q.eq("asset_class", assetClass);

      const { data, error, count } = await q;
      if (error) {
        logger.error("list transactions failed", { error: error.message });
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: jsonH });
      }
      return new Response(JSON.stringify({ data, count: count ?? data?.length ?? 0 }), { headers: jsonH });
    }

    // ── POST ─────────────────────────────────────────────────────────────
    if (req.method === "POST") {
      let body: any;
      try { body = await req.json(); } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: jsonH });
      }

      const portfolioId  = typeof body?.portfolio_id === "string" ? body.portfolio_id : null;
      const txnType: string = typeof body?.txn_type === "string" ? body.txn_type : "";
      const txnDate      = typeof body?.txn_date === "string"    ? body.txn_date : null;
      const qty          = typeof body?.qty   === "number" ? body.qty   : parseFloat(body?.qty ?? "0");
      const price        = typeof body?.price === "number" ? body.price : parseFloat(body?.price ?? "0");

      if (!portfolioId) return new Response(JSON.stringify({ error: "portfolio_id required" }), { status: 400, headers: jsonH });
      if (!VALID_TXN_TYPES.includes(txnType as any))
        return new Response(JSON.stringify({ error: `Invalid txn_type: ${txnType}` }), { status: 400, headers: jsonH });
      if (!txnDate)
        return new Response(JSON.stringify({ error: "txn_date required (YYYY-MM-DD)" }), { status: 400, headers: jsonH });
      if (isNaN(qty) || qty <= 0)
        return new Response(JSON.stringify({ error: "qty must be a positive number" }), { status: 400, headers: jsonH });
      if (isNaN(price) || price < 0)
        return new Response(JSON.stringify({ error: "price must be >= 0" }), { status: 400, headers: jsonH });

      const charges    = typeof body?.charges  === "number" ? body.charges : 0;
      const netAmount  = txnType === "buy" || txnType === "sip" || txnType === "fd_deposit" || txnType === "transfer_in"
        ? (qty * price + charges)
        : -(qty * price - charges);

      const insertRow = {
        portfolio_id:    portfolioId,
        instrument_id:   typeof body?.instrument_id === "string" ? body.instrument_id : null,
        txn_type:        txnType,
        txn_date:        txnDate,
        settlement_date: body?.settlement_date ?? null,
        qty,
        price,
        charges,
        net_amount:      netAmount,
        currency:        typeof body?.currency === "string" ? body.currency.toUpperCase() : "INR",
        fx_rate:         typeof body?.fx_rate  === "number" ? body.fx_rate : 1,
        asset_class:     typeof body?.asset_class   === "string" ? body.asset_class : null,
        notes:           typeof body?.notes         === "string" ? body.notes       : null,
        source:          typeof body?.source        === "string" ? body.source      : "manual",
        reference_id:    typeof body?.reference_id  === "string" ? body.reference_id : null,
        folio_number:    typeof body?.folio_number  === "string" ? body.folio_number : null,
        owner_user_id:   user.id,
        tenant_id:       tenantId,
        metadata:        body?.metadata ?? null,
      };

      const { data: txnData, error: txnErr } = await marketsDb
        .from("transactions" as any)
        .insert(insertRow as any)
        .select(SELECT_FIELDS)
        .single();

      if (txnErr) {
        logger.error("create transaction failed", { error: txnErr.message });
        return new Response(JSON.stringify({ error: txnErr.message }), { status: 400, headers: jsonH });
      }

      // Update tax lots + holdings (only for quantity-affecting types)
      if (insertRow.instrument_id) {
        const adminMarketsDb = (supabaseAdmin as any).schema("markets");
        if (txnType === "buy" || txnType === "sip" || txnType === "transfer_in") {
          await applyBuy(adminMarketsDb, txnData, user.id);
        } else if (txnType === "sell" || txnType === "redemption" || txnType === "transfer_out") {
          await applySell(adminMarketsDb, txnData, logger);
        }
        // Bonus / split: adjust existing lot prices/quantities (simplified: treat as buy at 0)
        if (txnType === "bonus" || txnType === "split") {
          await applyBuy(adminMarketsDb, { ...txnData, price: 0 }, user.id);
        }
        await recalcHolding(adminMarketsDb, portfolioId, insertRow.instrument_id, user.id, logger);
      }

      return new Response(JSON.stringify({ data: txnData }), { status: 201, headers: jsonH });
    }

    // ── PATCH ─────────────────────────────────────────────────────────────
    if (req.method === "PATCH") {
      let body: any;
      try { body = await req.json(); } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: jsonH });
      }
      const id = typeof body?.id === "string" ? body.id : null;
      if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: jsonH });

      const updates: Record<string, any> = {};
      const editable = ["txn_date","settlement_date","qty","price","charges","currency","fx_rate","notes","reference_id","folio_number","metadata","asset_class","source"];
      for (const f of editable) {
        if (f in body && body[f] !== undefined) updates[f] = body[f];
      }
      updates.updated_at = new Date().toISOString();

      const { data, error } = await marketsDb
        .from("transactions" as any)
        .update(updates as any)
        .eq("id", id)
        .select(SELECT_FIELDS)
        .single();

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: jsonH });
      return new Response(JSON.stringify({ data }), { headers: jsonH });
    }

    // ── DELETE ────────────────────────────────────────────────────────────
    if (req.method === "DELETE") {
      let body: any;
      try { body = await req.json(); } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: jsonH });
      }
      const id = typeof body?.id === "string" ? body.id : null;
      if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: jsonH });

      // Fetch txn before deleting to know portfolio/instrument for holdings recalc
      const { data: txn } = await marketsDb
        .from("transactions" as any).select("*").eq("id", id).single();

      const { error } = await marketsDb.from("transactions" as any).delete().eq("id", id);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: jsonH });

      // Recalc holdings if quantity-affecting
      if (txn?.instrument_id) {
        const adminMarketsDb = (supabaseAdmin as any).schema("markets");
        await recalcHolding(adminMarketsDb, txn.portfolio_id, txn.instrument_id, user.id, logger);
      }

      return new Response(JSON.stringify({ success: true }), { headers: jsonH });
    }

    return new Response(
      JSON.stringify({ error: `Method ${req.method} not allowed` }),
      { status: 405, headers: { ...jsonH, Allow: "GET, POST, PATCH, DELETE, OPTIONS" } },
    );

  } catch (e: any) {
    logger.error("markets-transactions unhandled", { error: e?.message });
    return new Response(JSON.stringify({ error: e?.message ?? "Internal server error" }), { status: 500, headers: jsonH });
  }
}, "markets-transactions");
