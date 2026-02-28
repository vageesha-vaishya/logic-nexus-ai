import { serveWithLogger } from "../_shared/logger.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";

declare const Deno: any;

type CategorizeRequest = {
  url?: string;
  base64?: string;
  mime?: string;
  text_hint?: string; // optional pre-OCR text
};

serveWithLogger(async (req, logger, supabaseAdmin) => {
  try {
    const { user, error: authError, supabaseClient } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let payload: CategorizeRequest | null = null;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const supabase = supabaseClient;

    let category = "unknown";
    let confidence = 0.5;

    const hint = (payload?.text_hint ?? "").toLowerCase();
    const filenameHint = (payload?.url ?? "").toLowerCase();

    const heuristics = [
      { match: ["bill of lading", "b/l", "bol"], cat: "bill_of_lading" },
      { match: ["invoice"], cat: "invoice" },
      { match: ["packing list", "packlist"], cat: "packing_list" },
      { match: ["delivery order"], cat: "delivery_order" },
      { match: ["certificate"], cat: "certificate" },
    ];
    for (const h of heuristics) {
      if (h.match.some(m => hint.includes(m) || filenameHint.includes(m))) {
        category = h.cat;
        confidence = 0.8;
        break;
      }
    }

    if (!category || category === "unknown") {
      if (openaiKey && (payload?.url || payload?.base64)) {
        const imageContent = payload?.url
          ? { type: "image_url", image_url: { url: payload.url } }
          : { type: "image_url", image_url: { url: `data:${payload?.mime || "application/octet-stream"};base64,${payload?.base64}` } };
        
        try {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [
                { role: "system", content: "Classify the logistics document type. Choose one of: bill_of_lading, invoice, packing_list, delivery_order, certificate, other." },
                { role: "user", content: [{ type: "text", text: "What document type is this? Reply with JSON: {\"category\":\"...\",\"confidence\":0-1}" }, imageContent] }
              ],
              temperature: 0.0,
            }),
          });
          if (res.ok) {
            const json = await res.json();
            try {
              const parsed = JSON.parse(json.choices[0].message.content);
              category = parsed.category || "unknown";
              confidence = Number(parsed.confidence ?? 0.6);
            } catch { /* ignore */ }
          } else {
            logger.error(`OpenAI API error: ${res.status} ${res.statusText}`);
          }
        } catch (err) {
          logger.error("Failed to call OpenAI", { error: err });
        }
      }
    }

    await logAiCall(supabase as any, {
      user_id: user.id,
      function_name: "categorize-document",
      model_used: openaiKey ? "gpt-4o-vision" : "heuristics",
      output_summary: { category, confidence },
      pii_detected: false,
      pii_fields_redacted: [],
    });

    return new Response(JSON.stringify({ category, confidence }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    logger.error("Categorize document error", { error: e });
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}, "categorize-document");
