/// <reference path="../types.d.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";

serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const admin = getSupabaseAdmin();
    const body = await req.json();
    const tenant_id = body.tenant_id || req.headers.get("x-tenant-id");
    const to = body.to;
    const text = body.text || body.body_text || "";
    const subject = body.subject || null;
    const { error } = await admin.from("messages").insert({
      tenant_id,
      channel: "whatsapp",
      direction: "outbound",
      subject,
      body_text: text,
      metadata: { to },
      has_attachments: false,
      created_by: null,
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    return new Response(JSON.stringify({ status: "queued" }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unhandled" }), { status: 500, headers: corsHeaders });
  }
});
