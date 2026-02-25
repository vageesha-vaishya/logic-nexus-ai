import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";

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

serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const admin = getSupabaseAdmin();
    const payload = await req.json() as RequestBody;
    const id = payload.message_id;
    if (!id) return new Response(JSON.stringify({ error: "Missing message_id" }), { status: 400, headers: corsHeaders });
    const { data, error } = await admin.from("messages").select("id, subject, body_text, metadata, queue").eq("id", id).single();
    if (error || !data) return new Response(JSON.stringify({ error: "Message not found" }), { status: 404, headers: corsHeaders });
    const text = [data.subject, data.body_text].filter(Boolean).join("\n\n");
    const risky = isRisky(text);
    const newQueue = risky ? "Quarantine" : data.queue || "Inbox";
    const metadata = Object.assign({}, data.metadata || {}, { moderation: { risky, checked_at: new Date().toISOString() }});
    const { error: updErr } = await admin.from("messages").update({ queue: newQueue, metadata, updated_at: new Date().toISOString() }).eq("id", id);
    if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: corsHeaders });
    return new Response(JSON.stringify({ risky, queue: newQueue }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unhandled" }), { status: 500, headers: corsHeaders });
  }
});
