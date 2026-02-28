import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";

declare const Deno: any;

type DemandRequest = {
  container_type?: string; // e.g., "20GP", "40HC"
  horizon_weeks?: number;
};

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    const { user, error: authError, supabaseClient: supabase } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    let payload: DemandRequest | null = null;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const weeks = Math.max(4, Math.min(52, payload?.horizon_weeks ?? 12));
    const { data: shipments, error: shipErr } = await supabase
      .from("shipments")
      .select("id, container_type, created_at")
      .limit(5000);
    if (shipErr) throw shipErr;

    // Build weekly counts per container_type
    const counts: Record<string, number[]> = {};
    const baseDate = new Date();
    baseDate.setUTCDate(baseDate.getUTCDate() - 52 * 7);
    const timeToWeek = (d: Date) => Math.floor((d.getTime() - baseDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    (shipments || []).forEach((s: any) => {
      const ct = String(s.container_type || "unknown");
      const week = timeToWeek(new Date(s.created_at));
      if (!counts[ct]) counts[ct] = Array(52).fill(0);
      if (week >= 0 && week < 52) counts[ct][week] += 1;
    });

    const series = counts[payload?.container_type || "40HC"] || Array(52).fill(0);
    // Forecast via TimesFM microservice if available; else naive moving average
    const timesfmUrl = Deno.env.get("TIMESFM_URL");
    let forecast: number[] = [];
    if (timesfmUrl) {
      try {
        const res = await fetch(`${timesfmUrl}/forecast`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ series, horizon: weeks }),
        });
        if (res.ok) {
          const json = await res.json();
          forecast = json.forecast ?? [];
        }
      } catch { /* ignore */ }
    }
    if (!forecast.length) {
      const window = 6;
      const ma = (i: number) => {
        const start = Math.max(0, i - window);
        const slice = series.slice(start, i);
        const avg = slice.length ? slice.reduce((s, v) => s + v, 0) / slice.length : 0;
        return Math.round(avg);
      };
      forecast = Array(weeks).fill(0).map((_, i) => ma(series.length + i));
    }

    await logAiCall(supabaseAdmin, {
      user_id: user.id,
      function_name: "container-demand",
      model_used: timesfmUrl ? "TimesFM" : "moving-average",
      output_summary: { horizon_weeks: weeks, sum: forecast.reduce((s, v) => s + v, 0) },
      pii_detected: false,
      pii_fields_redacted: [],
    });

    return new Response(JSON.stringify({ container_type: payload?.container_type || "40HC", forecast }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    logger.error("Error processing container demand", { error: e });
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}, "container-demand");
