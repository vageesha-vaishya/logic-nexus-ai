import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { sanitizeForLLM } from "../_shared/pii-guard.ts";
import { logAiCall } from "../_shared/audit.ts";

declare const Deno: any;

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

    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const sys = "You are a logistics CRM assistant. Propose a short, professional reply that addresses the thread context and suggests next steps. Avoid PII; keep under 150 words.";
    const userMsg = `Thread:\n<user_context>${sanitized}</user_context>\nHint: ${(payload?.prompt_hint || "").slice(0, 200)}\nOutput JSON:\n{"subject":"...","body":"...","tone":"neutral|friendly|formal"}`;
    let draft = { subject: "", body: "", tone: "neutral" };
    if (openaiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }], temperature: 0.3 }),
      });
      if (res.ok) {
        const json = await res.json();
        try {
          draft = JSON.parse(json.choices[0].message.content);
        } catch { /* ignore */ }
      }
    }

    await logAiCall(supabase, {
      user_id: user.id,
      function_name: "smart-reply",
      model_used: "gpt-4o-mini",
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
