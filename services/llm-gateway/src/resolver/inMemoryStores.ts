// In-memory ResolverStores for P1.1. Bootstrap config comes from a
// JSON file pointed to by LLM_GATEWAY_CONFIG_PATH (default:
// ./gateway.config.json), or from an embedded fallback.
//
// P2 replaces this with database-backed stores reading from
// gateway.provider_configs, gateway.provider_models,
// gateway.provider_residency_map.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { ProviderKind } from '../types/gateway.types.js';
import { logger } from '../utils/logger.js';
import type {
  EgressPolicyEntry,
  ProviderConfigRecord,
  ProviderModelCatalogEntry,
  ResolverScopeKind,
  ResolverStores,
} from './types.js';

interface BootstrapConfig {
  provider_configs: ProviderConfigRecord[];
  provider_models: ProviderModelCatalogEntry[];
  egress_policy: EgressPolicyEntry[];
}

// Fallback used when no config file is present — keeps the dev
// experience seamless: a single platform_default → echo entry so
// the gateway always resolves to something.
const FALLBACK_BOOTSTRAP: BootstrapConfig = {
  provider_configs: [
    {
      scope_kind: 'platform_default',
      scope_id: '*',
      provider_kind: 'echo',
      model_id: 'echo-v1',
      is_pin: false,
      billing_mode: 'platform_paid',
    },
  ],
  provider_models: [
    {
      provider_kind: 'echo',
      model_id: 'echo-v1',
      capabilities: ['json_mode'],
    },
    {
      provider_kind: 'replay',
      model_id: 'replay-v1',
      capabilities: ['json_mode', 'tools', 'vision'],
    },
  ],
  egress_policy: [
    { provider_kind: 'echo', allowed_regions: ['us-east', 'us-west', 'eu-central', 'in-south'] },
    { provider_kind: 'replay', allowed_regions: ['us-east', 'us-west', 'eu-central', 'in-south'] },
  ],
};

function loadBootstrap(path: string): BootstrapConfig {
  try {
    const absolute = resolve(path);
    const raw = readFileSync(absolute, 'utf8');
    const parsed = JSON.parse(raw) as BootstrapConfig;
    if (!parsed.provider_configs || !Array.isArray(parsed.provider_configs)) {
      throw new Error('provider_configs missing or not an array');
    }
    logger.info('resolver bootstrap loaded', {
      path: absolute,
      config_count: parsed.provider_configs.length,
      model_count: parsed.provider_models?.length ?? 0,
    });
    return {
      provider_configs: parsed.provider_configs,
      provider_models: parsed.provider_models ?? [],
      egress_policy: parsed.egress_policy ?? [],
    };
  } catch (err) {
    logger.warn('resolver bootstrap file not loaded; using fallback', {
      path,
      reason: err instanceof Error ? err.message : String(err),
    });
    return FALLBACK_BOOTSTRAP;
  }
}

export function buildInMemoryStores(configPath?: string): ResolverStores {
  const path = configPath || process.env.LLM_GATEWAY_CONFIG_PATH || './gateway.config.json';
  const bootstrap = loadBootstrap(path);

  const configByKey = new Map<string, ProviderConfigRecord>();
  for (const cfg of bootstrap.provider_configs) {
    configByKey.set(`${cfg.scope_kind}::${cfg.scope_id}`, cfg);
  }

  const catalogByKey = new Map<string, ProviderModelCatalogEntry>();
  for (const entry of bootstrap.provider_models) {
    catalogByKey.set(`${entry.provider_kind}::${entry.model_id}`, entry);
  }

  const egressByProvider = new Map<ProviderKind, EgressPolicyEntry>();
  for (const e of bootstrap.egress_policy) {
    egressByProvider.set(e.provider_kind, e);
  }

  return {
    getProviderConfig: async (scope_kind: ResolverScopeKind, scope_id: string) => {
      return configByKey.get(`${scope_kind}::${scope_id}`) ?? null;
    },
    getModelCatalogEntry: async (provider_kind: ProviderKind, model_id: string) => {
      return catalogByKey.get(`${provider_kind}::${model_id}`) ?? null;
    },
    getEgressPolicy: async (provider_kind: ProviderKind) => {
      return egressByProvider.get(provider_kind) ?? null;
    },
  };
}

/**
 * Test helper — build stores directly from a literal config object.
 * Bypasses file I/O so unit tests don't need fixtures on disk.
 */
export function buildInMemoryStoresFromObject(bootstrap: BootstrapConfig): ResolverStores {
  const configByKey = new Map<string, ProviderConfigRecord>();
  for (const cfg of bootstrap.provider_configs) {
    configByKey.set(`${cfg.scope_kind}::${cfg.scope_id}`, cfg);
  }

  const catalogByKey = new Map<string, ProviderModelCatalogEntry>();
  for (const entry of bootstrap.provider_models) {
    catalogByKey.set(`${entry.provider_kind}::${entry.model_id}`, entry);
  }

  const egressByProvider = new Map<ProviderKind, EgressPolicyEntry>();
  for (const e of bootstrap.egress_policy) {
    egressByProvider.set(e.provider_kind, e);
  }

  return {
    getProviderConfig: async (scope_kind: ResolverScopeKind, scope_id: string) =>
      configByKey.get(`${scope_kind}::${scope_id}`) ?? null,
    getModelCatalogEntry: async (provider_kind: ProviderKind, model_id: string) =>
      catalogByKey.get(`${provider_kind}::${model_id}`) ?? null,
    getEgressPolicy: async (provider_kind: ProviderKind) =>
      egressByProvider.get(provider_kind) ?? null,
  };
}
