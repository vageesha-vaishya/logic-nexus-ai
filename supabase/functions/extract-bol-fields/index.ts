import { serveWithLogger } from "../_shared/logger.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";

declare const Deno: any;

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

    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const supabase = supabaseClient;

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

    // If no text provided and key exists, try GPT-4o Vision to extract
    if (!text && openaiKey && (payload?.url || payload?.base64)) {
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
              { role: "system", content: "Extract structured BOL fields. Reply JSON with keys: shipper, consignee, notify_party, booking_no, bl_no, vessel, voyage, port_of_loading, port_of_discharge, marks_numbers, description_goods, gross_weight, measurement." },
              { role: "user", content: [{ type: "text", text: "Extract all BOL fields as JSON." }, imageContent] }
            ],
            temperature: 0.0,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          try {
            const parsed = JSON.parse(json.choices[0].message.content);
            Object.assign(fields, parsed);
          } catch { /* ignore */ }
        } else {
          logger.error(`OpenAI API error: ${res.status} ${res.statusText}`);
        }
      } catch (err) {
        logger.error("Failed to call OpenAI", { error: err });
      }
    }

    await logAiCall(supabase as any, {
      user_id: user.id,
      function_name: "extract-bol-fields",
      model_used: openaiKey ? "gpt-4o-vision" : "regex-fallback",
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
