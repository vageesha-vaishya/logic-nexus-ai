/**
 * Prompt-response cache contract. Keyed on a hash of
 * (prompt_key, version, normalised_variables, model, tenant_id).
 *
 * The real implementation (Phase 9) is Redis-backed via Upstash for
 * production and an in-memory cache for dev. Cache entries are TTL'd
 * per-prompt via the frontmatter `cache_ttl_seconds` field.
 */

import type { InvokeResponse } from "./types.js";

export interface PromptCache {
  get(cache_key: string): Promise<CachedEntry | null>;
  set(cache_key: string, entry: CachedEntry, ttl_seconds: number): Promise<void>;
  /** For test cleanup; production impl may no-op. */
  clear(): Promise<void>;
}

export interface CachedEntry {
  response: Omit<InvokeResponse, "invocation_id" | "cache_hit" | "latency_ms">;
  stored_at: string;
}

/**
 * Always-miss cache. Phase 0 default — no caching infrastructure
 * deployed yet, so every call is treated as a fresh miss.
 */
export class NullPromptCache implements PromptCache {
  async get(): Promise<CachedEntry | null> {
    return null;
  }
  async set(): Promise<void> {
    /* no-op */
  }
  async clear(): Promise<void> {
    /* no-op */
  }
}

/**
 * In-memory cache. Useful for tests and for single-process dev when
 * Redis isn't running. NOT for production — does not survive restarts
 * and provides no cross-process coherence.
 */
export class MemoryPromptCache implements PromptCache {
  private store = new Map<string, { entry: CachedEntry; expires_at_ms: number }>();

  async get(cache_key: string): Promise<CachedEntry | null> {
    const hit = this.store.get(cache_key);
    if (!hit) return null;
    if (Date.now() >= hit.expires_at_ms) {
      this.store.delete(cache_key);
      return null;
    }
    return hit.entry;
  }

  async set(cache_key: string, entry: CachedEntry, ttl_seconds: number): Promise<void> {
    this.store.set(cache_key, {
      entry,
      expires_at_ms: Date.now() + ttl_seconds * 1000,
    });
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

/**
 * Compose a deterministic cache key from a request. Same algorithm in
 * every call site so cache lookups don't drift.
 */
export function composeCacheKey(parts: {
  prompt_key: string;
  prompt_version: number;
  model: string;
  tenant_id: string;
  normalised_variables_hash: string;
}): string {
  return [
    parts.prompt_key,
    `v${parts.prompt_version}`,
    parts.model,
    parts.tenant_id,
    parts.normalised_variables_hash,
  ].join(":");
}
