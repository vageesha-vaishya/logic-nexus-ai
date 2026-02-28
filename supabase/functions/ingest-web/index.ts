/// <reference path="../types.d.ts" />
import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const tenantHeader = req.headers.get("x-tenant-id");
    const body = await req.json();
    const tenant_id = body.tenant_id || tenantHeader;
    const subject = body.subject || null;
    const text = body.body || body.body_text || "";
    const metadata = body.metadata || body || {};

    logger.info(`Ingesting web message for tenant ${tenant_id}`);

    const { error } = await supabaseAdmin.from("messages").insert({
      tenant_id,
      channel: "web",
      direction: "inbound",
      subject,
      body_text: text,
      metadata,
      has_attachments: false,
      created_by: null,
    });
    if (error) {
        logger.error("Failed to insert web message:", { error });
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ status: "accepted" }), { headers: corsHeaders });
  } catch (e: any) {
    logger.error("Error in ingest-web:", { error: e });
    return new Response(JSON.stringify({ error: e?.message || "Unhandled" }), { status: 500, headers: corsHeaders });
  }
}, "ingest-web");
