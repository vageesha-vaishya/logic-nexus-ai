/**
 * GET /functions/v1/retail-risk-score
 *
 * Edge-function port of the FastAPI markets-worker endpoint at
 *   services/markets-worker/src/markets_worker/routers/risk.py
 *
 * Why this exists separately from the worker:
 *   The Sthira mobile app baked VITE_MARKETS_WORKER_URL=http://<laptop-IP>:8001
 *   into the APK, which only works when the phone is on the same Wi-Fi as
 *   the dev laptop. Moving the read/compute path here makes the home screen
 *   load over LTE, prod, or any network — Supabase functions are public.
 *
 * Behavior matches the Python original exactly so portfolio_risk_history
 * stays homogeneous across rows written by either path:
 *   - Reads markets.risk_profiles.risk_tag (must exist; 412 if not)
 *   - Reads markets.portfolio_tiers + latest markets.portfolio_snapshots.total_nav per tier
 *   - Computes the four-pillar score (compute.ts)
 *   - Inserts a snapshot into markets.portfolio_risk_history (no dedupe — see Python comment)
 *   - Returns { current: {score, target_score, components, computed_at}, history: [...30] }
 *
 * Auth: requires a user JWT. The user-scoped Supabase client respects RLS;
 * we also `.eq('user_id', user.id)` as defence-in-depth (matches the Python).
 *
 * Self-contained on purpose — kept off the project-wide `_shared/` helpers so
 * MCP-based deployment doesn't have to ship the whole shared tree.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

import { computeRiskScore, TierObservation } from './compute.ts';

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

  // User-scoped client — RLS enforces ownership; the explicit eq is
  // defence-in-depth so a future RLS relaxation can't leak rows here.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userResp, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userResp?.user) {
    return jsonResponse({ error: 'Invalid or expired token' }, 401);
  }
  const userId = userResp.user.id;

  const markets = (supabase as any).schema('markets');

  // 1. Risk profile (required — 412 if onboarding incomplete, matches Python).
  const { data: profile, error: profileErr } = await markets
    .from('risk_profiles')
    .select('risk_tag')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileErr) {
    console.error('risk_profile fetch failed', profileErr.message);
    return jsonResponse({ error: 'Failed to read risk profile' }, 500);
  }
  const riskTag = profile?.risk_tag;
  if (!riskTag) {
    return jsonResponse({ detail: 'Risk profile not set; complete onboarding first' }, 412);
  }

  // 2. Tiers.
  const { data: tierRows, error: tiersErr } = await markets
    .from('portfolio_tiers')
    .select('tier_number, portfolio_id, target_amount')
    .eq('user_id', userId)
    .order('tier_number', { ascending: true });

  if (tiersErr) {
    console.error('portfolio_tiers fetch failed', tiersErr.message);
    return jsonResponse({ error: 'Failed to read portfolio tiers' }, 500);
  }

  // 3. Latest NAV per linked portfolio (in parallel). Mirrors _tier_market_value:
  //    soft-fails to 0 on missing snapshot rows so the endpoint never 500s.
  const tiers: TierObservation[] = await Promise.all(
    (tierRows ?? []).map(async (row: { tier_number: number; portfolio_id: string | null }) => {
      let currentValue = 0;
      if (row.portfolio_id) {
        const { data: snap } = await markets
          .from('portfolio_snapshots')
          .select('total_nav')
          .eq('portfolio_id', row.portfolio_id)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (snap && snap.total_nav != null) currentValue = Number(snap.total_nav) || 0;
      }
      return {
        tier_number:     Number(row.tier_number),
        current_value:   currentValue,
        // Drawdown stubbed at 0 in Phase 1 (matches Python — T19 nightly job
        // will populate from portfolio_nav_history).
        drawdown_pct_6m: 0,
      };
    }),
  );

  // 4. Compute.
  const result = computeRiskScore(tiers, riskTag);

  // 5. Persist snapshot (no dedupe — refreshes themselves are a signal).
  const { data: inserted, error: insertErr } = await markets
    .from('portfolio_risk_history')
    .insert({
      user_id:      userId,
      score:        result.score,
      target_score: result.target_score,
      components:   result.components,
    })
    .select('computed_at')
    .single();

  if (insertErr) {
    console.warn('risk_history insert failed; returning current without persisting', insertErr.message);
  }
  const computedAt = inserted?.computed_at ?? null;

  // 6. History (last 30, newest first).
  const { data: history, error: historyErr } = await markets
    .from('portfolio_risk_history')
    .select('computed_at, score, target_score, components')
    .eq('user_id', userId)
    .order('computed_at', { ascending: false })
    .limit(30);

  if (historyErr) {
    console.warn('risk_history fetch failed; returning empty list', historyErr.message);
  }

  return jsonResponse(
    {
      current: {
        score:        result.score,
        target_score: result.target_score,
        components:   result.components,
        computed_at:  computedAt,
      },
      history: history ?? [],
    },
    200,
  );
});
