import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";

interface RequestBody {
  message_id: string;
}

serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const admin = getSupabaseAdmin();
    const payload = await req.json() as RequestBody;
    const id = payload.message_id;
    if (!id) return new Response(JSON.stringify({ error: "Missing message_id" }), { status: 400, headers: corsHeaders });
    const { data, error } = await admin.from("messages").select("id, ai_urgency, queue").eq("id", id).single();
    if (error || !data) return new Response(JSON.stringify({ error: "Message not found" }), { status: 404, headers: corsHeaders });
    const urgent = (data.ai_urgency || "").toLowerCase();
    const newQueue = urgent === "critical" ? "Escalations" : urgent === "high" ? "Priority" : data.queue || "Inbox";
    const { error: updErr } = await admin.from("messages").update({ queue: newQueue, updated_at: new Date().toISOString() }).eq("id", id);
    if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: corsHeaders });
    return new Response(JSON.stringify({ queue: newQueue }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unhandled" }), { status: 500, headers: corsHeaders });
  }
});
