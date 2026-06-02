// llm-read-defect-photo — fourth production callsite for the unified
// LLM gateway and the first caller of the §9.4 multi-modal/vision path.
// Used by AmroNonScheduledTaskPanel's "Read defect from photo" button.
//
// Inputs: aircraft_id, task_source, optional notes, plus a single image
// attachment as inline base64 (or a remote URL). Output: gateway-rendered
// amro.defect.photo_read prompt response — structured defect fields the
// UI can pre-fill on the create-task form.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { Logger } from "../_shared/logger.ts";

// @ts-ignore
declare const Deno: any;

const PROMPT_KEY = "amro.defect.photo_read";
const MAX_INLINE_BASE64 = 8 * 1024 * 1024; // 8 MiB — matches gateway cap

interface PhotoAttachment {
  mime_type: string;
  content_base64?: string;
  url?: string;
  label?: string;
}
interface ReadDefectPhotoRequest {
  task_draft_id?: string;
  aircraft_id: string;
  task_source: string;
  notes?: string;
  photo: PhotoAttachment;
}

function bad(message: string, status = 400, details?: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({ error: { code: status === 401 ? "UNAUTHORIZED" : "INVALID_REQUEST", message, details } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function parseInputs(raw: unknown): ReadDefectPhotoRequest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  const aircraft_id = typeof r.aircraft_id === "string" ? r.aircraft_id.trim() : "";
  const task_source = typeof r.task_source === "string" ? r.task_source.trim() : "";
  if (!aircraft_id) return { error: "aircraft_id required" };
  if (!task_source) return { error: "task_source required" };

  const p = r.photo as PhotoAttachment | undefined;
  if (!p || typeof p !== "object") return { error: "photo required" };
  if (typeof p.mime_type !== "string" || !p.mime_type.startsWith("image/")) {
    return { error: "photo.mime_type must be an image/* media type" };
  }
  const hasBase64 = typeof p.content_base64 === "string" && p.content_base64.length > 0;
  const hasUrl = typeof p.url === "string" && p.url.length > 0;
  if (hasBase64 === hasUrl) {
    return { error: "photo must carry exactly one of content_base64 or url" };
  }
  if (hasBase64 && (p.content_base64 as string).length > MAX_INLINE_BASE64) {
    return { error: `photo.content_base64 exceeds ${MAX_INLINE_BASE64 / (1024 * 1024)} MiB cap` };
  }
  if (hasUrl && !/^https:\/\//.test(p.url as string)) {
    return { error: "photo.url must be an https URL" };
  }

  const notes = typeof r.notes === "string" ? r.notes.slice(0, 2000) : undefined;
  const task_draft_id = typeof r.task_draft_id === "string" ? r.task_draft_id : undefined;

  return { task_draft_id, aircraft_id, task_source, notes, photo: p };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad("POST only", 405);

  const logger = new Logger("llm-read-defect-photo");

  const { user, error: authErr, supabaseClient } = await requireAuth(req, logger);
  if (authErr || !user) return bad(authErr ?? "auth failed", 401);

  let body: unknown;
  try { body = await req.json(); } catch { return bad("invalid JSON body"); }
  const parsed = parseInputs(body);
  if ("error" in parsed) return bad(parsed.error);

  const { data: profile, error: profileErr } = await supabaseClient
    .from("user_roles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (profileErr || !profile?.tenant_id) {
    logger.error("tenant lookup failed", { user_id: user.id, err: profileErr?.message });
    return bad("tenant context not found", 403);
  }

  const gatewayUrl = Deno.env.get("LLM_GATEWAY_URL");
  if (!gatewayUrl) return bad("gateway not configured", 503);
  const serviceToken = Deno.env.get("LLM_GATEWAY_SERVICE_TOKEN");
  const platformId = Deno.env.get("LLM_GATEWAY_PLATFORM_ID") ?? "logic-nexus-ai";

  const startedAt = Date.now();
  const gatewayRes = await fetch(`${gatewayUrl.replace(/\/$/, "")}/v1/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(serviceToken ? { Authorization: `Bearer ${serviceToken}` } : {}),
      "X-Platform-Id": platformId,
      "X-Correlation-Id": req.headers.get("x-correlation-id") ?? crypto.randomUUID(),
    },
    body: JSON.stringify({
      tenant_id: profile.tenant_id,
      module: "amro",
      feature: "defect.photo_read",
      prompt_key: PROMPT_KEY,
      variables: {
        aircraft_id: parsed.aircraft_id,
        task_source: parsed.task_source,
        notes: parsed.notes ?? "(none)",
      },
      attachments: [{
        kind: "image",
        mime_type: parsed.photo.mime_type,
        ...(parsed.photo.content_base64 ? { content_base64: parsed.photo.content_base64 } : {}),
        ...(parsed.photo.url ? { url: parsed.photo.url } : {}),
        ...(parsed.photo.label ? { label: parsed.photo.label } : {}),
      }],
      subject: parsed.task_draft_id
        ? { type: "amro_task_draft", id: parsed.task_draft_id }
        : { type: "amro_aircraft", id: parsed.aircraft_id },
      required_capabilities: ["vision", "json_mode"],
    }),
  });

  const gatewayBody = await gatewayRes.json().catch(() => ({}));
  if (!gatewayRes.ok) {
    logger.error("gateway non-2xx", {
      status: gatewayRes.status,
      code: (gatewayBody as { error?: { code?: string } })?.error?.code,
      aircraft_id: parsed.aircraft_id,
    });
    return new Response(JSON.stringify(gatewayBody), {
      status: gatewayRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = gatewayBody as {
    invocation_id: string; output: unknown; cost_usd: number; latency_ms: number; warnings?: string[];
  };
  logger.info("read-defect-photo completed", {
    user_id: user.id,
    tenant_id: profile.tenant_id,
    aircraft_id: parsed.aircraft_id,
    invocation_id: result.invocation_id,
    cost_usd: result.cost_usd,
    latency_ms: result.latency_ms,
    wall_ms: Date.now() - startedAt,
    photo_kind: parsed.photo.content_base64 ? "inline" : "url",
  });

  return new Response(
    JSON.stringify({
      aircraft_id: parsed.aircraft_id,
      invocation_id: result.invocation_id,
      output: result.output,
      cost_usd: result.cost_usd,
      latency_ms: result.latency_ms,
      warnings: result.warnings,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
