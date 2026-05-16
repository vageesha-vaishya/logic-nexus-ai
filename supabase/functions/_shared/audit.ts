// _shared/audit.ts
//
// Platform access + mutation audit helpers.
//
// logAccess  — fire-and-forget write to platform.access_log  (auth/domain decisions)
// logAudit   — fire-and-forget write to platform.audit_log   (state mutations)
// extractIp  — pull client IP from Cloudflare / proxy headers
// extractRequestId — pull or generate a stable request ID
//
// Both log functions are intentionally fire-and-forget: they never block
// the response path. Errors are console.warn'd, never thrown.
//
// Legacy: logAiCall (kept for backward-compat with existing AI edge functions)

import { SupabaseClient } from "@supabase/supabase-js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AccessLogEntry {
  requestId?:    string | null;
  domain:        string;
  op:            string;
  tenantId?:     string | null;
  franchiseId?:  string | null;
  userId?:       string | null;
  resourceType?: string | null;
  resourceId?:   string | null;
  decision:      "allow" | "deny";
  reason?:       string | null;
  ms?:           number | null;
}

export interface AuditLogEntry {
  requestId?:    string | null;
  domain:        string;
  op:            string;
  opMs?:         number | null;
  tenantId?:     string | null;
  franchiseId?:  string | null;
  userId?:       string | null;
  actedBy?:      string | null;
  resourceType?: string | null;
  resourceId?:   string | null;
  action:        string;
  before?:       unknown;
  after?:        unknown;
  ip?:           string | null;
  userAgent?:    string | null;
}

// ── Request metadata helpers ─────────────────────────────────────────────────

/** Extract client IP. Tries Cloudflare → real-ip → x-forwarded-for. */
export function extractIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Return caller-supplied request/correlation ID or generate a UUID. */
export function extractRequestId(req: Request): string {
  return (
    req.headers.get("x-request-id") ??
    req.headers.get("x-correlation-id") ??
    crypto.randomUUID()
  );
}

// ── Core audit writers ───────────────────────────────────────────────────────

/**
 * Fire-and-forget write to platform.access_log.
 *
 * Call after every auth/domain check to record the allow or deny decision.
 * Uses supabaseAdmin (service-role) to bypass RLS on the append-only table.
 *
 * Example:
 *   logAccess(supabaseAdmin, {
 *     requestId, domain: "markets", op: "GET /portfolios",
 *     userId: user.id, tenantId, decision: "allow",
 *   });
 */
export function logAccess(
  supabaseAdmin: SupabaseClient,
  entry: AccessLogEntry,
): void {
  (supabaseAdmin as any)
    .schema("platform")
    .from("access_log")
    .insert({
      request_id:    entry.requestId   ?? null,
      domain:        entry.domain,
      op:            entry.op,
      tenant_id:     entry.tenantId    ?? null,
      franchise_id:  entry.franchiseId ?? null,
      user_id:       entry.userId      ?? null,
      resource_type: entry.resourceType ?? null,
      resource_id:   entry.resourceId  ?? null,
      decision:      entry.decision,
      reason:        entry.reason      ?? null,
      ms:            entry.ms          ?? null,
    })
    .then(({ error }: { error: any }) => {
      if (error) console.warn("[audit] access_log write failed:", error.message);
    });
}

/**
 * Fire-and-forget write to platform.audit_log.
 *
 * Call after every state-mutating operation (create, update, delete, import).
 * Uses supabaseAdmin to bypass RLS.
 *
 * Pass `before` and/or `after` to enable point-in-time replay and diffs.
 * Strip PII before passing — these rows are retained indefinitely.
 *
 * Example:
 *   logAudit(supabaseAdmin, {
 *     requestId, domain: "markets", op: "POST /portfolios",
 *     tenantId, userId: user.id, ip,
 *     resourceType: "portfolio", resourceId: data.id,
 *     action: "create", after: data,
 *   });
 */
export function logAudit(
  supabaseAdmin: SupabaseClient,
  entry: AuditLogEntry,
): void {
  (supabaseAdmin as any)
    .schema("platform")
    .from("audit_log")
    .insert({
      request_id:    entry.requestId   ?? null,
      domain:        entry.domain,
      op:            entry.op,
      op_ms:         entry.opMs        ?? null,
      tenant_id:     entry.tenantId    ?? null,
      franchise_id:  entry.franchiseId ?? null,
      user_id:       entry.userId      ?? null,
      acted_by:      entry.actedBy     ?? null,
      resource_type: entry.resourceType ?? null,
      resource_id:   entry.resourceId  ?? null,
      action:        entry.action,
      before:        entry.before      ?? null,
      after:         entry.after       ?? null,
      ip:            entry.ip          ?? null,
      user_agent:    entry.userAgent   ?? null,
    })
    .then(({ error }: { error: any }) => {
      if (error) console.warn("[audit] audit_log write failed:", error.message);
    });
}

// ── Legacy: kept for backward-compat with existing AI edge functions ─────────

export async function logAiCall(
  supabase: SupabaseClient,
  payload: {
    tenant_id?: string | null;
    user_id?: string | null;
    function_name: string;
    model_used: string;
    model_version?: string | null;
    input_tokens?: number | null;
    output_tokens?: number | null;
    total_cost_usd?: number | null;
    latency_ms?: number | null;
    input_hash?: string | null;
    output_summary?: any;
    pii_detected?: boolean;
    pii_fields_redacted?: string[];
    cache_hit?: boolean;
    error_message?: string | null;
  }
) {
  await supabase.from("ai_audit_logs").insert({
    tenant_id:            payload.tenant_id          ?? null,
    user_id:              payload.user_id             ?? null,
    function_name:        payload.function_name,
    model_used:           payload.model_used,
    model_version:        payload.model_version       ?? null,
    input_tokens:         payload.input_tokens        ?? null,
    output_tokens:        payload.output_tokens       ?? null,
    total_cost_usd:       payload.total_cost_usd      ?? null,
    latency_ms:           payload.latency_ms          ?? null,
    input_hash:           payload.input_hash          ?? null,
    output_summary:       payload.output_summary      ?? null,
    pii_detected:         payload.pii_detected        ?? false,
    pii_fields_redacted:  payload.pii_fields_redacted ?? [],
    cache_hit:            payload.cache_hit           ?? false,
    error_message:        payload.error_message       ?? null,
  });
}
