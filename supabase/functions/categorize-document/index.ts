import { serveWithLogger } from "../_shared/logger.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";
import { callLLM, LlmCallContext } from "../_shared/llm-gateway.ts";

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

    const supabase = supabaseClient;

    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .not("tenant_id", "is", null)
      .limit(1);
    const tenantId: string | null = roleRows?.[0]?.tenant_id ?? null;

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

    let modelUsed = "heuristics";
    if (!category || category === "unknown") {
      if (payload?.url || payload?.base64) {
        try {
          const ctx: LlmCallContext = { tenantId, userId: user.id, supabaseAdmin, logger };
          const llmResult = await callLLM("logistics.document_categorize", {}, ctx, {
            image: { url: payload.url, base64: payload.base64, mime: payload.mime },
          });
          const parsed = JSON.parse(llmResult.text.replace(/```json/gi, "").replace(/```/g, "").trim());
          category = parsed.category || "unknown";
          confidence = Number(parsed.confidence ?? 0.6);
          modelUsed = `${llmResult.provider}:${llmResult.model}`;
        } catch (err) {
          logger.error("Failed to categorize document via LLM gateway", { error: err });
        }
      }
    }

    await logAiCall(supabase as any, {
      user_id: user.id,
      function_name: "categorize-document",
      model_used: modelUsed,
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
