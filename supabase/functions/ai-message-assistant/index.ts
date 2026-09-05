import { corsHeaders, preflight } from "../_shared/cors.ts";
import { serveWithLogger } from "../_shared/logger.ts";
import { logAiCall } from "../_shared/audit.ts";
import { requireAuth } from "../_shared/auth.ts";
import { callLLM, LlmCallContext } from "../_shared/llm-gateway.ts";

type Action = "draft" | "summarize";

interface RequestBody {
  action: Action;
  message_id?: string;
  text?: string;
  tenant_id?: string;
}

function sanitize(text: string): { sanitized: string; redacted: string[] } {
  const redacted: string[] = [];
  let s = text;
  s = s.replace(/\b[\w.-]+@[\w.-]+\.\w{2,4}\b/g, () => { redacted.push("email"); return "[EMAIL]"; });
  s = s.replace(/\b(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b/g, () => { redacted.push("phone"); return "[PHONE]"; });
  s = s.replace(/\b(?:\d[ -]*?){13,16}\b/g, () => { redacted.push("card"); return "[CARD]"; });
  return { sanitized: s, redacted };
}

serveWithLogger(async (req, logger, adminSupabase) => {
  const pre = preflight(req);
  if (pre) return pre;

  const { user, error: authError, supabaseClient } = await requireAuth(req, logger);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const payload = await req.json() as RequestBody;
    const { action, message_id, text } = payload;
    if (!action) return new Response(JSON.stringify({ error: "Missing action" }), { status: 400, headers: corsHeaders });

    let baseText = text || "";
    let tenantId = payload.tenant_id || "";
    if (!baseText && message_id) {
      // Use user-scoped client
      const { data, error } = await supabaseClient
        .from("messages")
        .select("tenant_id, subject, body_text, body_html")
        .eq("id", message_id)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Message not found" }), { status: 404, headers: corsHeaders });
      }
      tenantId = data.tenant_id;
      baseText = [data.subject, data.body_text, data.body_html].filter(Boolean).join("\n\n");
    }

    // Resolve tenant for the LLM gateway if not already known from the
    // request or the message row (needed to pick a per-tenant provider
    // config, or fall through to the self-hosted vLLM rig).
    if (!tenantId) {
      const { data: roleRows, error: roleError } = await adminSupabase
        .from("user_roles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .not("tenant_id", "is", null)
        .limit(1);
      tenantId = roleRows?.[0]?.tenant_id ?? "";
      if (!tenantId) {
        logger.warn("Caller has no tenant assignment", { userId: user.id, error: roleError?.message });
        return new Response(JSON.stringify({ error: "No tenant assignment for this user" }), { status: 403, headers: corsHeaders });
      }
    }

    const { sanitized, redacted } = sanitize(baseText);
    const ctx: LlmCallContext = { tenantId, userId: user.id, supabaseAdmin: adminSupabase, logger };

    if (action === "summarize") {
      const t0 = performance.now();
      let summary = "Summary: Customer message received. Intent unclear. No immediate urgency. Next step: acknowledge and clarify.";
      let llmResult: Awaited<ReturnType<typeof callLLM>> | null = null;
      try {
        llmResult = await callLLM("comms.message_assistant", {
          instruction: "Summarize the following customer communication thread in 4 bullet points focusing on intent, urgency, and next steps.",
          text: sanitized,
        }, ctx);
        if (llmResult.text.trim()) summary = llmResult.text.trim();
      } catch (e: any) {
        logger.warn("ai-message-assistant summarize failed", { error: e?.message ?? String(e) });
      }
      if (message_id) {
        await supabaseClient.from("messages").update({ ai_summary: summary, updated_at: new Date().toISOString() }).eq("id", message_id);
      }
      const latency = Math.round(performance.now() - t0);
      await logAiCall(adminSupabase, {
        tenant_id: tenantId || null,
        user_id: user.id,
        function_name: "ai-message-assistant",
        model_used: llmResult ? `${llmResult.provider}:${llmResult.model}` : "fallback",
        input_tokens: llmResult?.inputTokens,
        output_tokens: llmResult?.outputTokens,
        total_cost_usd: llmResult?.costUsd,
        latency_ms: latency,
        pii_detected: redacted.length > 0,
        pii_fields_redacted: redacted,
        output_summary: { message_id, summary }
      });
      return new Response(JSON.stringify({ summary }), { headers: corsHeaders });
    }

    if (action === "draft") {
      const t0 = performance.now();
      let draft = "Thanks for reaching out. We’ve received your message and will follow up with the next steps shortly.";
      let llmResult: Awaited<ReturnType<typeof callLLM>> | null = null;
      try {
        llmResult = await callLLM("comms.message_assistant", {
          instruction: "You are drafting a professional reply. Respond concisely with gratitude, acknowledge the request, and provide next steps.",
          text: sanitized,
        }, ctx);
        if (llmResult.text.trim()) draft = llmResult.text.trim();
      } catch (e: any) {
        logger.warn("ai-message-assistant draft failed", { error: e?.message ?? String(e) });
      }
      const latency = Math.round(performance.now() - t0);
      await logAiCall(adminSupabase, {
        tenant_id: tenantId || null,
        user_id: user.id,
        function_name: "ai-message-assistant",
        model_used: llmResult ? `${llmResult.provider}:${llmResult.model}` : "fallback",
        input_tokens: llmResult?.inputTokens,
        output_tokens: llmResult?.outputTokens,
        total_cost_usd: llmResult?.costUsd,
        latency_ms: latency,
        pii_detected: redacted.length > 0,
        pii_fields_redacted: redacted,
        output_summary: { draft_preview: draft.slice(0, 160) }
      });
      return new Response(JSON.stringify({ draft }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Unsupported action" }), { status: 400, headers: corsHeaders });
  } catch (e: unknown) {
    const error = e as Error;
    logger.error("AI Assistant Error", { error });
    try {
      await logAiCall(adminSupabase, {
        function_name: "ai-message-assistant",
        model_used: "unknown",
        error_message: error.message || String(e),
      });
    } catch {
      // ignore logging errors
    }
    return new Response(JSON.stringify({ error: error.message || "Unhandled" }), { status: 500, headers: corsHeaders });
  }
}, "ai-message-assistant");
