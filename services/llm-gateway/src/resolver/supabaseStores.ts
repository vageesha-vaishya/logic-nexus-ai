// Supabase-backed ResolverStores. Reads from gateway.provider_configs,
// gateway.provider_models, gateway.provider_residency_map.
//
// Credential-deferred pattern: if SUPABASE_URL or
// SUPABASE_SERVICE_ROLE_KEY are missing, buildSupabaseStores() returns
// null and the gateway falls back to the in-memory bootstrap.
// Per P0 we already work without DB; this slice makes it possible to
// graduate when env vars are set, without forcing the change everywhere.

import { createClient } from '@supabase/supabase-js';
import type { ProviderKind } from '../types/gateway.types.js';
import { logger } from '../utils/logger.js';
import type {
  EgressPolicyEntry,
  ProviderConfigRecord,
  ProviderModelCatalogEntry,
  ResolverScopeKind,
  ResolverStores,
} from './types.js';

interface SupabaseEnv {
  url: string;
  serviceRoleKey: string;
}

function readEnv(): SupabaseEnv | null {
  const url = process.env.LLM_GATEWAY_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey =
    process.env.LLM_GATEWAY_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

function createGatewayClient(env: SupabaseEnv) {
  return createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'gateway' },
  });
}

const CACHE_TTL_MS = 60_000;          // per design §3.1: resolver cache 60s
type CacheBucket<T> = Map<string, { value: T; cachedAt: number }>;

function cachedLookup<T>(bucket: CacheBucket<T>, key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = bucket.get(key);
  if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) return Promise.resolve(hit.value);
  return fetcher().then((value) => {
    bucket.set(key, { value, cachedAt: Date.now() });
    return value;
  });
}

/**
 * Returns null when SUPABASE env vars are missing so callers can
 * cleanly fall back to in-memory stores. Never throws on connectivity
 * failures at construction time — those surface at first query.
 */
export function buildSupabaseStores(): ResolverStores | null {
  const env = readEnv();
  if (!env) {
    logger.info('supabase stores: env vars missing, falling back to in-memory');
    return null;
  }

  const client = createGatewayClient(env);
  logger.info('supabase stores: initialized', { url_host: new URL(env.url).host });

  const configCache: CacheBucket<ProviderConfigRecord | null> = new Map();
  const modelCache: CacheBucket<ProviderModelCatalogEntry | null> = new Map();
  const egressCache: CacheBucket<EgressPolicyEntry | null> = new Map();

  return {
    getProviderConfig: (scope_kind: ResolverScopeKind, scope_id: string) =>
      cachedLookup(configCache, `${scope_kind}::${scope_id}`, async () => {
        const { data, error } = await client
          .from('provider_configs')
          .select(
            'scope_kind, scope_id, provider_kind, model_id, credentials_ref, endpoint_url, is_pin, fallback_provider_kind, fallback_model_id, billing_mode, required_capabilities',
          )
          .eq('scope_kind', scope_kind)
          .eq('scope_id', scope_id)
          .maybeSingle();
        if (error) {
          logger.error('provider_configs lookup failed', { scope_kind, scope_id, err: error.message });
          return null;
        }
        return data as ProviderConfigRecord | null;
      }),

    getModelCatalogEntry: (provider_kind: ProviderKind, model_id: string) =>
      cachedLookup(modelCache, `${provider_kind}::${model_id}`, async () => {
        const { data, error } = await client
          .from('provider_models')
          .select('provider_kind, model_id, capabilities, deprecated_at, replacement_model_id')
          .eq('provider_kind', provider_kind)
          .eq('model_id', model_id)
          .maybeSingle();
        if (error) {
          logger.error('provider_models lookup failed', { provider_kind, model_id, err: error.message });
          return null;
        }
        return data as ProviderModelCatalogEntry | null;
      }),

    getEgressPolicy: (provider_kind: ProviderKind) =>
      cachedLookup(egressCache, provider_kind, async () => {
        const { data, error } = await client
          .from('provider_residency_map')
          .select('provider_kind, allowed_regions')
          .eq('provider_kind', provider_kind)
          .maybeSingle();
        if (error) {
          logger.error('provider_residency_map lookup failed', { provider_kind, err: error.message });
          return null;
        }
        return data as EgressPolicyEntry | null;
      }),
  };
}
