import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

interface RequestBody {
  message_id: string;
}

serveWithLogger(async (req, logger, adminSupabase) => {
  const pre = preflight(req);
  if (pre) return pre;
  
  // Auth check
  const { user, error: authError, supabaseClient } = await requireAuth(req, logger);
  if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const payload = await req.json() as RequestBody;
    const id = payload.message_id;
    if (!id) return new Response(JSON.stringify({ error: "Missing message_id" }), { status: 400, headers: corsHeaders });
    
    // Use user-scoped client
    const { data, error } = await supabaseClient.from("messages").select("id, ai_urgency, queue").eq("id", id).single();
    if (error || !data) return new Response(JSON.stringify({ error: "Message not found" }), { status: 404, headers: corsHeaders });
    
    const urgent = (data.ai_urgency || "").toLowerCase();
    const newQueue = urgent === "critical" ? "Escalations" : urgent === "high" ? "Priority" : data.queue || "Inbox";
    
    const { error: updErr } = await supabaseClient.from("messages").update({ queue: newQueue, updated_at: new Date().toISOString() }).eq("id", id);
    if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: corsHeaders });
    
    return new Response(JSON.stringify({ queue: newQueue }), { headers: corsHeaders });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unhandled";
    logger.error("Error escalating message:", { error: e as any });
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: corsHeaders });
  }
}, "escalate-message");
