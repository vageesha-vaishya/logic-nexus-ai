import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";

async function verifySignature(body: string, signatureHeader: string | null) {
  const secret = Deno.env.get("WHATSAPP_APP_SECRET") || "";
  if (!secret || !signatureHeader) return false;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(body);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return signatureHeader.replace("sha256=", "") === sigHex;
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const tenantId = req.headers.get("x-tenant-id") || "";
    const signature = req.headers.get("x-hub-signature-256");
    const raw = await req.text();
    const ok = await verifySignature(raw, signature);
    if (!ok) return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: corsHeaders });
    const payload = JSON.parse(raw);
    const entry = payload?.entry?.[0]?.changes?.[0]?.value;
    const msg = entry?.messages?.[0];
    const bodyText = msg?.text?.body || "";
    const direction = "inbound";
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("messages").insert({
      tenant_id: tenantId,
      channel: "whatsapp",
      direction,
      subject: null,
      body_text: bodyText,
      body_html: null,
      metadata: payload,
      has_attachments: !!(msg?.image || msg?.document || msg?.audio || msg?.video),
      created_by: null,
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    return new Response(JSON.stringify({ status: "accepted" }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unhandled" }), { status: 500, headers: corsHeaders });
  }
});
