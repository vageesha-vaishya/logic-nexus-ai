import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";
import { sanitizeForLLM } from "../_shared/pii-guard.ts";

declare const Deno: any;

type WinProbRequest = {
  opportunity_id: string;
};

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    let payload: WinProbRequest | null = null;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    if (!payload?.opportunity_id) {
      return new Response(JSON.stringify({ error: "Missing opportunity_id" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: opp, error: oppErr } = await supabase
      .from("opportunities")
      .select("id, stage, amount, close_date, last_activity_at, lead_source, industry, competitor_count, quote_count, won_quotes")
      .eq("id", payload.opportunity_id)
      .maybeSingle();
    if (oppErr || !opp) throw oppErr || new Error("Opportunity not found");

    const now = Date.now();
    const daysToClose = opp.close_date ? Math.max(0, Math.round((new Date(opp.close_date).getTime() - now) / (1000*60*60*24))) : 30;
    const daysSinceActivity = opp.last_activity_at ? Math.max(0, Math.round((now - new Date(opp.last_activity_at).getTime()) / (1000*60*60*24))) : 999;
    const amount = Number(opp.amount ?? 0);
    const stage = String(opp.stage ?? "").toLowerCase();
    const quoteCount = Number(opp.quote_count ?? 0);
    const wonQuotes = Number(opp.won_quotes ?? 0);
    const competitorCount = Number(opp.competitor_count ?? 0);
    const industry = String(opp.industry ?? "").toLowerCase();

    const stageMap: Record<string, number> = {
      prospecting: -1.0,
      qualification: -0.5,
      proposal: 0.0,
      negotiation: 0.6,
      "contract sent": 0.8,
      "closed won": 2.0,
      "closed lost": -2.0,
    };
    const w = {
      intercept: -0.5 + (stageMap[stage] ?? 0),
      days_to_close: -0.01,
      days_since_activity: -0.03,
      amount: 0.00001,
      quote_win_rate: 0.8,
      competitors: -0.2,
      industry_prior: ["retail","electronics","automotive","apparel"].includes(industry) ? 0.4 : 0.0,
    };

    const winRate = quoteCount > 0 ? wonQuotes / quoteCount : 0;
    const z = w.intercept
      + w.days_to_close * daysToClose
      + w.days_since_activity * daysSinceActivity
      + w.amount * amount
      + w.quote_win_rate * winRate
      + w.competitors * competitorCount
      + w.industry_prior;
    const prob = 1 / (1 + Math.exp(-z));
    const probability = Math.max(0, Math.min(1, prob));

    // Attempt to persist to history table (if exists)
    try {
      await supabase.from("opportunity_probability_history").insert({
        opportunity_id: opp.id,
        probability,
        calculated_at: new Date().toISOString(),
      });
    } catch { /* ignore */ }

    const { sanitized, redacted } = sanitizeForLLM(JSON.stringify({ stage, amount, daysToClose, daysSinceActivity, winRate, competitorCount, industry }));
    await logAiCall(supabase, {
      user_id: user.id,
      function_name: "win-probability",
      model_used: "xgboost-proxy-heuristic",
      output_summary: { probability },
      pii_detected: redacted.length > 0,
      pii_fields_redacted: redacted,
    });

    return new Response(JSON.stringify({ opportunity_id: opp.id, probability }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
