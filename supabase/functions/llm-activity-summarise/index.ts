// llm-activity-summarise — twelfth production callsite for the unified
// LLM Gateway, first CRM LLM feature. Master plan §7.4 Phase 10
// Tier-1: given a series of activity log entries on a single subject
// (lead / opportunity / account / contact), produce a structured
// narrative summary the next sales rep reads BEFORE the next
// interaction.
//
// Non-modal: structured JSON only.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { Logger } from "../_shared/logger.ts";

// @ts-ignore
declare const Deno: any;

const PROMPT_KEY = "crm.activity.summarise";

interface ActivityLogEntry {
  activity_id: string;
  type: string;
  direction?: "inbound" | "outbound" | null;
  actor_role?: string | null;
  occurred_at: string;
  duration_minutes?: number | null;
  summary?: string | null;
  body: string;
  outcome?: string | null;
}

interface SummariseRequest {
  subject: {
    type: "lead" | "opportunity" | "account" | "contact";
    id: string;
    name: string;
    stage?: string | null;
    owner?: string | null;
  };
  activities: ActivityLogEntry[];
  summary_window: {
    max_activities_considered: number;
    earliest_iso?: string | null;
    audience: "sdr_handoff" | "am_prep" | "manager_review" | "renewal_prep";
  };
}

function bad(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({
      error: { code: status === 401 ? "UNAUTHORIZED" : "INVALID_REQUEST", message },
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

const VALID_SUBJECT_TYPES = new Set(["lead", "opportunity", "account", "contact"]);
const VALID_AUDIENCES = new Set(["sdr_handoff", "am_prep", "manager_review", "renewal_prep"]);
const VALID_ACTIVITY_TYPES = new Set([
  "call", "email", "meeting", "note", "demo",
  "proposal_sent", "quote_sent", "task_completed", "stage_change", "other",
]);

function parseInputs(raw: unknown): SummariseRequest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  const s = r.subject as SummariseRequest["subject"] | undefined;
  if (!s || typeof s !== "object") return { error: "subject object required" };
  if (!VALID_SUBJECT_TYPES.has(s.type)) {
    return { error: "subject.type must be lead|opportunity|account|contact" };
  }
  if (typeof s.id !== "string" || !s.id) return { error: "subject.id required" };
  if (typeof s.name !== "string" || !s.name) return { error: "subject.name required" };

  if (!Array.isArray(r.activities)) return { error: "activities array required" };
  if (r.activities.length === 0) return { error: "activities cannot be empty" };
  if (r.activities.length > 60) {
    return { error: "activities too large (max 60 per invocation)" };
  }
  for (const [i, raw_a] of (r.activities as unknown[]).entries()) {
    const a = raw_a as ActivityLogEntry;
    if (typeof a?.activity_id !== "string" || !a.activity_id) {
      return { error: `activities[${i}].activity_id required` };
    }
    if (!VALID_ACTIVITY_TYPES.has(a.type)) {
      return { error: `activities[${i}].type invalid` };
    }
    if (typeof a.occurred_at !== "string") {
      return { error: `activities[${i}].occurred_at required (ISO)` };
    }
    if (typeof a.body !== "string") {
      return { error: `activities[${i}].body required` };
    }
  }

  const w = r.summary_window as SummariseRequest["summary_window"] | undefined;
  if (!w || typeof w !== "object") return { error: "summary_window object required" };
  if (!VALID_AUDIENCES.has(w.audience)) {
    return { error: "summary_window.audience invalid" };
  }
  if (typeof w.max_activities_considered !== "number" || w.max_activities_considered < 1) {
    return { error: "summary_window.max_activities_considered must be a positive number" };
  }

  return {
    subject: s,
    activities: r.activities as ActivityLogEntry[],
    summary_window: w,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad("POST only", 405);

  const logger = new Logger("llm-activity-summarise");

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

  // Cap activity count at summary_window.max_activities_considered and trim
  // oldest if input has more — keeps token budget bounded. The earliest
  // entries that get dropped show up implicitly via the prompt's
  // "earlier interactions" handling.
  const trimmedActivities = parsed.activities
    .slice()
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .slice(-parsed.summary_window.max_activities_considered);

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
      module: "crm",
      feature: "activity.summarise",
      prompt_key: PROMPT_KEY,
      variables: {
        subject: parsed.subject,
        activities: trimmedActivities,
        summary_window: parsed.summary_window,
      },
      subject: { type: parsed.subject.type, id: parsed.subject.id },
      required_capabilities: ["json_mode"],
    }),
  });

  const gatewayBody = await gatewayRes.json().catch(() => ({}));
  if (!gatewayRes.ok) {
    logger.error("gateway non-2xx", {
      status: gatewayRes.status,
      code: (gatewayBody as { error?: { code?: string } })?.error?.code,
      subject_id: parsed.subject.id,
      audience: parsed.summary_window.audience,
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
  logger.info("activity summarise completed", {
    user_id: user.id,
    tenant_id: profile.tenant_id,
    subject_type: parsed.subject.type,
    subject_id: parsed.subject.id,
    audience: parsed.summary_window.audience,
    activity_count_in: parsed.activities.length,
    activity_count_used: trimmedActivities.length,
    invocation_id: result.invocation_id,
    cost_usd: result.cost_usd,
    latency_ms: result.latency_ms,
    wall_ms: Date.now() - startedAt,
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
