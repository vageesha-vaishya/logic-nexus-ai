import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";

declare const Deno: any;

type RevenueRequest = { horizon_months?: number };

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });
    }
    let payload: RevenueRequest | null = null;
    try {
      payload = await req.json();
    } catch {
      payload = { horizon_months: 6 };
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });
    const months = Math.max(1, Math.min(24, payload?.horizon_months ?? 6));
    const { data: opps } = await supabase.from("opportunities").select("id, amount, close_date, stage").limit(5000);
    const now = new Date();
    const byMonth: Record<string, { amount: number; prob: number }> = {};
    (opps || []).forEach((o: any) => {
      const cd = o.close_date ? new Date(o.close_date) : now;
      const key = `${cd.getUTCFullYear()}-${String(cd.getUTCMonth() + 1).padStart(2, "0")}`;
      const stage = String(o.stage || "").toLowerCase();
      const stageProb = stage.includes("negotiation") ? 0.6 : stage.includes("proposal") ? 0.35 : stage.includes("qualification") ? 0.2 : stage.includes("contract") ? 0.8 : stage.includes("closed won") ? 1 : 0.1;
      const amount = Number(o.amount || 0);
      const item = byMonth[key] || { amount: 0, prob: 0 };
      item.amount += amount;
      item.prob = Math.max(item.prob, stageProb);
      byMonth[key] = item;
    });
    const keys = Object.keys(byMonth).sort();
    const forecast: Array<{ month: string; expected_revenue: number }> = [];
    for (const k of keys.slice(0, months)) {
      const v = byMonth[k];
      forecast.push({ month: k, expected_revenue: Math.round(v.amount * v.prob) });
    }
    await logAiCall(supabase as any, { user_id: user.id, function_name: "revenue-forecasting", model_used: "pipeline-weighted", output_summary: { months: forecast.length }, pii_detected: false, pii_fields_redacted: [] });
    return new Response(JSON.stringify({ forecast }), { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }
});
