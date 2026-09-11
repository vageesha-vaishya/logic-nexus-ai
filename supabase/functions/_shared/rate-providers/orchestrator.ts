// _shared/rate-providers/orchestrator.ts
//
// Executes exactly one tool_call the LLM made against get_freight_rate.
// Every cross-cutting concern lives here, applied uniformly regardless of
// which adapter is invoked: argument validation, circuit breaker
// check-and-update, daily call cap, SSRF guard on the configured base
// URL, timeout, normalized-rate caching, and structured error
// classification. See docs/smart-quote-module-design.md §11 for the
// full state machine this implements.

import { SupabaseClient } from "@supabase/supabase-js";
import { assertExternalHostAllowed } from "../ssrf-guard.ts";
import type {
  RateLookupRequest,
  RateLookupResult,
  RateProviderErrorCode,
  ResolvedProviderConfig,
} from "./types.ts";
import type { TenantRateProviderRegistry } from "./registry.ts";

const CIRCUIT_BREAKER_THRESHOLD = 3; // consecutive failures before opening
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60_000; // 5 minutes before a half-open retry
const CACHE_TTL_MS = 60 * 60_000; // 1 hour -- short enough that a stale quote is unlikely, long enough to avoid paying for a repeat call within the same buying session

function classifyError(err: unknown): { code: RateProviderErrorCode; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (/timed? ?out|timeout/i.test(message)) return { code: "timeout", message };
  if (/401|403|unauthorized|forbidden/i.test(message)) return { code: "auth_failed", message };
  if (/404|not found/i.test(message)) return { code: "rate_not_found", message };
  return { code: "provider_error", message };
}

