import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";
import { sanitizeForLLM } from "../_shared/pii-guard.ts";

declare const Deno: any;

type RouteStop = { id?: string; lat: number; lng: number; time_window_start?: string; time_window_end?: string };
type RouteRequest = { vehicle_count?: number; stops: RouteStop[] };

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });
    }
    let payload: RouteRequest | null = null;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });
    const vroomUrl = Deno.env.get("VROOM_URL") ?? "";
    const vehicleCount = Math.max(1, Math.min(50, payload?.vehicle_count ?? 1));
    let optimized: any = null;
    if (vroomUrl && payload?.stops?.length) {
      try {
        const res = await fetch(`${vroomUrl}/optimize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicle_count: vehicleCount, stops: payload.stops }) });
        if (res.ok) optimized = await res.json();
      } catch (e) {
        optimized = null;
      }
    }
    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    let suggestion = "";
    if (openaiKey) {
      const ctx = JSON.stringify({ vehicle_count: vehicleCount, stops: payload?.stops || [], result: optimized });
      const { sanitized } = sanitizeForLLM(ctx);
      const res = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` }, body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: "Provide concise routing suggestions with efficiency tips." }, { role: "user", content: sanitized }], temperature: 0.3, max_tokens: 300 }) });
      if (res.ok) {
        const json = await res.json();
        suggestion = json.choices?.[0]?.message?.content || "";
      }
    }
    await logAiCall(supabase as any, { user_id: user.id, function_name: "route-optimization", model_used: vroomUrl ? "VROOM+LLM" : "LLM", output_summary: { suggestion_preview: suggestion.slice(0, 80) }, pii_detected: false, pii_fields_redacted: [] });
    return new Response(JSON.stringify({ optimized, suggestion }), { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }
});
