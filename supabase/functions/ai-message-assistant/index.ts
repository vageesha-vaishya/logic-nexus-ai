import { corsHeaders, preflight } from "../_shared/cors.ts";
import { serveWithLogger } from "../_shared/logger.ts";
import { logAiCall } from "../_shared/audit.ts";
import { requireAuth } from "../_shared/auth.ts";

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

async function callGemini(prompt: string) {
  const key = Deno.env.get("GOOGLE_API_KEY");
  if (!key) return null;
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + key;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }]}],
    generationConfig: { responseMimeType: "text/plain" }
  };
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) return null;
  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? data?.candidates?.[0]?.output_text ?? "";
  return String(out || "").trim();
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
    const { sanitized, redacted } = sanitize(baseText);
    const modelUsed = Deno.env.get("GOOGLE_API_KEY") ? "gemini-2.0-flash" : "fallback";

    if (action === "summarize") {
      const t0 = performance.now();
      const prompt = `Summarize the following customer communication thread in 4 bullet points focusing on intent, urgency, and next steps.\n\n${sanitized}`;
      const ai = await callGemini(prompt);
      const summary = ai || "Summary: Customer message received. Intent unclear. No immediate urgency. Next step: acknowledge and clarify.";
      if (message_id) {
        await supabaseClient.from("messages").update({ ai_summary: summary, updated_at: new Date().toISOString() }).eq("id", message_id);
      }
      const latency = Math.round(performance.now() - t0);
      await logAiCall(adminSupabase, {
        tenant_id: tenantId || null,
        user_id: user.id,
        function_name: "ai-message-assistant",
        model_used: modelUsed,
        latency_ms: latency,
        pii_detected: redacted.length > 0,
        pii_fields_redacted: redacted,
        output_summary: { message_id, summary }
      });
      return new Response(JSON.stringify({ summary }), { headers: corsHeaders });
    }

    if (action === "draft") {
      const t0 = performance.now();
      const prompt = `You are an assistant drafting a professional reply. Respond concisely with gratitude, acknowledge the request, and provide next steps.\n\nOriginal:\n${sanitized}\n\nReply:`;
      const ai = await callGemini(prompt);
      const draft = ai || "Thanks for reaching out. We’ve received your message and will follow up with the next steps shortly.";
      const latency = Math.round(performance.now() - t0);
      await logAiCall(adminSupabase, {
        tenant_id: tenantId || null,
        user_id: user.id,
        function_name: "ai-message-assistant",
        model_used: modelUsed,
        latency_ms: latency,
        pii_detected: redacted.length > 0,
        pii_fields_redacted: redacted,
        output_summary: { draft_preview: draft.slice(0, 160) }
      });
      return new Response(JSON.stringify({ draft }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Unsupported action" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    logger.error("AI Assistant Error", { error: e });
    try {
      await logAiCall(adminSupabase, {
        function_name: "ai-message-assistant",
        model_used: Deno.env.get("GOOGLE_API_KEY") ? "gemini-2.5-flash" : "fallback",
        error_message: e?.message || String(e),
      });
    } catch {}
    return new Response(JSON.stringify({ error: e?.message || "Unhandled" }), { status: 500, headers: corsHeaders });
  }
}, "ai-message-assistant");
