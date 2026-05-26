/**
 * GET /functions/v1/portfolio-pnl?portfolio_id=<uuid>&lookback=365
 *
 * Edge-function port of GET /v1/portfolio/pnl/{portfolio_id} from
 *   services/markets-worker/src/markets_worker/routers/portfolio_pnl.py
 *
 * Same motivation as retail-risk-score: the Sthira APK can't reach the
 * laptop's markets-worker over LTE, so the read path moves here. This
 * version covers only the /pnl endpoint, not /advisor (Claude) or
 * /attribution (yfinance) — those keep living on the FastAPI worker.
 *
 * The transactions-replay maths lives in ./replay.ts so it can be tested
 * in isolation against the same fixtures as the Python implementation.
 *
 * Auth: requires a user JWT. User-scoped client + explicit portfolio
 * ownership check, so RLS + the explicit check both have to fail before
 * any leak.
 *
 * Self-contained on purpose — kept off the project-wide `_shared/` helpers
 * so MCP-based deployment doesn't have to ship the whole shared tree.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

import { replayPnL, buildPnLResponse, RawTxn, PriceRow } from './replay.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve: (h: (req: Request) => Promise<Response>) => void };

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type':                 'application/json',
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl     = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey =
    Deno.env.get('SUPABASE_ANON_KEY') ??
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
    '';

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userResp, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userResp?.user) {
    return jsonResponse({ error: 'Invalid or expired token' }, 401);
  }
  const userId = userResp.user.id;

  // Accept portfolio_id/lookback from query string OR JSON body — supabase-js's
  // functions.invoke({body}) POSTs JSON, but a direct HTTP GET with ?portfolio_id
  // should also work for ad-hoc testing.
  const url = new URL(req.url);
  let portfolio_id = url.searchParams.get('portfolio_id') ?? '';
  let lookback     = Number(url.searchParams.get('lookback') ?? '365');

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      portfolio_id = portfolio_id || String(body?.portfolio_id ?? '');
      const lb = body?.lookback != null ? Number(body.lookback) : NaN;
      if (Number.isFinite(lb)) lookback = lb;
    } catch { /* ignore */ }
  }

  if (!portfolio_id) {
    return jsonResponse({ error: 'portfolio_id is required' }, 400);
  }
  // Match Python `Query(365, ge=1, le=1825)`.
  if (!Number.isFinite(lookback) || lookback < 1) lookback = 365;
  if (lookback > 1825) lookback = 1825;

  const markets = (supabase as any).schema('markets');

  // 1. Verify portfolio ownership (RLS + explicit eq, like the Python).
  const { data: portfolio, error: pErr } = await markets
    .from('portfolios')
    .select('id, owner_user_id')
    .eq('id', portfolio_id)
    .maybeSingle();

  if (pErr) {
    console.error('portfolio lookup failed', pErr.message);
    return jsonResponse({ error: 'Portfolio lookup failed' }, 500);
  }
  if (!portfolio) return jsonResponse({ detail: 'Portfolio not found' }, 404);
  if (portfolio.owner_user_id && portfolio.owner_user_id !== userId) {
    return jsonResponse({ detail: 'Access denied' }, 403);
  }

  // 2. Transactions for this portfolio (chronological).
  const { data: txnRows, error: txnErr } = await markets
    .from('transactions')
    .select('txn_date, instrument_id, txn_type, qty, price, charges')
    .eq('portfolio_id', portfolio_id)
    .order('txn_date', { ascending: true });

  if (txnErr) {
    console.error('transactions fetch failed', txnErr.message);
    return jsonResponse({ error: 'Transactions fetch failed' }, 500);
  }
  const txns: RawTxn[] = txnRows ?? [];
  if (txns.length === 0) return jsonResponse(buildPnLResponse(portfolio_id, [], 0), 200);

  const instrumentIds = Array.from(
    new Set(txns.map(t => t.instrument_id).filter((x): x is string => Boolean(x))),
  );
  if (instrumentIds.length === 0) {
    return jsonResponse(buildPnLResponse(portfolio_id, [], 0), 200);
  }

  // 3. Price history within the lookback window. Supabase's REST default
  //    page size is 1000 rows — a 365-day window across multiple instruments
  //    can exceed that. Page until exhausted.
  const startDate = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  const allPrices: PriceRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await markets
      .from('price_history')
      .select('instrument_id, ts, close')
      .in('instrument_id', instrumentIds)
      .gte('ts', startDate)
      .order('ts', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error('price_history fetch failed', error.message);
      return jsonResponse({ error: 'Price history fetch failed' }, 500);
    }
    if (!data || data.length === 0) break;
    allPrices.push(...(data as PriceRow[]));
    if (data.length < PAGE) break;
  }

  if (allPrices.length === 0) {
    return jsonResponse(buildPnLResponse(portfolio_id, [], 0), 200);
  }

  // 4. Pure replay.
  const result = replayPnL(portfolio_id, txns, allPrices);

  console.log(JSON.stringify({
    event: 'portfolio.pnl',
    portfolio_id,
    lookback,
    series_len: result.series.length,
  }));

  return jsonResponse(result, 200);
});
