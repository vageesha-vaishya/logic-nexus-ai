// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// markets-llm-config — CRUD for platform.llm_provider_configs.
//
// Endpoints:
//   GET    /markets-llm-config                       → list configs for x-tenant-id
//   POST   /markets-llm-config                       → create (stores api_key in vault)
//          body: { provider, display_name, default_model, api_key, base_url?, is_default? }
//   PATCH  /markets-llm-config?id=<uuid>             → update non-secret fields + optionally rotate api_key
//          body: { display_name?, default_model?, base_url?, is_active?, is_default?, api_key? }
//   DELETE /markets-llm-config?id=<uuid>             → soft delete (is_active=false) + vault key deletion
//
// Auth: tenant_admin / franchise_admin / platform_admin.
// API keys: stored in supabase_vault, never returned to the client.

import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

declare const Deno: any;

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

type LlmProvider = "anthropic" | "openai" | "gemini" | "openrouter" | "local-qwen" | "custom";
const VALID_PROVIDERS: LlmProvider[] = ["anthropic","openai","gemini","openrouter","local-qwen","custom"];

interface CreateBody {
  provider: LlmProvider;
  display_name: string;
  default_model: string;
  api_key: string;
  base_url?: string;
  is_default?: boolean;
}

interface PatchBody {
  display_name?: string;
  default_model?: string;
  base_url?: string | null;
  is_active?: boolean;
  is_default?: boolean;
  api_key?: string;   // optional rotation
}

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    // 1. Auth — must be an admin
    const { user, error: authError } = await requireAuth(req, logger);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: authError ?? "Unauthorized" }),
        { status: 401, headers: jsonHeaders },
      );
    }
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "Missing x-tenant-id header" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // Check admin role for this tenant.
    const { data: roles } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", user.id);

    const allowed = (roles ?? []).some(
      (r: any) =>
        (r.tenant_id === tenantId &&
          ["tenant_admin", "franchise_admin"].includes(String(r.role))) ||
        String(r.role) === "platform_admin",
    );
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Forbidden — admin role required for this tenant" }),
        { status: 403, headers: jsonHeaders },
      );
    }

    const url = new URL(req.url);
    const configId = url.searchParams.get("id");

    // ───────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const { data, error } = await (supabaseAdmin as any)
        .schema("platform")
        .from("llm_provider_configs")
        .select(
          "id, tenant_id, provider, display_name, base_url, default_model, is_active, is_default, created_at, updated_at, last_used_at",
        )
        .eq("tenant_id", tenantId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("list configs failed", { error: error.message });
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: jsonHeaders },
        );
      }
      return new Response(JSON.stringify({ data: data ?? [] }), { headers: jsonHeaders });
    }

    // ───────────────────────────────────────────────────────────────
    if (req.method === "POST") {
      let body: CreateBody;
      try { body = await req.json(); } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: jsonHeaders });
      }
      const err = validateCreate(body);
      if (err) return new Response(JSON.stringify({ error: err }), { status: 400, headers: jsonHeaders });

      // 1. Store the api_key in vault with a deterministic name.
      // The vault schema is not exposed via PostgREST (would be a security hole),
      // so we call a SECURITY DEFINER wrapper in the platform schema instead.
      const vaultSecretName = `tenant_${tenantId}_${body.provider}_${slug(body.display_name)}_${Date.now().toString(36)}`;
      const { error: vaultErr } = await (supabaseAdmin as any).schema("platform").rpc("create_vault_secret", {
        p_secret: body.api_key,
        p_name: vaultSecretName,
        p_description: `LLM API key for tenant ${tenantId} / ${body.provider} (${body.display_name})`,
      });
      if (vaultErr) {
        logger.error("vault.create_secret failed", { error: vaultErr.message });
        return new Response(
          JSON.stringify({ error: `vault: ${vaultErr.message}` }),
          { status: 500, headers: jsonHeaders },
        );
      }

      // 2. Insert the config row.
      const insertPayload = {
        tenant_id: tenantId,
        provider: body.provider,
        display_name: body.display_name.trim().slice(0, 100),
        base_url: body.base_url?.trim() || null,
        default_model: body.default_model.trim(),
        vault_secret_name: vaultSecretName,
        is_default: Boolean(body.is_default),
        created_by: user.id,
      };
      const { data: created, error: insertErr } = await (supabaseAdmin as any)
        .schema("platform")
        .from("llm_provider_configs")
        .insert(insertPayload)
        .select("id, provider, display_name, base_url, default_model, is_active, is_default, created_at")
        .single();

      if (insertErr) {
        logger.error("insert config failed", { error: insertErr.message });
        // Best-effort vault cleanup so we don't leak orphan secrets.
        try { await deleteVaultSecret(supabaseAdmin, vaultSecretName); } catch { /* ignore */ }
        return new Response(
          JSON.stringify({ error: insertErr.message }),
          { status: 400, headers: jsonHeaders },
        );
      }
      return new Response(JSON.stringify({ data: created }), { status: 201, headers: jsonHeaders });
    }

    // ───────────────────────────────────────────────────────────────
    if (req.method === "PATCH") {
      if (!configId) {
        return new Response(JSON.stringify({ error: "?id=<uuid> is required" }), { status: 400, headers: jsonHeaders });
      }
      let body: PatchBody;
      try { body = await req.json(); } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: jsonHeaders });
      }

      // Load the existing row (need vault_secret_name in case we rotate).
      const { data: existing, error: getErr } = await (supabaseAdmin as any)
        .schema("platform")
        .from("llm_provider_configs")
        .select("id, tenant_id, vault_secret_name")
        .eq("id", configId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (getErr || !existing) {
        return new Response(JSON.stringify({ error: "Config not found" }), { status: 404, headers: jsonHeaders });
      }

      // Optional key rotation: replace the existing vault secret.
      if (typeof body.api_key === "string" && body.api_key.length > 0) {
        try {
          // Vault doesn't expose UPDATE by name from the public API in all setups;
          // safer to delete-then-recreate under the same name.
          await deleteVaultSecret(supabaseAdmin, existing.vault_secret_name);
        } catch { /* may not exist; fall through */ }
        const { error: vaultErr } = await (supabaseAdmin as any).schema("platform").rpc("create_vault_secret", {
          p_secret: body.api_key,
          p_name: existing.vault_secret_name,
          p_description: `Rotated ${new Date().toISOString()}`,
        });
        if (vaultErr) {
          logger.error("vault key rotation failed", { error: vaultErr.message });
          return new Response(JSON.stringify({ error: `vault: ${vaultErr.message}` }), { status: 500, headers: jsonHeaders });
        }
      }

      const updates: any = {};
      if (typeof body.display_name === "string") updates.display_name = body.display_name.trim().slice(0, 100);
      if (typeof body.default_model === "string") updates.default_model = body.default_model.trim();
      if (body.base_url !== undefined) updates.base_url = body.base_url?.toString().trim() || null;
      if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
      if (typeof body.is_default === "boolean") updates.is_default = body.is_default;

      let updated = null;
      if (Object.keys(updates).length > 0) {
        const { data, error: updErr } = await (supabaseAdmin as any)
          .schema("platform")
          .from("llm_provider_configs")
          .update(updates)
          .eq("id", configId)
          .eq("tenant_id", tenantId)
          .select("id, provider, display_name, base_url, default_model, is_active, is_default, updated_at, last_used_at")
          .single();
        if (updErr) {
          logger.error("update config failed", { error: updErr.message });
          return new Response(JSON.stringify({ error: updErr.message }), { status: 400, headers: jsonHeaders });
        }
        updated = data;
      } else if (typeof body.api_key === "string") {
        // Only key rotation occurred — return the row as-is.
        const { data } = await (supabaseAdmin as any)
          .schema("platform")
          .from("llm_provider_configs")
          .select("id, provider, display_name, base_url, default_model, is_active, is_default, updated_at, last_used_at")
          .eq("id", configId)
          .single();
        updated = data;
      }
      return new Response(JSON.stringify({ data: updated }), { headers: jsonHeaders });
    }

    // ───────────────────────────────────────────────────────────────
    if (req.method === "DELETE") {
      if (!configId) {
        return new Response(JSON.stringify({ error: "?id=<uuid> is required" }), { status: 400, headers: jsonHeaders });
      }
      const { data: existing } = await (supabaseAdmin as any)
        .schema("platform")
        .from("llm_provider_configs")
        .select("id, vault_secret_name")
        .eq("id", configId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!existing) {
        return new Response(JSON.stringify({ error: "Config not found" }), { status: 404, headers: jsonHeaders });
      }

      const { error: delErr } = await (supabaseAdmin as any)
        .schema("platform")
        .from("llm_provider_configs")
        .delete()
        .eq("id", configId)
        .eq("tenant_id", tenantId);
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), { status: 400, headers: jsonHeaders });
      }

      try { await deleteVaultSecret(supabaseAdmin, existing.vault_secret_name); } catch { /* tolerate */ }
      return new Response(JSON.stringify({ data: { id: configId, deleted: true } }), { headers: jsonHeaders });
    }

    return new Response(
      JSON.stringify({ error: `Method ${req.method} not allowed` }),
      { status: 405, headers: { ...jsonHeaders, Allow: "GET, POST, PATCH, DELETE, OPTIONS" } },
    );
  } catch (e: any) {
    logger.error("markets-llm-config unhandled", { error: e?.message ?? String(e) });
    return new Response(
      JSON.stringify({ error: e?.message ?? "Internal server error" }),
      { status: 500, headers: jsonHeaders },
    );
  }
}, "markets-llm-config");

function validateCreate(b: CreateBody): string | null {
  if (!b || typeof b !== "object") return "Body must be an object";
  if (!VALID_PROVIDERS.includes(b.provider)) return `provider must be one of ${VALID_PROVIDERS.join(", ")}`;
  if (typeof b.display_name !== "string" || !b.display_name.trim()) return "display_name is required";
  if (typeof b.default_model !== "string" || !b.default_model.trim()) return "default_model is required";
  if (typeof b.api_key !== "string" || b.api_key.trim().length < 8) return "api_key is required (min 8 chars)";
  if (b.base_url !== undefined && b.base_url !== null && typeof b.base_url !== "string") return "base_url must be a string";
  return null;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "config";
}

async function deleteVaultSecret(supabaseAdmin: any, name: string): Promise<void> {
  await supabaseAdmin
    .schema("platform")
    .rpc("delete_vault_secret", { p_name: name });
}
