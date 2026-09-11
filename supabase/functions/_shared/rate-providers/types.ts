// _shared/rate-providers/types.ts
//
// Shared types for the Smart Quote third-party rate provider integration.
// See docs/smart-quote-module-design.md §11 for the full architecture:
// the LLM calls these providers itself via OpenAI-compatible tool-calling
// (an explicit product decision, 2026-09-11 -- overriding this module's
// original recommendation of a deterministic pre-fetch, made after the
// latency/risk tradeoff was raised). Nothing here executes an HTTP call
// on its own; see orchestrator.ts for that.

/**
 * What every provider adapter must normalize its response into,
 * regardless of that provider's own wire format. This is the ONLY shape
 * the rest of the system (registry, orchestrator, ai-advisor,
 * applyDynamicPricing's reconciliation) ever sees -- provider-specific
 * quirks stay inside that provider's own adapter file.
 */
export interface NormalizedRate {
  provider: string;
  origin: string;
  destination: string;
  mode: "ocean" | "air" | "road" | "rail";
  containerType?: string;
  carrier?: string;
  /** Base freight only -- surcharges are itemized separately, never pre-summed by the adapter. */
  baseRate: number;
  currency: string;
  /** Itemized, e.g. { baf_caf: 200, peak_season: 50 }. Never assume any particular key is present. */
  surcharges: Record<string, number>;
  transitDays?: number;
  /** ISO 8601. When the provider didn't give one, the adapter must set a conservative default (see individual adapters), never leave it undefined. */
  validUntil: string;
  /** When the provider's own quote was generated/last updated -- distinct from when WE fetched it. */
  sourceTimestamp: string;
  /** Provider's own confidence/quality signal if it has one (e.g. spot vs. contract, historical vs. live); 0-1, adapter-defined. */
  confidence?: number;
  /** Raw provider response, kept for audit/debugging -- never surfaced to the LLM or the client, only logged. */
  raw?: unknown;
}

export interface RateLookupRequest {
  origin: string;
  destination: string;
  mode: "ocean" | "air" | "road" | "rail";
  containerType?: string;
  containerSize?: string;
  weightKg?: number;
  volumeCbm?: number;
}

export type RateLookupResult =
  | { ok: true; rate: NormalizedRate; latencyMs: number }
  | { ok: false; error: string; errorCode: RateProviderErrorCode; latencyMs: number };

export type RateProviderErrorCode =
  | "timeout"
  | "auth_failed"
  | "rate_not_found"
  | "invalid_response"
  | "provider_error"
  | "circuit_open"
  | "ssrf_blocked"
  | "daily_cap_exceeded";

/**
 * What a provider adapter implements. One file per real platform under
 * this directory (see example-provider.ts for the template) -- adapters
 * are intentionally small and dumb: fetch, map to NormalizedRate, done.
 * All cross-cutting concerns (timeout, circuit breaker, SSRF check,
 * caching, daily cap) live in orchestrator.ts, applied uniformly to
 * every adapter, so no individual adapter can accidentally skip one.
 */
export interface RateProviderAdapter {
  /** Must match the provider_name used in rate_provider_configs exactly. */
  readonly providerName: string;

  /**
   * Perform the actual request against this provider's real API.
   * Implementations should let network/HTTP errors propagate (throw) --
   * the orchestrator classifies and records them. Do NOT catch-and-return
   * null on failure; throw with a descriptive message instead.
   */
  fetchRate(
    request: RateLookupRequest,
    resolvedConfig: ResolvedProviderConfig,
  ): Promise<NormalizedRate>;
}

/** Decrypted, ready-to-use config for one provider, as returned by public.get_tenant_rate_providers(). */
export interface ResolvedProviderConfig {
  configId: string;
  providerName: string;
  displayName: string;
  baseUrl: string;
  authScheme: "bearer" | "api_key_header" | "basic" | "oauth2_client_credentials";
  authHeaderName: string | null;
  apiKey: string;
  timeoutMs: number;
  priority: number;
}
