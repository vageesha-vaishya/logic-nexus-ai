/// <reference path="../types.d.ts" />
import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

serveWithLogger(async (req, logger, supabase) => {
  const pre = preflight(req);
  if (pre) return pre;
  
  // Require authentication for outbound messages
  const { user, error: authError, supabaseClient } = await requireAuth(req, logger);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const tenant_id = body.tenant_id || req.headers.get("x-tenant-id");
    const in_reply_to = body.in_reply_to_message_id || null;
    const to = body.to || null;
    const text = body.text || body.body_text || "";
    const subject = body.subject || null;

    logger.info(`Queueing outbound web message for tenant ${tenant_id}`);

    // Use user-scoped client for RLS
    const { error } = await supabaseClient.from("messages").insert({
      tenant_id,
      channel: "web",
      direction: "outbound",
      subject,
      body_text: text,
      metadata: { to, in_reply_to },
      has_attachments: false,
      created_by: user.id,
    });
    if (error) {
        logger.error("Failed to queue outbound web message:", { error });
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ status: "queued" }), { headers: corsHeaders });
  } catch (e: any) {
    logger.error("Error in send-web:", { error: e });
    return new Response(JSON.stringify({ error: e?.message || "Unhandled" }), { status: 500, headers: corsHeaders });
  }
}, "send-web");
