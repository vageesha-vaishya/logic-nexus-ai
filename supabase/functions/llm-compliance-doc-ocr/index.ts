// llm-compliance-doc-ocr — eighth production callsite for the unified
// LLM Gateway, third AMRO LLM feature shipped from master plan §7.4
// Phase 8 LLM features list (#6 compliance doc OCR).
//
// Use case: technician uploads a scanned compliance document (Form
// 8130-3 / EASA Form 1 / SACAA card / signed AD sign-off form).
// LLM extracts structured fields the platform validates against
// the in-flight work-order.
//
// Multi-modal: the document image is passed via the gateway's
// attachment slot. This is the second multi-modal callsite after
// llm-read-defect-photo (commit reference: task #82).

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { Logger } from "../_shared/logger.ts";

// @ts-ignore
declare const Deno: any;

const PROMPT_KEY = "amro.compliance.doc_ocr";
const MAX_INLINE_BASE64 = 8 * 1024 * 1024; // 8 MiB — matches gateway cap

interface DocumentAttachment {
  mime_type: string;
  content_base64?: string;
  url?: string;
  label?: string;
}

interface DocOcrRequest {
  document_context: {
    work_order_id?: string | null;
    work_order_package_number?: string | null;
    directive_id?: string | null;
    aircraft_registration?: string | null;
    issuing_authority_hint?: "FAA" | "EASA" | "CAAC" | "SACAA" | null;
    notes_from_uploader?: string | null;
  };
  attachment: DocumentAttachment;
}

function bad(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({
      error: { code: status === 401 ? "UNAUTHORIZED" : "INVALID_REQUEST", message },
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function parseInputs(raw: unknown): DocOcrRequest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  if (!r.document_context || typeof r.document_context !== "object") {
    return { error: "document_context object required" };
  }
  const att = r.attachment as DocumentAttachment | undefined;
  if (!att || typeof att !== "object") return { error: "attachment required" };
  if (typeof att.mime_type !== "string") return { error: "attachment.mime_type required" };
  if (!att.mime_type.startsWith("image/") && att.mime_type !== "application/pdf") {
    return { error: "attachment.mime_type must be image/* or application/pdf" };
  }
  const hasBase64 = typeof att.content_base64 === "string" && att.content_base64.length > 0;
  const hasUrl = typeof att.url === "string" && att.url.length > 0;
  if (hasBase64 === hasUrl) {
    return { error: "attachment must carry exactly one of content_base64 or url" };
  }
  if (hasBase64 && (att.content_base64 as string).length > MAX_INLINE_BASE64) {
    return { error: `attachment.content_base64 exceeds ${MAX_INLINE_BASE64 / (1024 * 1024)} MiB cap` };
  }
  if (hasUrl && !/^https:\/\//.test(att.url as string)) {
    return { error: "attachment.url must be an https URL" };
  }

  return {
    document_context: r.document_context as DocOcrRequest["document_context"],
    attachment: att,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad("POST only", 405);

  const logger = new Logger("llm-compliance-doc-ocr");

  const { user, error: authErr, supabaseClient } = await requireAuth(req, logger);
  if (authErr || !user) return bad(authErr ?? "auth failed", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("invalid JSON body");
  }
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

  // Subject id prefers work_order_id, falls back to directive_id, then
  // a randomly-tagged "upload" identifier so the gateway can still
  // attribute the invocation to a subject for audit.
  const subjectId =
    parsed.document_context.work_order_id ||
    parsed.document_context.directive_id ||
    `upload-${crypto.randomUUID()}`;

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
      feature: "compliance.doc_ocr",
      prompt_key: PROMPT_KEY,
      variables: {
        document_context: parsed.document_context,
      },
      attachments: [
        {
          kind: parsed.attachment.mime_type === "application/pdf" ? "pdf" : "image",
          mime_type: parsed.attachment.mime_type,
          ...(parsed.attachment.content_base64
            ? { content_base64: parsed.attachment.content_base64 }
            : {}),
          ...(parsed.attachment.url ? { url: parsed.attachment.url } : {}),
          ...(parsed.attachment.label ? { label: parsed.attachment.label } : {}),
        },
      ],
      subject: { type: "amro_compliance_doc_upload", id: subjectId },
      required_capabilities: ["vision", "json_mode"],
    }),
  });

  const gatewayBody = await gatewayRes.json().catch(() => ({}));
  if (!gatewayRes.ok) {
    logger.error("gateway non-2xx", {
      status: gatewayRes.status,
      code: (gatewayBody as { error?: { code?: string } })?.error?.code,
      work_order_id: parsed.document_context.work_order_id,
      directive_id: parsed.document_context.directive_id,
    });
    return new Response(JSON.stringify(gatewayBody), {
      status: gatewayRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = gatewayBody as {
    invocation_id: string;
    output: unknown;
    cost_usd: number;
    latency_ms: number;
    warnings?: string[];
  };
  logger.info("compliance doc ocr completed", {
    user_id: user.id,
    tenant_id: profile.tenant_id,
    work_order_id: parsed.document_context.work_order_id,
    directive_id: parsed.document_context.directive_id,
    aircraft_registration: parsed.document_context.aircraft_registration,
    invocation_id: result.invocation_id,
    cost_usd: result.cost_usd,
    latency_ms: result.latency_ms,
    wall_ms: Date.now() - startedAt,
    attachment_kind: parsed.attachment.content_base64 ? "inline" : "url",
  });

  return new Response(
    JSON.stringify({
      invocation_id: result.invocation_id,
      output: result.output,
      cost_usd: result.cost_usd,
      latency_ms: result.latency_ms,
      warnings: result.warnings,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
