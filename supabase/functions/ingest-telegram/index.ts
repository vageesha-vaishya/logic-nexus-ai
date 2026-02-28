/// <reference path="../types.d.ts" />
import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    const expected = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
    if (!expected || secretHeader !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Attempt to get authenticated user if provided, otherwise fallback to admin for ingestion
    // Inbound webhooks usually don't have user JWTs, so we use supabaseAdmin for insertion
    // but we should still check if tenant_id is valid or provided.
    
    const tenantId = req.headers.get("x-tenant-id") || "";
    const update = await req.json();
    const msg = update.message || update.edited_message || {};
    const text = msg.text || msg.caption || "";
    const { error } = await supabaseAdmin.from("messages").insert({
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
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unhandled";
    logger.error("Error processing telegram update:", { error: e as any });
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: corsHeaders });
  }
}, "ingest-telegram");
