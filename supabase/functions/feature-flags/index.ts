//
// Public GET resolve (wraps platform.resolve_flags) + admin-gated POST
// list/upsert against platform.feature_flags. See
// docs/superpowers/specs/2026-09-15-feature-flags-read-path-fix-design.md.
import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

const MAX_KEYS = 50;

function json(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serveWithLogger(async (req, logger, supabase) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const keysParam = url.searchParams.get("keys");
      if (!keysParam) {
        return json({ error: "Missing 'keys' query parameter" }, 400, corsHeaders);
      }
      const keys = keysParam.split(",").map((k) => k.trim()).filter(Boolean);
      if (keys.length === 0) {
        return json({ error: "Missing 'keys' query parameter" }, 400, corsHeaders);
      }
      if (keys.length > MAX_KEYS) {
        return json({ error: `Too many keys (max ${MAX_KEYS})` }, 400, corsHeaders);
      }

      const tenantId = url.searchParams.get("tenant_id");
      const userId = url.searchParams.get("user_id");

      const { data, error } = await supabase.schema("platform").rpc("resolve_flags", {
        p_keys: keys,
        p_tenant_id: tenantId,
        p_user_id: userId,
        p_franchise_id: null,
      });

      if (error) {
        logger.error("resolve_flags failed", { error: error.message });
        return json({ error: error.message }, 500, corsHeaders);
      }

      return json({ data: { flags: data ?? {} } }, 200, corsHeaders);
    }

    if (req.method === "POST") {
      const { user, error: authError } = await requireAuth(req);
      if (authError || !user) {
        return json({ error: "Unauthorized" }, 401, corsHeaders);
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "platform_admin")
        .maybeSingle();
      if (!roleData) {
        return json({ ok: false, error: "Forbidden: platform_admin required" }, 403, corsHeaders);
      }

      const body = await req.json();
      const action = body?.action;

      if (action === "list") {
        const { data, error } = await supabase
          .from("feature_flags")
          .select("id, key, name, description, enabled, rollout_pct, tags, updated_at")
          .order("key");
        if (error) {
          logger.error("list failed", { error: error.message });
          return json({ ok: false, error: error.message }, 500, corsHeaders);
        }
        return json({ ok: true, data: { flags: data ?? [] } }, 200, corsHeaders);
      }

      if (action === "upsert") {
        const key = body?.key;
        const name = body?.name;
        const enabled = body?.enabled;
        if (!key || typeof name !== "string" || typeof enabled !== "boolean") {
          return json({ ok: false, error: "Invalid payload" }, 400, corsHeaders);
        }
        const { data, error } = await supabase
          .from("feature_flags")
          .update({ name, enabled })
          .eq("key", key)
          .select("id, key, name, description, enabled, rollout_pct, tags, updated_at")
          .single();
        if (error) {
          if (error.code === "PGRST116") {
            return json({ ok: false, error: `Unknown flag key: ${key}` }, 404, corsHeaders);
          }
          logger.error("upsert failed", { error: error.message });
          return json({ ok: false, error: error.message }, 500, corsHeaders);
        }
        if (!data) {
          return json({ ok: false, error: `Unknown flag key: ${key}` }, 404, corsHeaders);
        }
        return json({ ok: true, data: { flag: data } }, 200, corsHeaders);
      }

      return json({ ok: false, error: `Unrecognized action: ${action}` }, 400, corsHeaders);
    }

    return json({ error: "Method not allowed" }, 405, corsHeaders);
  } catch (error: any) {
    logger.error("Unhandled error", { error: error?.message ?? String(error) });
    return json({ error: error?.message ?? "Internal Server Error" }, 500, corsHeaders);
  }
}, "feature-flags");
