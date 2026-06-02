// Per-tenant PII policy loader. Same credential-deferred pattern as
// the rest of the gateway: Supabase-backed when env vars are set,
// falls back to the embedded DEFAULT_STRICT_POLICY when not.
//
// 60s positive cache keyed by tenant_id.

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import {
  DEFAULT_STRICT_POLICY,
  type BuiltInPiiKind,
  type CustomPattern,
  type TenantPiiPolicy,
} from './types.js';

export type PolicyLookup = (tenantId: string) => Promise<TenantPiiPolicy>;

function readEnv(): { url: string; key: string } | null {
  const url = process.env.LLM_GATEWAY_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.LLM_GATEWAY_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function defaultPolicyFor(tenantId: string): TenantPiiPolicy {
  return { tenant_id: tenantId, ...DEFAULT_STRICT_POLICY };
}

interface PolicyRow {
  tenant_id: string;
  policy_kind: string;
  redact_kinds: string[];
  custom_patterns: CustomPattern[];
  preserve_mapping: boolean;
  reject_on_unredactable: boolean;
  pii_pass_through_consented_at: string | null;
}

function rowToPolicy(row: PolicyRow): TenantPiiPolicy {
  return {
    tenant_id: row.tenant_id,
    policy_kind: row.policy_kind as TenantPiiPolicy['policy_kind'],
    redact_kinds: row.redact_kinds as BuiltInPiiKind[],
    custom_patterns: row.custom_patterns ?? [],
    preserve_mapping: row.preserve_mapping,
    reject_on_unredactable: row.reject_on_unredactable,
    pii_pass_through_consented_at: row.pii_pass_through_consented_at,
  };
}

/**
 * Build a PolicyLookup. When SUPABASE env vars are missing, returns a
 * stub that always returns DEFAULT_STRICT_POLICY (safe default).
 */
export function buildPolicyLookup(): PolicyLookup {
  const env = readEnv();
  if (!env) {
    logger.info('pii policy: env vars missing, defaulting to strict for all tenants');
    return async (tenantId: string) => defaultPolicyFor(tenantId);
  }

  const client = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'gateway' },
  });
  const cache = new Map<string, { policy: TenantPiiPolicy; cachedAt: number }>();
  const TTL_MS = 60_000;

  logger.info('pii policy: initialized supabase loader');

  return async (tenantId: string): Promise<TenantPiiPolicy> => {
    const hit = cache.get(tenantId);
    if (hit && Date.now() - hit.cachedAt < TTL_MS) return hit.policy;

    const { data, error } = await client
      .from('tenant_pii_policy')
      .select('tenant_id, policy_kind, redact_kinds, custom_patterns, preserve_mapping, reject_on_unredactable, pii_pass_through_consented_at')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    let policy: TenantPiiPolicy;
    if (error) {
      logger.error('tenant_pii_policy lookup failed; falling back to strict', { tenant_id: tenantId, err: error.message });
      policy = defaultPolicyFor(tenantId);
    } else if (!data) {
      policy = defaultPolicyFor(tenantId);
    } else {
      policy = rowToPolicy(data as PolicyRow);
    }
    cache.set(tenantId, { policy, cachedAt: Date.now() });
    return policy;
  };
}
