import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";

declare const Deno: any;

type FleetRequest = { date?: string };

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });
    }
    let payload: FleetRequest | null = null;
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });
    const { data: vehicles } = await supabase.from("vehicles").select("id, capacity").limit(1000);
    const { data: shipments } = await supabase.from("shipments").select("id, container_type, estimated_volume, planned_departure_date").limit(1000);
    const pending = (shipments || []).filter((s: any) => !s.assigned_vehicle_id);
    const sortedShipments = pending.slice().sort((a: any, b: any) => Number(b.estimated_volume || 0) - Number(a.estimated_volume || 0));
    const assign: Array<{ shipment_id: string; vehicle_id: string }> = [];
    const cap: Record<string, number> = {};
    (vehicles || []).forEach((v: any) => { cap[v.id] = Number(v.capacity || 0); });
    for (const s of sortedShipments) {
      let best: string | null = null;
      let bestRemain = -Infinity;
      for (const v of vehicles || []) {
        const rem = cap[v.id] - Number(s.estimated_volume || 0);
        if (rem >= 0 && rem > bestRemain) { bestRemain = rem; best = v.id; }
      }
      if (best) {
        assign.push({ shipment_id: s.id, vehicle_id: best });
        cap[best] = cap[best] - Number(s.estimated_volume || 0);
      }
    }
    for (const a of assign) {
      try { await supabase.from("shipments").update({ assigned_vehicle_id: a.vehicle_id }).eq("id", a.shipment_id); } catch (e) { const _err = e; }
    }
    await logAiCall(supabase as any, { user_id: user.id, function_name: "fleet-utilization", model_used: "greedy-capacity", output_summary: { assigned: assign.length }, pii_detected: false, pii_fields_redacted: [] });
    return new Response(JSON.stringify({ assignments: assign }), { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }
});
