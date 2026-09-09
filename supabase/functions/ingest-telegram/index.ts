// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />
import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    const tenantId = req.headers.get("x-tenant-id") || "";

    // Inbound webhook, not a user request -- no Supabase JWT to check.
    // Previously verified against one global TELEGRAM_WEBHOOK_SECRET, which
    // proves "this came from Telegram" but not "this came from the right
    // tenant's Telegram bot" -- any holder of that one secret could set
    // x-tenant-id to an arbitrary tenant and inject messages into their
    // inbox. Fixed by verifying the presented secret against *that
    // tenant's own* stored webhook_secret in channel_accounts instead:
    // each tenant's bot is configured (via Telegram's setWebhook API) with
    // its own secret_token, so knowing one tenant's secret no longer lets
    // you impersonate another. (TELEGRAM_WEBHOOK_SECRET itself is unset in
    // production -- the old check failed closed for every caller; this
    // isn't a regression for anyone currently relying on it.)
    if (!secretHeader || !tenantId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: channelAccounts, error: channelError } = await supabaseAdmin
      .from("channel_accounts")
      .select("credentials")
      .eq("tenant_id", tenantId)
      .eq("provider", "telegram")
      .eq("is_active", true);

    if (channelError) {
      logger.error("Failed to resolve telegram channel account", { error: channelError, tenantId });
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const isValidSecret = (channelAccounts || []).some(
      (row: any) => row?.credentials?.webhook_secret && row.credentials.webhook_secret === secretHeader,
    );
    if (!isValidSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

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
