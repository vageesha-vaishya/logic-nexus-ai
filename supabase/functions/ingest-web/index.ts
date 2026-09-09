// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />
import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    // Inbound webhook, not a user request — no Supabase JWT to check (this
    // function imported requireAuth but never called it, leaving it fully
    // open to anonymous callers). Mirrors ingest-telegram's shared-secret
    // gate. Does NOT stop tenant_id spoofing by a holder of this secret —
    // that's a pre-existing gap shared by the whole ingest-* family and is
    // not fixed here.
    const secretHeader = req.headers.get("x-web-webhook-secret");
    const expected = Deno.env.get("WEB_WEBHOOK_SECRET") || "";
    if (!expected || secretHeader !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

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
