import { serveWithLogger } from "../_shared/logger.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";

declare const Deno: any;

type MarginOptimizerRequest = {
  product_id?: string;
  lookback_days?: number;
};

serveWithLogger(async (req, logger, supabaseAdmin) => {
  try {
    const { user, error: authError, supabaseClient } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let payload: MarginOptimizerRequest | null = null;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = supabaseClient;

    const lookbackDays = Math.max(7, Math.min(365, payload?.lookback_days ?? 90));
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: quotes, error: quotesErr } = await supabase
      .from("quotes")
      .select("id, product_id, margin_pct, won")
      .gte("created_at", since)
      .limit(1000);
    if (quotesErr) throw quotesErr;

    const rows = (quotes || []).filter((q: any) => !payload?.product_id || q.product_id === payload.product_id);
    if (!rows.length) {
      return new Response(JSON.stringify({ suggestion: null, reason: "No data in lookback window" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fit simple logistic regression of win ~ margin_pct using Newton steps
    const X = rows.map((r: any) => [1, Number(r.margin_pct || 0)]);
    const y = rows.map((r: any) => Number(!!r.won));
    let w0 = 0, w1 = 0; // intercept and slope
    for (let iter = 0; iter < 20; iter++) {
      let g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
      for (let i = 0; i < X.length; i++) {
        const z = w0 * X[i][0] + w1 * X[i][1];
        const p = 1 / (1 + Math.exp(-z));
        const e = y[i] - p;
        g0 += e * X[i][0];
        g1 += e * X[i][1];
        const v = p * (1 - p);
        h00 += v * X[i][0] * X[i][0];
        h01 += v * X[i][0] * X[i][1];
        h11 += v * X[i][1] * X[i][1];
      }
      const det = h00 * h11 - h01 * h01;
      if (Math.abs(det) < 1e-6) break;
      const inv00 = h11 / det, inv01 = -h01 / det, inv11 = h00 / det;
      const step0 = inv00 * g0 + inv01 * g1;
      const step1 = inv01 * g0 + inv11 * g1;
      w0 += step0;
      w1 += step1;
      if (Math.abs(step0) + Math.abs(step1) < 1e-6) break;
    }

    // Find margin that yields target win rate (e.g., 45%) maximizing revenue: revenue ~ margin_pct * win_prob
    const targetWin = 0.45;
    let best = { margin_pct: 0, score: -Infinity, win_prob: 0 };
    for (let m = 0; m <= 60; m += 0.5) {
      const p = 1 / (1 + Math.exp(-(w0 + w1 * m)));
      const rev = m * Math.max(p, targetWin);
      if (rev > best.score) best = { margin_pct: m, score: rev, win_prob: p };
    }

    await logAiCall(supabase, {
      user_id: user.id,
      function_name: "margin-optimizer",
      model_used: "logistic-elasticity-v1",
      output_summary: { margin_pct: best.margin_pct, win_prob: best.win_prob },
      pii_detected: false,
      pii_fields_redacted: [],
    });

    return new Response(JSON.stringify({ suggestion: { margin_pct: best.margin_pct, estimated_win_prob: best.win_prob } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    logger.error("Margin optimizer error", { error: e });
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}, "margin-optimizer");
