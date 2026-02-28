import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

interface RequestBody {
  message_id: string;
}

const riskyPatterns = [
  /bitcoin|crypto|wire transfer/i,
  /urgent action required/i,
  /password|credential/i,
  /click here to verify/i,
  /invoice attached/i,
];

function isRisky(text: string): boolean {
  return riskyPatterns.some(re => re.test(text));
}

serveWithLogger(async (req, logger, adminSupabase) => {
  const pre = preflight(req);
  if (pre) return pre;
  
  const { user, error: authError, supabaseClient } = await requireAuth(req, logger);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const payload = await req.json() as RequestBody;
    const id = payload.message_id;
    if (!id) return new Response(JSON.stringify({ error: "Missing message_id" }), { status: 400, headers: corsHeaders });
    
    // Use user-scoped client
    const { data, error } = await supabaseClient.from("messages").select("id, subject, body_text, metadata, queue").eq("id", id).single();
    if (error || !data) {
        logger.warn(`Message not found: ${id}`);
        return new Response(JSON.stringify({ error: "Message not found" }), { status: 404, headers: corsHeaders });
    }
    const text = [data.subject, data.body_text].filter(Boolean).join("\n\n");
    const risky = isRisky(text);
    const newQueue = risky ? "Quarantine" : data.queue || "Inbox";
    const metadata = Object.assign({}, data.metadata || {}, { moderation: { risky, checked_at: new Date().toISOString() }});
    const { error: updErr } = await supabaseClient.from("messages").update({ queue: newQueue, metadata, updated_at: new Date().toISOString() }).eq("id", id);
    if (updErr) {
        logger.error(`Failed to update message ${id}:`, { error: updErr });
        return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: corsHeaders });
    }
    logger.info(`Moderated message ${id}: risky=${risky}, queue=${newQueue}`);
    return new Response(JSON.stringify({ risky, queue: newQueue }), { headers: corsHeaders });
  } catch (e: any) {
    logger.error("Error in moderate-message:", { error: e });
    return new Response(JSON.stringify({ error: e?.message || "Unhandled" }), { status: 500, headers: corsHeaders });
  }
}, "moderate-message");
