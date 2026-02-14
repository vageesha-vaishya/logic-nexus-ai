import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";

declare const Deno: any;

type EtaRequest = {
  origin_id?: string;
  destination_id?: string;
  mode?: "air" | "ocean" | "road" | "rail";
  carrier_id?: string;
  depart_date?: string; // ISO date, defaults to today
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

    let payload: EtaRequest | null = null;
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

    const origin = payload?.origin_id ?? null;
    const destination = payload?.destination_id ?? null;
    const mode = payload?.mode ?? null;
    const carrier = payload?.carrier_id ?? null;
    const departDate = payload?.depart_date ?? new Date().toISOString().split("T")[0];

    // Fetch recent transit times from shipments/legs if available
    // Heuristic: use transit_days column when present; otherwise compute from dates
    const { data: legs, error: legsErr } = await supabase
      .from("shipment_legs")
      .select("origin_id, destination_id, mode, carrier_id, planned_departure_date, planned_arrival_date, transit_days")
      .limit(200)
      .order("planned_departure_date", { ascending: false });
    if (legsErr) throw legsErr;

    const matches = (legs || []).filter((l: any) => {
      const mOk = !mode || l.mode === mode;
      const oOk = !origin || l.origin_id === origin;
      const dOk = !destination || l.destination_id === destination;
      const cOk = !carrier || l.carrier_id === carrier;
      return mOk && oOk && dOk && cOk;
    });

    const durations = matches.map((l: any) => {
      if (typeof l.transit_days === "number" && l.transit_days > 0) return l.transit_days;
      const dep = l.planned_departure_date ? new Date(l.planned_departure_date) : null;
      const arr = l.planned_arrival_date ? new Date(l.planned_arrival_date) : null;
      if (dep && arr) {
        const days = Math.max(1, Math.round((arr.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24)));
        return days;
      }
      return null;
    }).filter((d: any) => typeof d === "number") as number[];

    let predicted_days: number;
    if (durations.length >= 3) {
      // trimmed mean to resist outliers
      const sorted = durations.slice().sort((a, b) => a - b);
      const trim = Math.max(1, Math.floor(sorted.length * 0.1));
      const trimmed = sorted.slice(trim, sorted.length - trim);
      const avg = trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
      predicted_days = Math.max(1, Math.round(avg));
    } else if (durations.length > 0) {
      const avg = durations.reduce((s, v) => s + v, 0) / durations.length;
      predicted_days = Math.max(1, Math.round(avg));
    } else {
      // fallback heuristics by mode
      const defaults: Record<string, number> = { air: 5, ocean: 28, road: 7, rail: 10 };
      predicted_days = defaults[(mode || "ocean")] || 14;
    }

    const depart = new Date(departDate + "T00:00:00Z");
    const etaDate = new Date(depart.getTime() + predicted_days * 24 * 60 * 60 * 1000);
    const result = {
      predicted_days,
      depart_date: depart.toISOString().split("T")[0],
      eta_date: etaDate.toISOString().split("T")[0],
      samples_used: durations.length,
    };

    await logAiCall(supabase, {
      user_id: user.id,
      function_name: "predict-eta",
      model_used: "heuristic-trimmed-mean",
      output_summary: { predicted_days, samples_used: durations.length },
      pii_detected: false,
      pii_fields_redacted: [],
    });

    return new Response(JSON.stringify(result), {
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
