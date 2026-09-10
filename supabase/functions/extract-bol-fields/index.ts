import { serveWithLogger } from "../_shared/logger.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";
import { callLLM, LlmCallContext } from "../_shared/llm-gateway.ts";

type ExtractRequest = {
  url?: string;
  base64?: string;
  mime?: string;
  text_hint?: string; // optional OCR text
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

    let payload: ExtractRequest | null = null;
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

    // Fallback regex parsing from text_hint
    const text = (payload?.text_hint ?? "").toString();
    const fields: Record<string, string | null> = {
      shipper: text.match(/Shipper:\s*(.+)/i)?.[1]?.trim() || null,
      consignee: text.match(/Consignee:\s*(.+)/i)?.[1]?.trim() || null,
      notify_party: text.match(/Notify Party:\s*(.+)/i)?.[1]?.trim() || null,
      booking_no: text.match(/Booking\s*No[:#]\s*(\S+)/i)?.[1]?.trim() || null,
      bl_no: text.match(/(?:B\/L|Bill of Lading)\s*(?:No|#)[:\s]*([A-Z0-9-]+)/i)?.[1]?.trim() || null,
      vessel: text.match(/Vessel[:\s]*([A-Za-z0-9 -]+)/i)?.[1]?.trim() || null,
      voyage: text.match(/Voyage[:\s]*([A-Za-z0-9-]+)/i)?.[1]?.trim() || null,
      port_of_loading: text.match(/Port of Loading[:\s]*([A-Za-z -]+)/i)?.[1]?.trim() || null,
      port_of_discharge: text.match(/Port of Discharge[:\s]*([A-Za-z -]+)/i)?.[1]?.trim() || null,
      marks_numbers: text.match(/Marks & Numbers[:\s]*([\s\S]+?)\n\n/i)?.[1]?.trim() || null,
      description_goods: text.match(/Description of Goods[:\s]*([\s\S]+?)\n\n/i)?.[1]?.trim() || null,
      gross_weight: text.match(/Gross Weight[:\s]*([0-9.,\sA-Za-z]+)/i)?.[1]?.trim() || null,
      measurement: text.match(/Measurement[:\s]*([0-9.,\sA-Za-z]+)/i)?.[1]?.trim() || null,
    };

    // If no text provided, try vision extraction via the shared LLM gateway
    let modelUsed = "regex-fallback";
    if (!text && (payload?.url || payload?.base64)) {
      try {
        const ctx: LlmCallContext = { tenantId, userId: user.id, supabaseAdmin, logger };
        const llmResult = await callLLM("logistics.bol_extract", {}, ctx, {
          image: { url: payload.url, base64: payload.base64, mime: payload.mime },
        });
        const parsed = JSON.parse(llmResult.text.replace(/```json/gi, "").replace(/```/g, "").trim());
        Object.assign(fields, parsed);
        modelUsed = `${llmResult.provider}:${llmResult.model}`;
      } catch (err) {
        logger.error("Failed to extract BOL fields via LLM gateway", { error: err });
      }
    }

    await logAiCall(supabase as any, {
      user_id: user.id,
      function_name: "extract-bol-fields",
      model_used: modelUsed,
      output_summary: { extracted: Object.keys(fields).filter(k => fields[k]).length },
      pii_detected: false,
      pii_fields_redacted: [],
    });

    return new Response(JSON.stringify({ fields }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    logger.error("Extract BOL fields error", { error: e });
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}, "extract-bol-fields");
