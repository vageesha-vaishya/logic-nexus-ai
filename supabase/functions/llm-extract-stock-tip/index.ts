// llm-extract-stock-tip — fifth production callsite for the unified
// LLM gateway. Sthira mobile: user snaps a screenshot of a stock tip
// they received (WhatsApp, news, broker app, chart) and the gateway
// extracts the ticker + claim and assesses fit against the user's
// risk profile.
//
// Strictly informational. Per the Sthira audience policy, this never
// recommends executing a trade — the prompt's output enum constrains
// suggested_action to "next-step" verbs only.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { Logger } from "../_shared/logger.ts";

// @ts-ignore
declare const Deno: any;

const PROMPT_KEY = "sthira.tip.screenshot_extract";
const MAX_INLINE_BASE64 = 8 * 1024 * 1024; // 8 MiB — matches gateway cap

interface ScreenshotAttachment {
  mime_type: string;
  content_base64?: string;
  url?: string;
  label?: string;
}

interface ExtractTipRequest {
  experience_level: string;
  risk_tag: string;
  goals_summary?: string;
  screenshot: ScreenshotAttachment;
}

function bad(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: { code: status === 401 ? "UNAUTHORIZED" : "INVALID_REQUEST", message } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function parseInputs(raw: unknown): ExtractTipRequest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  const experience_level = typeof r.experience_level === "string" ? r.experience_level.trim() : "";
  const risk_tag = typeof r.risk_tag === "string" ? r.risk_tag.trim() : "";
  if (!experience_level) return { error: "experience_level required" };
  if (!risk_tag) return { error: "risk_tag required" };

  const s = r.screenshot as ScreenshotAttachment | undefined;
  if (!s || typeof s !== "object") return { error: "screenshot required" };
  if (typeof s.mime_type !== "string" || !s.mime_type.startsWith("image/")) {
    return { error: "screenshot.mime_type must be an image/* media type" };
  }
  const hasBase64 = typeof s.content_base64 === "string" && s.content_base64.length > 0;
  const hasUrl = typeof s.url === "string" && s.url.length > 0;
  if (hasBase64 === hasUrl) {
    return { error: "screenshot must carry exactly one of content_base64 or url" };
  }
  if (hasBase64 && (s.content_base64 as string).length > MAX_INLINE_BASE64) {
    return { error: `screenshot.content_base64 exceeds ${MAX_INLINE_BASE64 / (1024 * 1024)} MiB cap` };
  }
  if (hasUrl && !/^https:\/\//.test(s.url as string)) {
    return { error: "screenshot.url must be an https URL" };
  }

  const goals_summary = typeof r.goals_summary === "string" ? r.goals_summary.slice(0, 400) : undefined;
  return { experience_level, risk_tag, goals_summary, screenshot: s };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad("POST only", 405);

  const logger = new Logger("llm-extract-stock-tip");

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
  const platformId = Deno.env.get("LLM_GATEWAY_PLATFORM_ID") ?? "sthira";

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
      module: "sthira",
      feature: "tip.screenshot_extract",
      prompt_key: PROMPT_KEY,
      variables: {
        experience_level: parsed.experience_level,
        risk_tag: parsed.risk_tag,
        goals_summary: parsed.goals_summary ?? "(not provided)",
      },
      attachments: [{
        kind: "image",
        mime_type: parsed.screenshot.mime_type,
        ...(parsed.screenshot.content_base64 ? { content_base64: parsed.screenshot.content_base64 } : {}),
        ...(parsed.screenshot.url ? { url: parsed.screenshot.url } : {}),
        ...(parsed.screenshot.label ? { label: parsed.screenshot.label } : {}),
      }],
      subject: { type: "sthira_user", id: user.id },
      required_capabilities: ["vision", "json_mode"],
    }),
  });

  const gatewayBody = await gatewayRes.json().catch(() => ({}));
  if (!gatewayRes.ok) {
    logger.error("gateway non-2xx", {
      status: gatewayRes.status,
      code: (gatewayBody as { error?: { code?: string } })?.error?.code,
      user_id: user.id,
    });
    return new Response(JSON.stringify(gatewayBody), {
      status: gatewayRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = gatewayBody as {
    invocation_id: string; output: unknown; cost_usd: number; latency_ms: number; warnings?: string[];
  };
  logger.info("extract-stock-tip completed", {
    user_id: user.id,
    tenant_id: profile.tenant_id,
    invocation_id: result.invocation_id,
    cost_usd: result.cost_usd,
    latency_ms: result.latency_ms,
    wall_ms: Date.now() - startedAt,
    screenshot_kind: parsed.screenshot.content_base64 ? "inline" : "url",
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
