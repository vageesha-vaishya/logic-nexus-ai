import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";

declare const Deno: any;

type CarrierScoreRequest = {
  carrier_id: string;
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

    let payload: CarrierScoreRequest | null = null;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    if (!payload?.carrier_id) {
      return new Response(JSON.stringify({ error: "Missing carrier_id" }), {
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

    const { data: legs, error: legsErr } = await supabase
      .from("shipment_legs")
      .select("carrier_id, planned_departure_date, planned_arrival_date, actual_departure_date, actual_arrival_date, delay_hours")
      .eq("carrier_id", payload.carrier_id)
      .limit(500);
    if (legsErr) throw legsErr;

    const perf = (legs || []).map((l: any) => {
      const plannedArr = l.planned_arrival_date ? new Date(l.planned_arrival_date) : null;
      const actualArr = l.actual_arrival_date ? new Date(l.actual_arrival_date) : null;
      const delayH = typeof l.delay_hours === "number" ? l.delay_hours :
        (plannedArr && actualArr ? Math.round((actualArr.getTime() - plannedArr.getTime()) / (1000*60*60)) : 0);
      return { delayH };
    });
    const onTime = perf.filter(p => p.delayH <= 2).length;
    const late = perf.filter(p => p.delayH > 2).length;
    const total = Math.max(1, perf.length);
    const onTimeRate = onTime / total;

    // Score from 0..100 with penalty for late
    const score = Math.round(Math.max(0, Math.min(100, onTimeRate * 100 - late * 0.1)));

    // Try persisting to carriers table if performance_score exists
    try {
      await supabase.from("carriers").update({ performance_score: score }).eq("id", payload.carrier_id);
    } catch { /* ignore */ }

    await logAiCall(supabase, {
      user_id: user.id,
      function_name: "carrier-scoring",
      model_used: "on-time-rate-heuristic",
      output_summary: { score, onTimeRate, samples: total },
      pii_detected: false,
      pii_fields_redacted: [],
    });

    return new Response(JSON.stringify({ carrier_id: payload.carrier_id, score, on_time_rate: onTimeRate, samples: total }), {
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
