/// <reference path="../types.d.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";

serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const admin = getSupabaseAdmin();
    const tenantHeader = req.headers.get("x-tenant-id");
    const body = await req.json();
    const tenant_id = body.tenant_id || tenantHeader;
    const subject = body.subject || null;
    const text = body.body || body.body_text || "";
    const metadata = body.metadata || body || {};
    const { error } = await admin.from("messages").insert({
      tenant_id,
      channel: "web",
      direction: "inbound",
      subject,
      body_text: text,
      metadata,
      has_attachments: false,
      created_by: null,
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    return new Response(JSON.stringify({ status: "accepted" }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unhandled" }), { status: 500, headers: corsHeaders });
  }
});
