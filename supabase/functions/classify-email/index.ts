import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, createServiceClient } from "../_shared/auth.ts";
import { sanitizeForLLM } from "../_shared/pii-guard.ts";
import { pickClassifier } from "../_shared/model-router.ts";
import { logAiCall } from "../_shared/audit.ts";

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Require authentication
    const { user, error: authError, supabaseClient } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json().catch(() => ({}));
    const emailId = payload?.email_id as string | undefined;
    if (!emailId || typeof emailId !== 'string') {
      return new Response(JSON.stringify({ error: "Missing or invalid email_id" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
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
        headers: { ...headers, "Content-Type": "application/json" },
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
      const admin = createServiceClient();
      await logAiCall(admin, {
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
        headers: { ...headers, "Content-Type": "application/json" },
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

    const admin = createServiceClient();
    await admin
      .from("emails")
      .update({
        category,
        ai_sentiment: sentiment,
        intent,
      })
      .eq("id", emailId);
    await logAiCall(admin, {
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
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as any)?.message || String(e) }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
