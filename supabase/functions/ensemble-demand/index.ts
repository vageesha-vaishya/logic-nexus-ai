import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";
import { sanitizeForLLM } from "../_shared/pii-guard.ts";
import { serveWithLogger } from "../_shared/logger.ts";

declare const Deno: any;

type EnsembleRequest = { container_type?: string; horizon_weeks?: number };

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const { user, error: authError, supabaseClient: supabase } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });
    }
    let payload: EnsembleRequest | null = null;
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";

    const weeks = Math.max(4, Math.min(52, payload?.horizon_weeks ?? 12));
    const ct = payload?.container_type || "40HC";
    const timesfmResp = await fetch(`${supabaseUrl}/functions/v1/container-demand`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify({ container_type: ct, horizon_weeks: weeks }) });
    let timesfm: number[] = [];
    if (timesfmResp.ok) {
      const tj = await timesfmResp.json();
      timesfm = tj?.forecast || [];
    }
    const { data: shipments } = await supabase.from("shipments").select("id, container_type, created_at").limit(5000);
    const baseDate = new Date();
    baseDate.setUTCDate(baseDate.getUTCDate() - 52 * 7);
    const series = Array(52).fill(0);
    (shipments || []).forEach((s: any) => {
      const k = String(s.container_type || "unknown");
      if (k !== ct) return;
      const d = new Date(s.created_at);
      const w = Math.floor((d.getTime() - baseDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (w >= 0 && w < 52) series[w] += 1;
    });
    const linForecast = Array(weeks).fill(0).map((_, i) => {
      const n = series.length;
      const x = Array.from({ length: n }, (_, j) => j);
      const xm = x.reduce((s, v) => s + v, 0) / n;
      const ym = series.reduce((s, v) => s + v, 0) / n;
      let num = 0, den = 0;
      for (let j = 0; j < n; j++) { num += (x[j] - xm) * (series[j] - ym); den += (x[j] - xm) * (x[j] - xm); }
      const b1 = den ? num / den : 0;
      const b0 = ym - b1 * xm;
      const t = n + i;
      return Math.max(0, Math.round(b0 + b1 * t));
    });
    const ensemble = Array(weeks).fill(0).map((_, i) => Math.round(((timesfm[i] || 0) + linForecast[i]) / 2));
    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    let narrative = "";
    if (openaiKey) {
      const ctx = JSON.stringify({ container_type: ct, forecast: ensemble.slice(0, 8) });
      const { sanitized } = sanitizeForLLM(ctx);
      const res = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` }, body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: "Write a short weekly forecast summary with risks and actions." }, { role: "user", content: sanitized }], temperature: 0.2, max_tokens: 220 }) });
      if (res.ok) {
        const json = await res.json();
        narrative = json.choices?.[0]?.message?.content || "";
      }
    }
    await logAiCall(supabase as any, { user_id: user.id, function_name: "ensemble-demand", model_used: "TimesFM+Linear+LLM", output_summary: { narrative_preview: narrative.slice(0, 80) }, pii_detected: false, pii_fields_redacted: [] });
    return new Response(JSON.stringify({ forecast: ensemble, narrative }), { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
  } catch (e: any) {
    logger.error("Error in ensemble-demand", { error: e });
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }
}, "ensemble-demand");
