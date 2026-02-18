/// <reference path="../types.d.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";

serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const tenantId = req.headers.get("x-tenant-id") || "";
    const admin = getSupabaseAdmin();
    const data = await req.json();
    const text = data.text || data.body || "";
    const { error } = await admin.from("messages").insert({
      tenant_id: tenantId,
      channel: "linkedin",
      direction: "inbound",
      subject: null,
      body_text: text,
      metadata: data,
      has_attachments: false,
      created_by: null,
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    return new Response(JSON.stringify({ status: "accepted" }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unhandled" }), { status: 500, headers: corsHeaders });
  }
});
