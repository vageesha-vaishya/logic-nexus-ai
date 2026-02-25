import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";
import { sanitizeForLLM } from "../_shared/pii-guard.ts";

declare const Deno: any;

type AutoEmailRequest = { email_id?: string; conversation_id?: string; dry_run?: boolean };

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });
    }
    let payload: AutoEmailRequest | null = null;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });
    let targetEmail: any = null;
    if (payload?.email_id) {
      const { data } = await supabase.from("emails").select("id, subject, body_text, body_html, conversation_id, from_email, to_emails").eq("id", payload.email_id).maybeSingle();
      targetEmail = data;
    } else if (payload?.conversation_id) {
      const { data } = await supabase.from("emails").select("id, subject, body_text, body_html, conversation_id, from_email, to_emails").eq("conversation_id", payload.conversation_id).order("received_at", { ascending: false }).limit(1);
      targetEmail = data?.[0];
    }
    if (!targetEmail) {
      return new Response(JSON.stringify({ error: "Email not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } });
    }
    const text = (targetEmail.body_text || targetEmail.body_html || "").slice(0, 4000);
    const { sanitized } = sanitizeForLLM(text);
    const classifyResp = await fetch(`${supabaseUrl}/functions/v1/classify-email`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify({ text: sanitized }) });
    let label = "general";
    if (classifyResp.ok) {
      const cj = await classifyResp.json();
      label = cj?.label || label;
    }
    const route = label.includes("support") ? "support_queue" : label.includes("sales") ? "sales_queue" : "general_queue";
    const replyResp = await fetch(`${supabaseUrl}/functions/v1/smart-reply`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify({ conversation_id: targetEmail.conversation_id, prompt_hint: "" }) });
    let draft = { subject: "", body: "", tone: "neutral" };
    if (replyResp.ok) {
      const rj = await replyResp.json();
      draft = rj?.draft || draft;
    }
    if (!payload?.dry_run) {
      await supabase.from("emails").update({ ai_routed_to: route, ai_reply_draft: draft }).eq("id", targetEmail.id);
    }
    await logAiCall(supabase as any, { user_id: user.id, function_name: "autonomous-email", model_used: "classifier+reply", output_summary: { route, subject: draft.subject?.slice(0, 60) || "" }, pii_detected: false, pii_fields_redacted: [] });
    return new Response(JSON.stringify({ route, draft }), { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }
});
