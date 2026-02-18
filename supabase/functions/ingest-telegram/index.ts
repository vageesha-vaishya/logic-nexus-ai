/// <reference path="../types.d.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";

serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    const expected = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
    if (!expected || secretHeader !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const admin = getSupabaseAdmin();
    const tenantId = req.headers.get("x-tenant-id") || "";
    const update = await req.json();
    const msg = update.message || update.edited_message || {};
    const text = msg.text || msg.caption || "";
    const { error } = await admin.from("messages").insert({
      tenant_id: tenantId,
      channel: "telegram",
      direction: "inbound",
      subject: null,
      body_text: text,
      metadata: update,
      has_attachments: !!(msg.photo || msg.document || msg.audio || msg.video),
      created_by: null,
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    return new Response(JSON.stringify({ status: "accepted" }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unhandled" }), { status: 500, headers: corsHeaders });
  }
});
