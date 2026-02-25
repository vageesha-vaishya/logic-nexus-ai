import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";

declare const Deno: any;

type RiskRequest = {
  shipment_id?: string;
  route?: { origin_id?: string; destination_id?: string };
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

    let payload: RiskRequest | null = null;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
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

    // Internal signals
    let delayRisk = 0, complianceRisk = 0, routeRisk = 0;
    if (payload?.shipment_id) {
      const { data: delays } = await supabase
        .from("shipment_delays")
        .select("severity, delay_hours")
        .eq("shipment_id", payload.shipment_id);
      const avgDelay = (delays || []).reduce((s: number, d: any) => s + Number(d.delay_hours || 0), 0) / Math.max(1, (delays || []).length);
      delayRisk = Math.min(1, avgDelay / 48); // 2+ days average => high risk
    }
    const { data: compliance } = await supabase
      .from("compliance_screenings")
      .select("status")
      .limit(20)
      .order("created_at", { ascending: false });
    const hits = (compliance || []).filter((c: any) => String(c.status || "").toLowerCase().includes("hit")).length;
    complianceRisk = Math.min(1, hits / Math.max(1, (compliance || []).length));

    if (payload?.route?.origin_id && payload?.route?.destination_id) {
      // Historical route delays ratio
      const { data: legs } = await supabase
        .from("shipment_legs")
        .select("origin_id, destination_id, planned_departure_date, planned_arrival_date, transit_days")
        .eq("origin_id", payload.route.origin_id)
        .eq("destination_id", payload.route.destination_id)
        .limit(50);
      const transits = (legs || []).map((l: any) => {
        if (typeof l.transit_days === "number") return l.transit_days;
        const dep = l.planned_departure_date ? new Date(l.planned_departure_date) : null;
        const arr = l.planned_arrival_date ? new Date(l.planned_arrival_date) : null;
        return dep && arr ? Math.round((arr.getTime() - dep.getTime()) / (1000*60*60*24)) : null;
      }).filter((d: any) => typeof d === "number") as number[];
      const avgTransit = transits.length ? transits.reduce((s, v) => s + v, 0) / transits.length : 0;
      routeRisk = Math.min(1, Math.max(0, (avgTransit - 10) / 30)); // simplistic baseline
    }

    // External signals
    const riskApi = Deno.env.get("RISK_API_URL");
    let geopoliticalRisk = 0;
    if (riskApi) {
      try {
        const res = await fetch(`${riskApi}/risk`, { method: "GET" });
        if (res.ok) {
          const json = await res.json();
          geopoliticalRisk = Math.min(1, Number(json.global_risk_index ?? 0.3));
        }
      } catch { /* ignore */ }
    }

    const weights = { delay: 0.35, compliance: 0.25, route: 0.2, geopolitical: 0.2 };
    const risk_score = Math.max(0, Math.min(1,
      weights.delay * delayRisk +
      weights.compliance * complianceRisk +
      weights.route * routeRisk +
      weights.geopolitical * geopoliticalRisk
    ));

    await logAiCall(supabase, {
      user_id: user.id,
      function_name: "risk-scoring",
      model_used: "risk-ensemble-v1",
      output_summary: { risk_score, components: { delayRisk, complianceRisk, routeRisk, geopoliticalRisk } },
      pii_detected: false,
      pii_fields_redacted: [],
    });

    return new Response(JSON.stringify({ risk_score, components: { delayRisk, complianceRisk, routeRisk, geopoliticalRisk } }), {
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
