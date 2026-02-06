import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

type StatsPayload = {
  tenantId?: string | null;
  accountId?: string | null;
  folder?: string | null;
  includeThreads?: boolean;
};

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    const requireEnv = (name: string) => {
      const v = Deno.env.get(name);
      if (!v) throw new Error(`Missing environment variable: ${name}`);
      return v;
    };

    const authHeader = req.headers.get("Authorization");

    const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authHeader! } },
    });

    let payload: StatsPayload | null;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body", code: "BAD_REQUEST" }),
        { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const { tenantId, accountId, folder, includeThreads = true } = payload || {};

    let base = supabase.from("emails").select("id, folder, is_read, conversation_id, thread_id");
    if (tenantId) base = base.eq("tenant_id", tenantId);
    if (accountId) base = base.eq("account_id", accountId);
    if (folder && folder !== "all_mail") base = base.eq("folder", folder);
    if (folder === "all_mail") base = base.neq("folder", "trash").neq("folder", "spam");

    const { data, error } = await base.limit(1000);
    if (error) {
      throw new Error(`Database query error: ${error.message}`);
    }

    const emails = Array.isArray(data) ? data : [];
    const unreadByFolder: Record<string, number> = {};
    for (const e of emails) {
      const f = e.folder || "inbox";
      unreadByFolder[f] = unreadByFolder[f] || 0;
      if (!e.is_read) unreadByFolder[f] += 1;
    }

    const threadCounts: Record<string, number> = {};
    if (includeThreads) {
      for (const e of emails) {
        const key = e.conversation_id || e.thread_id || e.id;
        threadCounts[key] = (threadCounts[key] || 0) + 1;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        unreadByFolder,
        threadCounts: includeThreads ? threadCounts : undefined,
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