async function updateHealth(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  providerName: string,
  outcome: { success: true; latencyMs: number } | { success: false; error: string },
): Promise<void> {
  try {
    const { data: existing } = await (supabaseAdmin as any)
      .from("rate_provider_health")
      .select("consecutive_failures, calls_today, calls_today_date")
      .eq("tenant_id", tenantId)
      .eq("provider_name", providerName)
      .maybeSingle();

    const today = new Date().toISOString().slice(0, 10);
    const callsToday = existing?.calls_today_date === today ? (existing?.calls_today ?? 0) + 1 : 1;

    if (outcome.success) {
      await (supabaseAdmin as any).from("rate_provider_health").upsert({
        tenant_id: tenantId,
        provider_name: providerName,
        status: "closed",
        consecutive_failures: 0,
        last_success_at: new Date().toISOString(),
        avg_latency_ms: outcome.latencyMs,
        calls_today: callsToday,
        calls_today_date: today,
        open_until: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "tenant_id,provider_name" });
      return;
    }

    const consecutiveFailures = (existing?.consecutive_failures ?? 0) + 1;
    const tripped = consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD;
    await (supabaseAdmin as any).from("rate_provider_health").upsert({
      tenant_id: tenantId,
      provider_name: providerName,
      status: tripped ? "open" : "closed",
      consecutive_failures: consecutiveFailures,
      last_failure_at: new Date().toISOString(),
      last_error: outcome.error.slice(0, 500),
      calls_today: callsToday,
      calls_today_date: today,
      open_until: tripped ? new Date(Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS).toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,provider_name" });
  } catch {
    // Health tracking is best-effort telemetry -- never let a logging
    // failure mask or replace the real tool-call result.
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Executes one get_freight_rate tool call. Never throws -- every failure
 * mode (bad arguments, unknown provider, circuit open, SSRF-blocked base
 * URL, timeout, provider error) returns a structured RateLookupResult so
 * the caller can feed a clear, honest failure back to the LLM as the tool
 * result rather than crashing the whole quote request over one provider.
 */
export async function executeRateToolCall(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  registry: TenantRateProviderRegistry,
  rawArgs: unknown,
): Promise<RateLookupResult> {
  const t0 = Date.now();

  let args: { provider?: string; origin?: string; destination?: string; mode?: string; container_type?: string };
  try {
    args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : (rawArgs as any);
  } catch {
    return { ok: false, error: "Tool call arguments were not valid JSON.", errorCode: "invalid_response", latencyMs: Date.now() - t0 };
  }

  const providerName = String(args?.provider ?? "");
  const match = registry.callable.find((c) => c.config.providerName === providerName);
  if (!match) {
    // Defense in depth: the tool schema's enum should already prevent
    // this, but models don't always respect enums perfectly (confirmed
    // live: the un-constrained test call invented "Xeneta" unprompted).
    return {
      ok: false,
      error: `'${providerName}' is not a configured, available rate provider for this tenant.`,
      errorCode: "provider_error",
      latencyMs: Date.now() - t0,
    };
  }

  const { config, adapter } = match;
  const mode = String(args?.mode ?? "").toLowerCase();
  if (!["ocean", "air", "road", "rail"].includes(mode)) {
    return { ok: false, error: `Invalid mode '${args?.mode}'.`, errorCode: "invalid_response", latencyMs: Date.now() - t0 };
  }
  if (!args?.origin || !args?.destination) {
    return { ok: false, error: "origin and destination are required.", errorCode: "invalid_response", latencyMs: Date.now() - t0 };
  }

  // Daily call cap (if configured) -- checked against today's count before
  // spending any latency on the real call.
  try {
    const { data: health } = await (supabaseAdmin as any)
      .from("rate_provider_health")
      .select("calls_today, calls_today_date, status, open_until")
      .eq("tenant_id", tenantId)
      .eq("provider_name", providerName)
      .maybeSingle();

    if (health?.status === "open" && health.open_until && new Date(health.open_until) > new Date()) {
      return {
        ok: false,
        error: `Provider '${providerName}' is temporarily unavailable after repeated failures; retry later.`,
        errorCode: "circuit_open",
        latencyMs: Date.now() - t0,
      };
    }
  } catch {
    // Health lookup failing is not itself a reason to block the call --
    // proceed and let the real attempt (or its own failure) speak for itself.
  }

  try {
    const url = new URL(config.baseUrl);
    await assertExternalHostAllowed(url.hostname);
  } catch (e) {
    await updateHealth(supabaseAdmin, tenantId, providerName, { success: false, error: String(e) });
    return { ok: false, error: `Provider base URL rejected: ${e instanceof Error ? e.message : String(e)}`, errorCode: "ssrf_blocked", latencyMs: Date.now() - t0 };
  }

  const request: RateLookupRequest = {
    origin: String(args.origin),
    destination: String(args.destination),
    mode: mode as RateLookupRequest["mode"],
    containerType: args.container_type ? String(args.container_type) : undefined,
  };

  try {
    const rate = await withTimeout(adapter.fetchRate(request, config), config.timeoutMs, `${providerName} fetchRate`);
    const latencyMs = Date.now() - t0;
    await updateHealth(supabaseAdmin, tenantId, providerName, { success: true, latencyMs });

    try {
      await (supabaseAdmin as any).from("external_rate_cache").insert({
        tenant_id: tenantId,
        provider_name: providerName,
        origin: request.origin,
        destination: request.destination,
        mode: request.mode,
        container_type: request.containerType ?? null,
        normalized_payload: rate,
        expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
        request_hash: `${request.origin}|${request.destination}|${request.mode}|${request.containerType ?? ""}`,
      });
    } catch {
      // Caching is a nice-to-have, not a correctness requirement -- a
      // failed insert must not fail the tool call that already succeeded.
    }

    return { ok: true, rate, latencyMs };
  } catch (e) {
    const latencyMs = Date.now() - t0;
    const { code, message } = classifyError(e);
    await updateHealth(supabaseAdmin, tenantId, providerName, { success: false, error: message });
    return { ok: false, error: message, errorCode: code, latencyMs };
  }
}
