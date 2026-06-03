// llm-admin-list — proxies GET /v1/admin/(prompts|experiments|audit)
// from the unified LLM gateway after a platform-admin role check.
//
// The frontend never holds the gateway service token; this edge fn
// owns it. Caller passes:
//   { kind: 'prompts'|'experiments'|'audit', filters?: {...} }
// We translate to the matching gateway URL and forward the response.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { Logger } from "../_shared/logger.ts";

// @ts-ignore
declare const Deno: any;

type ListKind = "prompts" | "experiments" | "audit" | "budget-status";

interface ListRequest {
  kind: ListKind;
  filters?: Record<string, string | number | undefined>;
}

function bad(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: { code: status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "INVALID_REQUEST", message } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function parseInputs(raw: unknown): ListRequest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  const kind = r.kind as ListKind;
  if (kind !== "prompts" && kind !== "experiments" && kind !== "audit" && kind !== "budget-status") {
    return { error: "kind must be one of: prompts, experiments, audit, budget-status" };
  }
  const filters = (r.filters && typeof r.filters === "object" && !Array.isArray(r.filters))
    ? (r.filters as Record<string, string | number | undefined>)
    : {};
  return { kind, filters };
}

function buildQuery(filters: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad("POST only", 405);

  const logger = new Logger("llm-admin-list");

  const { user, error: authErr, supabaseClient } = await requireAuth(req, logger);
  if (authErr || !user) return bad(authErr ?? "auth failed", 401);

  // Platform-admin role check via user_roles (matches the rest of the app).
  const { data: roles, error: rolesErr } = await supabaseClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (rolesErr) {
    logger.error("role lookup failed", { user_id: user.id, err: rolesErr.message });
    return bad("role lookup failed", 500);
  }
  const isPlatformAdmin = (roles ?? []).some((r: { role: string }) => r.role === "platform_admin");
  if (!isPlatformAdmin) {
    logger.warn("non-admin tried to list gateway admin data", { user_id: user.id });
    return bad("platform_admin role required", 403);
  }

  let body: unknown;
  try { body = await req.json(); } catch { return bad("invalid JSON body"); }
  const parsed = parseInputs(body);
  if ("error" in parsed) return bad(parsed.error);

  const gatewayUrl = Deno.env.get("LLM_GATEWAY_URL");
  if (!gatewayUrl) return bad("gateway not configured", 503);
  const serviceToken = Deno.env.get("LLM_GATEWAY_SERVICE_TOKEN");
  const platformId = Deno.env.get("LLM_GATEWAY_PLATFORM_ID") ?? "logic-nexus-ai";

  const targetPath = `/v1/admin/${parsed.kind}${buildQuery(parsed.filters ?? {})}`;
  const startedAt = Date.now();
  const gatewayRes = await fetch(`${gatewayUrl.replace(/\/$/, "")}${targetPath}`, {
    method: "GET",
    headers: {
      ...(serviceToken ? { Authorization: `Bearer ${serviceToken}` } : {}),
      "X-Platform-Id": platformId,
      "X-Correlation-Id": req.headers.get("x-correlation-id") ?? crypto.randomUUID(),
    },
  });

  const gatewayBody = await gatewayRes.json().catch(() => ({}));
  logger.info("admin-list completed", {
    user_id: user.id,
    kind: parsed.kind,
    status: gatewayRes.status,
    item_count: (gatewayBody as { items?: unknown[] })?.items?.length ?? 0,
    wall_ms: Date.now() - startedAt,
  });

  return new Response(JSON.stringify(gatewayBody), {
    status: gatewayRes.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
