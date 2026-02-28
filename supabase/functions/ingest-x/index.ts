/// <reference path="../types.d.ts" />
import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";

serveWithLogger(async (req, logger, supabase) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const tenantId = req.headers.get("x-tenant-id") || "";
    const data = await req.json();
    const text = data.text || data.body || "";
    logger.info(`Ingesting X message for tenant ${tenantId}`);

    const { error } = await supabase.from("messages").insert({
      tenant_id: tenantId,
      channel: "x",
      direction: "inbound",
      subject: null,
      body_text: text,
      metadata: data,
      has_attachments: false,
      created_by: null,
    });
    if (error) {
        logger.error("Failed to insert X message:", { error });
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
    logger.info("Successfully ingested X message");
    return new Response(JSON.stringify({ status: "accepted" }), { headers: corsHeaders });
  } catch (e: any) {
    logger.error("Error in ingest-x:", { error: e });
    return new Response(JSON.stringify({ error: e?.message || "Unhandled" }), { status: 500, headers: corsHeaders });
  }
}, "ingest-x");
