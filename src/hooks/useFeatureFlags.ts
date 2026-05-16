/**
 * useFeatureFlags — resolves feature flags from platform.feature_flags
 * via the `feature-flags` edge function.
 *
 * Context (tenant/user) is resolved automatically from CRM context.
 * Results are cached 60s with React Query.
 *
 * Usage:
 *   const { isEnabled } = useFeatureFlags(['markets.signals.enabled']);
 *   if (isEnabled('markets.signals.enabled')) { ... }
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCRM } from "@/hooks/useCRM";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FeatureFlag {
  flag_key:   string;
  is_enabled: boolean;
  description: string | null;
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

const FLAGS_EDGE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/feature-flags`;
const ANON_KEY   = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

async function fetchFlagsFromEdge(
  keys:      string[],
  tenantId?: string | null,
  userId?:   string | null,
): Promise<Record<string, boolean>> {
  if (!keys.length) return {};
  try {
    const params = new URLSearchParams({ keys: keys.join(",") });
    if (tenantId) params.set("tenant_id", tenantId);
    if (userId)   params.set("user_id", userId);

    const res = await fetch(`${FLAGS_EDGE}?${params}`, {
      headers: { apikey: ANON_KEY },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    return (body?.data?.flags ?? {}) as Record<string, boolean>;
  } catch {
    // Graceful degradation: default all to false
    return Object.fromEntries(keys.map(k => [k, false]));
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFeatureFlags(keys: string[] = []) {
  const { context, user } = useCRM();
  const tenantId = context?.tenantId;
  const userId   = user?.id;

  // Stable cache key (sorted so order doesn't matter)
  const cacheKey = useMemo(() => [...keys].sort().join(","), [keys]);

  const query = useQuery({
    queryKey:  ["feature-flags", cacheKey, tenantId, userId],
    staleTime: 60_000,
    gcTime:    5 * 60_000,
    enabled:   keys.length > 0,
    queryFn:   () => fetchFlagsFromEdge(keys, tenantId, userId),
  });

  const resolvedFlags = query.data ?? {};

  // isEnabled: compatible with old API signature
  const isEnabled = (key: string, defaultValue = false): boolean => {
    if (!(key in resolvedFlags)) return defaultValue;
    return Boolean(resolvedFlags[key]);
  };

  // flags: back-compat shape (FeatureFlag[])
  const flags: Record<string, FeatureFlag> = Object.fromEntries(
    Object.entries(resolvedFlags).map(([k, v]) => [
      k,
      { flag_key: k, is_enabled: Boolean(v), description: null },
    ])
  );

  return {
    flags,
    isLoading: query.isLoading,
    error:     query.error ? String(query.error) : null,
    isEnabled,
    enabled:   isEnabled,   // alias used in newer code
    refetch:   query.refetch,
  };
}

// ── Imperative helper (outside React, e.g. guards, middleware) ────────────────

const _cache: Map<string, { v: boolean; exp: number }> = new Map();

export async function isFlagEnabled(
  key: string,
  opts?: { tenantId?: string | null; userId?: string | null },
): Promise<boolean> {
  const ck = `${key}|${opts?.tenantId ?? ""}|${opts?.userId ?? ""}`;
  const hit = _cache.get(ck);
  if (hit && Date.now() < hit.exp) return hit.v;
  const result = await fetchFlagsFromEdge([key], opts?.tenantId, opts?.userId);
  const v = Boolean(result[key]);
  _cache.set(ck, { v, exp: Date.now() + 60_000 });
  return v;
}
