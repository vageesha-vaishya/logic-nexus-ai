/// <reference path="../types.d.ts" />
import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const tenantId = req.headers.get("x-tenant-id") || "";
    const data = await req.json();
    const text = data.text || data.body || "";

    logger.info(`Ingesting LinkedIn message for tenant ${tenantId}`);

    const { error } = await supabaseAdmin.from("messages").insert({
      tenant_id: tenantId,
      channel: "linkedin",
      direction: "inbound",
      subject: null,
      body_text: text,
      metadata: data,
      has_attachments: false,
      created_by: null,
    });
    if (error) {
        logger.error("Failed to insert LinkedIn message:", { error });
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ status: "accepted" }), { headers: corsHeaders });
  } catch (e: any) {
    logger.error("Error in ingest-linkedin:", { error: e });
    return new Response(JSON.stringify({ error: e?.message || "Unhandled" }), { status: 500, headers: corsHeaders });
  }
}, "ingest-linkedin");
