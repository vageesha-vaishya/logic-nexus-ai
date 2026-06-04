// llm-draft-reply — Phase 10 Tier-2 LLM feature. Drafts a customer
// reply for an inbound message that's already been classified by
// comms.inbound.classify. Operator reviews + sends; never auto-sends.
//
// Mirrors supabase/functions/llm-classify-inbound for shape +
// llm-shipment-delay-prediction for input validation discipline.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { Logger } from "../_shared/logger.ts";

// @ts-ignore
declare const Deno: any;

const PROMPT_KEY = "comms.inbound.draft_reply";

const VALID_INTENTS = new Set([
  "quote_request", "shipment_status", "complaint",
  "billing_question", "spam", "other",
]);
const VALID_URGENCY = new Set(["low", "medium", "high", "urgent"]);
const VALID_TONES = new Set(["formal", "friendly", "firm"]);

interface InboundMessage {
  from_name: string;
  from_email: string;
  subject: string;
  body: string;
  received_iso: string;
  language?: string | null;
}

interface Classification {
  intent: string;
  urgency: string;
  summary: string;
}

interface ThreadEntry {
  from: string;
  body: string;
  sent_iso: string;
}

interface ReplyContext {
  operator_name: string;
  company_name: string;
  customer_name?: string | null;
  related_shipment_ids?: string[];
  related_quote_ids?: string[];
  signature_block?: string | null;
}

interface DraftReplyRequest {
  message_id: string;
  inbound: InboundMessage;
  classification: Classification;
  thread_history?: ThreadEntry[];
  context: ReplyContext;
  tone?: "formal" | "friendly" | "firm";
  language?: string;
}

function bad(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: { code: status === 401 ? "UNAUTHORIZED" : "INVALID_REQUEST", message } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function parseInputs(raw: unknown): DraftReplyRequest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  const message_id = typeof r.message_id === "string" ? r.message_id : "";
  if (!message_id) return { error: "message_id required" };

  const m = r.inbound as InboundMessage | undefined;
  if (!m || typeof m.from_email !== "string" || typeof m.subject !== "string" || typeof m.body !== "string") {
    return { error: "inbound.from_email + .subject + .body required" };
  }
  const trimmedBody = m.body.length > 16_000 ? m.body.slice(0, 16_000) : m.body;

  const c = r.classification as Classification | undefined;
  if (!c || typeof c.intent !== "string" || typeof c.urgency !== "string" || typeof c.summary !== "string") {
    return { error: "classification.intent + .urgency + .summary required" };
  }
  if (!VALID_INTENTS.has(c.intent)) return { error: `invalid intent: ${c.intent}` };
  if (!VALID_URGENCY.has(c.urgency)) return { error: `invalid urgency: ${c.urgency}` };

  const ctx = r.context as ReplyContext | undefined;
  if (!ctx || typeof ctx.operator_name !== "string" || typeof ctx.company_name !== "string") {
    return { error: "context.operator_name + .company_name required" };
  }

  const tone = (r.tone as string | undefined) ?? "friendly";
  if (!VALID_TONES.has(tone)) return { error: `invalid tone: ${tone}` };

  // Cap thread_history at 5 entries for prompt token economy.
  let history: ThreadEntry[] | undefined;
  if (Array.isArray(r.thread_history)) {
    history = (r.thread_history as ThreadEntry[])
      .filter(h => h && typeof h.from === "string" && typeof h.body === "string")
      .slice(0, 5)
      .map(h => ({
        from: h.from,
        body: h.body.length > 4_000 ? h.body.slice(0, 4_000) : h.body,
        sent_iso: h.sent_iso ?? new Date().toISOString(),
      }));
  }

  return {
    message_id,
    inbound: { ...m, body: trimmedBody, language: m.language ?? null },
    classification: c,
    thread_history: history,
    context: ctx,
    tone: tone as "formal" | "friendly" | "firm",
    language: typeof r.language === "string" ? r.language : (m.language ?? "en"),
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad("POST only", 405);

  const logger = new Logger("llm-draft-reply");

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
      module: "comms",
      feature: "inbound.draft_reply",
      prompt_key: PROMPT_KEY,
      variables: {
        inbound: parsed.inbound,
        classification: parsed.classification,
        thread_history: parsed.thread_history ?? [],
        context: parsed.context,
        tone: parsed.tone,
        language: parsed.language,
      },
      subject: { type: "email", id: parsed.message_id },
      required_capabilities: ["json_mode"],
    }),
  });

  const gatewayBody = await gatewayRes.json().catch(() => ({}));
  if (!gatewayRes.ok) {
    logger.error("gateway non-2xx", {
      status: gatewayRes.status,
      code: (gatewayBody as { error?: { code?: string } })?.error?.code,
      message_id: parsed.message_id,
    });
    return new Response(JSON.stringify(gatewayBody), {
      status: gatewayRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = gatewayBody as {
    invocation_id: string; output: unknown; cost_usd: number; latency_ms: number; warnings?: string[];
  };
  logger.info("draft-reply completed", {
    user_id: user.id,
    tenant_id: profile.tenant_id,
    message_id: parsed.message_id,
    invocation_id: result.invocation_id,
    cost_usd: result.cost_usd,
    latency_ms: result.latency_ms,
    wall_ms: Date.now() - startedAt,
  });

  return new Response(
    JSON.stringify({
      message_id: parsed.message_id,
      invocation_id: result.invocation_id,
      output: result.output,
      cost_usd: result.cost_usd,
      latency_ms: result.latency_ms,
      warnings: result.warnings,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
