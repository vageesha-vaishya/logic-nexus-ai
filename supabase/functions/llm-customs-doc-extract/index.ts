// llm-customs-doc-extract — ninth production callsite for the unified
// LLM Gateway, first logistics LLM feature. Master plan §7.4 Phase 10
// Tier-1 feature: customs document extraction (Bill of Lading,
// Commercial Invoice, Certificate of Origin, Packing List, etc).
//
// Multi-modal: the document image / PDF is passed via the gateway's
// attachment slot. Same plumbing as llm-compliance-doc-ocr; the
// difference is the prompt + schema (logistics shape, not aviation).
//
// Output drives an automated freight-document evidence chain: the
// extracted fields validate against the matching shipment record
// and pass through to customs / accounting downstream.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { Logger } from "../_shared/logger.ts";

// @ts-ignore
declare const Deno: any;

const PROMPT_KEY = "logistics.customs.doc_extract";
const MAX_INLINE_BASE64 = 8 * 1024 * 1024; // 8 MiB — matches gateway cap

interface DocumentAttachment {
  mime_type: string;
  content_base64?: string;
  url?: string;
  label?: string;
}

interface CustomsExtractRequest {
  shipment_context: {
    shipment_id?: string | null;
    booking_reference?: string | null;
    origin_country?: string | null;
    destination_country?: string | null;
    mode?: string | null;
    incoterm_hint?: string | null;
    currency_hint?: string | null;
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

function parseInputs(raw: unknown): CustomsExtractRequest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  if (!r.shipment_context || typeof r.shipment_context !== "object") {
    return { error: "shipment_context object required (can have all-null fields)" };
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
    shipment_context: r.shipment_context as CustomsExtractRequest["shipment_context"],
    attachment: att,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad("POST only", 405);

  const logger = new Logger("llm-customs-doc-extract");

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

  // Subject id prefers shipment_id, then booking_reference, then a
  // generated upload identifier so the gateway can still attribute
  // the invocation to a subject in the audit log.
  const subjectId =
    parsed.shipment_context.shipment_id ||
    parsed.shipment_context.booking_reference ||
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
      module: "logistics",
      feature: "customs.doc_extract",
      prompt_key: PROMPT_KEY,
      variables: { shipment_context: parsed.shipment_context },
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
      subject: { type: "logistics_customs_doc_upload", id: subjectId },
      required_capabilities: ["vision", "json_mode"],
    }),
  });

  const gatewayBody = await gatewayRes.json().catch(() => ({}));
  if (!gatewayRes.ok) {
    logger.error("gateway non-2xx", {
      status: gatewayRes.status,
      code: (gatewayBody as { error?: { code?: string } })?.error?.code,
      shipment_id: parsed.shipment_context.shipment_id,
      booking_reference: parsed.shipment_context.booking_reference,
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
  logger.info("customs doc extract completed", {
    user_id: user.id,
    tenant_id: profile.tenant_id,
    shipment_id: parsed.shipment_context.shipment_id,
    booking_reference: parsed.shipment_context.booking_reference,
    origin_country: parsed.shipment_context.origin_country,
    destination_country: parsed.shipment_context.destination_country,
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
