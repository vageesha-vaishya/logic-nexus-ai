import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";

declare const Deno: any;

type AnomalyRequest = { save?: boolean };

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });
    }
    let payload: AnomalyRequest | null = null;
    try {
      payload = await req.json();
    } catch {
      payload = { save: false };
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });
    const anomalies: any[] = [];
    const { data: quotes } = await supabase.from("quotes").select("id, sell_price, buy_price, margin_pct").limit(1000);
    (quotes || []).forEach((q: any) => {
      const margin = typeof q.margin_pct === "number" ? q.margin_pct : (Number(q.sell_price || 0) - Number(q.buy_price || 0)) / Math.max(1, Number(q.sell_price || 1)) * 100;
      if (margin < 1 || margin > 80) anomalies.push({ type: "financial_margin_outlier", ref_id: q.id, value: margin });
    });
    const { data: delays } = await supabase.from("shipment_delays").select("shipment_id, delay_hours").limit(1000);
    (delays || []).forEach((d: any) => {
      if (Number(d.delay_hours || 0) > 72) anomalies.push({ type: "operational_delay_extreme", ref_id: d.shipment_id, value: Number(d.delay_hours || 0) });
    });
    const { data: invoices } = await supabase.from("invoices").select("id, status, total_amount").limit(1000);
    (invoices || []).forEach((i: any) => {
      const status = String(i.status || "").toLowerCase();
      if (status.includes("error") || (status.includes("pending") && Number(i.total_amount || 0) > 10000)) anomalies.push({ type: "quality_invoice_issue", ref_id: i.id, value: i.status });
    });
    if (payload?.save) {
      for (const a of anomalies) {
        try { await supabase.from("anomalies").insert({ type: a.type, ref_id: a.ref_id, value: a.value, detected_at: new Date().toISOString() }); } catch (e) { const _err = e; }
      }
    }
    await logAiCall(supabase as any, { user_id: user.id, function_name: "anomaly-detection", model_used: "rules", output_summary: { count: anomalies.length }, pii_detected: false, pii_fields_redacted: [] });
    return new Response(JSON.stringify({ anomalies }), { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }
});
