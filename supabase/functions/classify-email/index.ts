import { serveWithLogger } from "../_shared/logger.ts";
import { requireAuth } from "../_shared/auth.ts";
import { sanitizeForLLM } from "../_shared/pii-guard.ts";
import { pickClassifier } from "../_shared/model-router.ts";
import { logAiCall } from "../_shared/audit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// @ts-ignore
declare const Deno: any;

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Require authentication
    const { user, error: authError, supabaseClient } = await requireAuth(req, logger);
    if (authError || !user) {
      console.error(`[classify-email] Auth failed: ${authError}`);
      return new Response(JSON.stringify({ error: authError || "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json().catch(() => ({}));
    const emailId = payload?.email_id as string | undefined;
    if (!emailId || typeof emailId !== 'string') {
      return new Response(JSON.stringify({ error: "Missing or invalid email_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: email, error: emailErr } = await supabaseClient
      .from("emails")
      .select("id, subject, body_text, body_html, snippet")
      .eq("id", emailId)
      .single();
    if (emailErr || !email) {
      return new Response(JSON.stringify({ error: "Email not found or not accessible" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawText =
      [email.subject, email.body_text ?? email.snippet ?? ""].filter(Boolean).join("\n\n");
    const { sanitized, redacted } = sanitizeForLLM(rawText);

    const start = performance.now();
    const { url, headers: aiHeaders, model } = pickClassifier("low");
    const prompt = `
Classify the following email into category, sentiment, and intent.
Return a compact JSON object with keys: category, sentiment, intent.
Valid sentiments: positive, neutral, negative.
Valid intents: support, sales, billing, scheduling, general, complaint, escalation.
Category should be one of: crm, operations, compliance, finance, sales, support, logistics.

Email:
${sanitized}
`;
    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }]}],
      generationConfig: { responseMimeType: "application/json" }
    };
    const res = await fetch(url, { method: "POST", headers: aiHeaders, body: JSON.stringify(body) });
    const latency = Math.round(performance.now() - start);
    if (!res.ok) {
      const errText = await res.text();
      // Use injected supabaseAdmin instead of createServiceClient
      await logAiCall(supabaseAdmin, {
        user_id: user.id,
        function_name: "classify-email",
        model_used: model,
        latency_ms: latency,
        pii_detected: redacted.length > 0,
        pii_fields_redacted: redacted,
        error_message: errText
      });
      return new Response(JSON.stringify({ error: "LLM classification failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await res.json();
    const textOut =
      result?.candidates?.[0]?.content?.parts?.[0]?.text ??
      result?.candidates?.[0]?.output_text ??
      "";
    let parsed: { category?: string; sentiment?: string; intent?: string } = {};
    try {
      parsed = JSON.parse(textOut);
    } catch {
      // Fallback: try to extract with simple heuristics
      const lc = String(textOut).toLowerCase();
      parsed.category = /crm|operations|compliance|finance|sales|support|logistics/.exec(lc)?.[0] ?? "crm";
      parsed.sentiment = /positive|neutral|negative/.exec(lc)?.[0] ?? "neutral";
      parsed.intent = /support|sales|billing|scheduling|general|complaint|escalation/.exec(lc)?.[0] ?? "general";
    }

    const category = parsed.category ?? "crm";
    const sentiment = parsed.sentiment ?? "neutral";
    const intent = parsed.intent ?? "general";

    // Use user-scoped client for RLS compliance
    await supabaseClient
      .from("emails")
      .update({
        category,
        ai_sentiment: sentiment,
        intent,
      })
      .eq("id", emailId);
    await logAiCall(supabaseAdmin, {
      user_id: user.id,
      function_name: "classify-email",
      model_used: model,
      latency_ms: latency,
      pii_detected: redacted.length > 0,
      pii_fields_redacted: redacted,
      output_summary: { email_id: emailId, category, sentiment, intent }
    });

    return new Response(JSON.stringify({ category, sentiment, intent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    logger.error("Classify email error", { error: e });
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}, "classify-email");
