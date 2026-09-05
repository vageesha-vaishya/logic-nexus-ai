import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";
import { sanitizeForLLM } from "../_shared/pii-guard.ts";
import { serveWithLogger } from "../_shared/logger.ts";
import { callLLM, LlmCallContext } from "../_shared/llm-gateway.ts";

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

    // Resolve tenant for this caller (needed by the LLM gateway to pick a
    // per-tenant provider config, or fall through to the self-hosted rig).
    const { data: roleRows, error: roleError } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .not('tenant_id', 'is', null)
      .limit(1);
    const tenantId: string | null = roleRows?.[0]?.tenant_id ?? null;
    if (roleError || !tenantId) {
      logger.warn("Caller has no tenant assignment", { userId: user.id, error: roleError?.message });
      return new Response(JSON.stringify({ error: "No tenant assignment for this user" }), { status: 403, headers: { ...headers, "Content-Type": "application/json" } });
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

    const allowed = new Set(payload?.tools || ["rate-engine", "predict-eta", "categorize-document", "extract-bol-fields", "margin-optimizer"]);
    const { sanitized } = sanitizeForLLM(payload.goal || "");

    // Plan tool calls via the shared LLM Gateway (routes to tenant-configured
    // provider, or falls through to the self-hosted vLLM rig — see
    // _shared/llm-gateway.ts). Preserve prior behavior: a provider failure or
    // an unparsable plan degrades to an empty plan rather than failing the
    // request outright.
    const ctx: LlmCallContext = { tenantId, userId: user.id, supabaseAdmin: supabase, logger };
    let plan: ToolCall[] = [];
    let llmResult: Awaited<ReturnType<typeof callLLM>> | null = null;
    try {
      llmResult = await callLLM("ops.agent_plan", { goal: sanitized, tools_json: JSON.stringify(Array.from(allowed)) }, ctx);
      let parsed: any;
      try {
        parsed = JSON.parse(llmResult.text);
      } catch {
        const stripped = llmResult.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
        parsed = JSON.parse(stripped);
      }
      plan = Array.isArray(parsed) ? parsed : [];
    } catch (e: any) {
      logger.warn("ai-agent plan generation failed", { error: e?.message ?? String(e) });
      plan = [];
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
    await logAiCall(supabase, {
      tenant_id: tenantId,
      user_id: user.id,
      function_name: "ai-agent",
      model_used: llmResult ? `${llmResult.provider}:${llmResult.model}` : "none",
      input_tokens: llmResult?.inputTokens,
      output_tokens: llmResult?.outputTokens,
      total_cost_usd: llmResult?.costUsd,
      output_summary: { steps: plan.length },
      pii_detected: false,
      pii_fields_redacted: [],
    });
    return new Response(JSON.stringify({ plan, results }), { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
  } catch (e: any) {
    logger.error("Error in ai-agent:", { error: e });
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }
}, "ai-agent");
