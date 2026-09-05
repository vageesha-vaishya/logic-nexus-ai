import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { sanitizeForLLM } from "../_shared/pii-guard.ts";
import { logAiCall } from "../_shared/audit.ts";
import { callLLM, LlmCallContext } from "../_shared/llm-gateway.ts";

type SmartReplyRequest = {
  conversation_id?: string;
  prompt_hint?: string;
  topK?: number;
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

    // Resolve tenant for this caller (needed by the LLM gateway to pick a
    // per-tenant provider config, or fall through to the self-hosted rig).
    // NOTE: this function is called internally by autonomous-email over HTTP
    // with the same user's Authorization header, so this resolves the same
    // way regardless of caller.
    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .not('tenant_id', 'is', null)
      .limit(1);
    const tenantId: string | null = roleRows?.[0]?.tenant_id ?? null;
    if (roleError || !tenantId) {
      logger.warn("Caller has no tenant assignment", { userId: user.id, error: roleError?.message });
      return new Response(JSON.stringify({ error: "No tenant assignment for this user" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    let payload: SmartReplyRequest | null = null;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const topK = Math.min(Math.max(payload?.topK ?? 6, 1), 30);
    const { data: emails, error: emailErr } = await supabase
      .from("emails")
      .select("id, from_email, to_emails, cc_emails, bcc_emails, subject, body_text, body_html, conversation_id, received_at")
      .eq("conversation_id", payload?.conversation_id ?? "")
      .order("received_at", { ascending: false })
      .limit(10);
    if (emailErr) throw emailErr;

    const threadText = (emails || [])
      .map((e: any) => `From: ${e.from_email}\nSubject: ${e.subject}\nBody:\n${(e.body_text || e.body_html || "").slice(0, 2000)}`)
      .join("\n\n---\n\n");
    const { sanitized, redacted } = sanitizeForLLM(threadText);

    // Draft the reply via the shared LLM Gateway (routes to tenant-configured
    // provider, or falls through to the self-hosted vLLM rig — see
    // _shared/llm-gateway.ts). Response shape below is unchanged: callers
    // (notably autonomous-email) expect { draft: { subject, body, tone } }.
    const hint = (payload?.prompt_hint || "").slice(0, 200);
    const ctx: LlmCallContext = { tenantId, userId: user.id, supabaseAdmin, logger };
    let draft = { subject: "", body: "", tone: "neutral" };
    let llmResult: Awaited<ReturnType<typeof callLLM>> | null = null;
    try {
      llmResult = await callLLM("comms.smart_reply", { thread: sanitized, hint }, ctx);
      let parsed: any;
      try {
        parsed = JSON.parse(llmResult.text);
      } catch {
        const stripped = llmResult.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
        parsed = JSON.parse(stripped);
      }
      draft = {
        subject: parsed?.subject ?? "",
        body: parsed?.body ?? "",
        tone: parsed?.tone ?? "neutral",
      };
    } catch (e: any) {
      logger.warn("smart-reply generation failed", { error: e?.message ?? String(e) });
    }

    await logAiCall(supabase, {
      tenant_id: tenantId,
      user_id: user.id,
      function_name: "smart-reply",
      model_used: llmResult ? `${llmResult.provider}:${llmResult.model}` : "none",
      input_tokens: llmResult?.inputTokens,
      output_tokens: llmResult?.outputTokens,
      total_cost_usd: llmResult?.costUsd,
      output_summary: { subject: draft.subject?.slice(0, 80) || "", tone: draft.tone || "neutral" },
      pii_detected: redacted.length > 0,
      pii_fields_redacted: redacted,
    });

    return new Response(JSON.stringify({ draft }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    logger.error("Error in smart-reply", { error: e });
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}, "smart-reply");
