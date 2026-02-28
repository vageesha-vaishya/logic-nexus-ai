import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";
import { sanitizeForLLM } from "../_shared/pii-guard.ts";
import { serveWithLogger } from "../_shared/logger.ts";

declare const Deno: any;

type ToolCall = { name: string; args: any };
type AgentRequest = { goal: string; tools?: string[] };

serveWithLogger(async (req, logger, supabase) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });
    }
    let payload: AgentRequest | null = null;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });
    }
    if (!payload) {
        return new Response(JSON.stringify({ error: "Empty payload" }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    // Note: serveWithLogger provides a service role 'supabase' client.
    // For tool calls that need to act as the user, we'll rely on passing the 'Authorization' header in the fetch calls below.
    
    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const allowed = new Set(payload?.tools || ["rate-engine", "predict-eta", "categorize-document", "extract-bol-fields", "margin-optimizer"]);
    const sys = "You are an operations agent. Plan tool calls to achieve the goal. Return JSON with steps: [{name, args}]. Use only allowed tools.";
    const { sanitized } = sanitizeForLLM(payload.goal || "");
    let plan: ToolCall[] = [];
    if (openaiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` }, body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: sys }, { role: "user", content: JSON.stringify({ goal: sanitized, tools: Array.from(allowed) }) }], temperature: 0.2, max_tokens: 400 }) });
      if (res.ok) {
        const json = await res.json();
        try { plan = JSON.parse(json.choices?.[0]?.message?.content || "[]"); } catch (e) { plan = []; }
      }
    }
    const results: any[] = [];
    for (const step of plan) {
      if (!allowed.has(step.name)) continue;
      const url = `${supabaseUrl}/functions/v1/${step.name}`;
      try {
        const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify(step.args || {}) });
        const data = await resp.json();
        results.push({ name: step.name, ok: resp.ok, data });
      } catch {
        results.push({ name: step.name, ok: false, error: "call_failed" });
      }
    }
    await logAiCall(supabase, { user_id: user.id, function_name: "ai-agent", model_used: "planner+tools", output_summary: { steps: plan.length }, pii_detected: false, pii_fields_redacted: [] });
    return new Response(JSON.stringify({ plan, results }), { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
  } catch (e: any) {
    logger.error("Error in ai-agent:", { error: e });
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }
}, "ai-agent");
