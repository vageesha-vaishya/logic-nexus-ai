// _shared/rate-limit.ts
//
// Distributed rate limiter backed by Upstash Redis REST API.
// Algorithm: fixed window with atomic INCR pipeline (INCR + EXPIRE in one call).
//
// FAIL-OPEN: if UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are missing
// OR if Redis is unreachable, every request is allowed. Edge functions remain
// fully operational before Redis is provisioned — this must NEVER be changed
// to fail-closed without explicit sign-off, as it would cause cascading outages.
//
// Required env vars (set in Supabase Edge Function secrets):
//   UPSTASH_REDIS_REST_URL    https://xxx.upstash.io
//   UPSTASH_REDIS_REST_TOKEN  read-write token from console.upstash.com
//
// Usage:
//   import { checkRateLimit, rlKey, rateLimitResponse, POLICIES } from "../_shared/rate-limit.ts";
//
//   const key    = rlKey("portfolios.write", tenantId, userId);
//   const result = await checkRateLimit(key, POLICIES.api_mutation);
//   if (!result.allowed) return rateLimitResponse(result, corsHeaders);

declare const Deno: any;

// ── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitPolicy {
  /** Maximum requests allowed within windowMs. */
  limit:    number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed:    boolean;
  remaining:  number;   // requests left in this window
  limit:      number;   // max requests per window
  resetAt:    number;   // unix ms when this window expires
  retryAfter: number;   // ms the client should wait (0 when allowed)
}

// ── Built-in policies ────────────────────────────────────────────────────────
// Tune per operation category. Override per-tenant by passing a custom policy.

export const POLICIES = {
  /** Default read endpoints: 120 req/min per tenant+user */
  api_read:         { limit: 120,  windowMs:  60_000 },
  /** Write endpoints (create/update/delete): 30 req/min per tenant+user */
  api_mutation:     { limit: 30,   windowMs:  60_000 },
  /** LLM inference calls: 20/min per tenant (expensive) */
  llm_call:         { limit: 20,   windowMs:  60_000 },
  /** Holdings import (bulk): 5/min per tenant+user */
  import_holdings:  { limit: 5,    windowMs:  60_000 },
  /** Ingest functions (service-role only): 10/min globally */
  ingest:           { limit: 10,   windowMs:  60_000 },
  /** Alert notifier dedup: 5 identical alerts/min */
  alert_dedup:      { limit: 5,    windowMs:  60_000 },
  /** Webhook delivery retries: 60/min per integration */
  webhook_delivery: { limit: 60,   windowMs:  60_000 },
} as const;

export type PolicyKey = keyof typeof POLICIES;

// ── Redis client (lazy singleton) ────────────────────────────────────────────

interface RedisConfig { url: string; token: string; }

let _redis: RedisConfig | null | undefined = undefined; // undefined = not yet resolved

function getRedis(): RedisConfig | null {
  if (_redis !== undefined) return _redis;
  const url   = Deno.env.get("UPSTASH_REDIS_REST_URL")   ?? null;
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN") ?? null;
  _redis = (url && token) ? { url, token } : null;
  if (!_redis) console.warn("[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set — failing open");
  return _redis;
}

/**
 * Execute commands atomically via Upstash pipeline (one HTTP round-trip).
 * https://upstash.com/docs/redis/features/restapi#pipelining
 */
async function pipeline(redis: RedisConfig, commands: (string | number)[][]): Promise<any[]> {
  const res = await fetch(`${redis.url}/pipeline`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${redis.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!res.ok) {
    throw new Error(`Upstash pipeline error ${res.status}: ${await res.text()}`);
  }

  const json: Array<{ result: any; error?: string }> = await res.json();
  return json.map(r => r.result);
}

// ── Core API ─────────────────────────────────────────────────────────────────

/**
 * Check (and record) a rate limit counter using a fixed window.
 *
 * @param identifier  Scoped key — build with `rlKey()`.
 * @param policy      Policy object or a key of `POLICIES`.
 * @returns           RateLimitResult — always resolved (never throws).
 */
export async function checkRateLimit(
  identifier: string,
  policy: RateLimitPolicy | PolicyKey,
): Promise<RateLimitResult> {
  const p: RateLimitPolicy = typeof policy === "string" ? POLICIES[policy] : policy;
  const windowSec = Math.ceil(p.windowMs / 1000);
  const now       = Date.now();
  const bucket    = Math.floor(now / p.windowMs);
  const resetAt   = (bucket + 1) * p.windowMs;

  const fail_open: RateLimitResult = {
    allowed: true, remaining: p.limit - 1, limit: p.limit, resetAt, retryAfter: 0,
  };

  const redis = getRedis();
  if (!redis) return fail_open;

  try {
    const key = `rl:${identifier}:${bucket}`;

    // Atomic pipeline: INCR then EXPIRE (EXPIRE is a no-op on subsequent calls)
    const [count] = await pipeline(redis, [
      ["INCR", key],
      ["EXPIRE", key, windowSec],
    ]);

    const allowed   = (count as number) <= p.limit;
    const remaining = Math.max(0, p.limit - (count as number));

    return {
      allowed,
      remaining,
      limit: p.limit,
      resetAt,
      retryAfter: allowed ? 0 : resetAt - now,
    };
  } catch (err) {
    // Redis unreachable — fail open, log, continue
    console.warn("[rate-limit] Redis unavailable, failing open:", (err as Error).message);
    return fail_open;
  }
}

/**
 * Convenience key builder. Uses the most specific scope available:
 *   tenantId + userId + op  → per-user-per-op  (most restrictive)
 *   tenantId + op           → per-tenant-per-op
 *   op only                 → global (last resort for service-role calls)
 *
 * @example
 *   rlKey("portfolios.write", tenantId, userId)
 *   // → "t:abc123:u:def456:portfolios.write"
 */
export function rlKey(
  op: string,
  tenantId?: string | null,
  userId?:   string | null,
): string {
  const parts: string[] = [];
  if (tenantId) parts.push(`t:${tenantId}`);
  if (userId)   parts.push(`u:${userId}`);
  parts.push(op);
  return parts.join(":");
}

/**
 * Standard 429 Too Many Requests response with rate-limit headers.
 * Pass your existing corsHeaders to merge them in.
 */
export function rateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({
      error:          "Too many requests",
      retry_after_ms: result.retryAfter,
      reset_at:       result.resetAt,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type":          "application/json",
        "X-RateLimit-Limit":     String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset":     String(Math.ceil(result.resetAt / 1000)),
        "Retry-After":           String(Math.ceil(result.retryAfter / 1000)),
      },
    },
  );
}
