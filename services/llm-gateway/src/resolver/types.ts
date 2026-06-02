// Types for the 6-layer provider-resolution cascade.
// Per design §3.1. Pure data — no React, no Express, no DB.

import type { BillingMode, ProviderKind } from '../types/gateway.types.js';

export type ResolverScopeKind =
  | 'feature_pin'
  | 'user'
  | 'franchisee'
  | 'tenant'
  | 'domain'
  | 'platform_default';

// Order matters: lower index = higher priority.
export const SCOPE_PRIORITY: ResolverScopeKind[] = [
  'feature_pin',
  'user',
  'franchisee',
  'tenant',
  'domain',
  'platform_default',
];

export interface ProviderConfigRecord {
  scope_kind: ResolverScopeKind;
  scope_id: string;
  provider_kind: ProviderKind;
  model_id: string;
  credentials_ref?: string | null;
  endpoint_url?: string | null;
  is_pin: boolean;
  fallback_provider_kind?: ProviderKind | null;
  fallback_model_id?: string | null;
  billing_mode: BillingMode;
  required_capabilities?: string[] | null;
}

export interface CallContext {
  user_id?: string;
  franchisee_id?: string;
  domain_id?: string;
  tenant_residency?: string;     // e.g. 'us-east', 'eu-central', 'in-south' — used by egress check
}

export interface ResolvedProvider {
  resolved_scope_kind: ResolverScopeKind;
  resolved_scope_id: string;
  provider_kind: ProviderKind;
  model_id: string;
  credentials_ref?: string | null;
  endpoint_url?: string | null;
  fallback_provider_kind?: ProviderKind | null;
  fallback_model_id?: string | null;
  billing_mode: BillingMode;
  is_pin: boolean;
  required_capabilities?: string[] | null;
}

export interface ProviderModelCatalogEntry {
  provider_kind: ProviderKind;
  model_id: string;
  capabilities: string[];        // e.g. ['tools','vision','json_mode']
  deprecated_at?: string | null;
  replacement_model_id?: string | null;
}

export interface EgressPolicyEntry {
  provider_kind: ProviderKind;
  allowed_regions: string[];     // tenant.tenant_residency must be ∈ this list
}

/**
 * Caller supplies these via the store-bundle to keep the resolver
 * pure + dependency-free. Phase P1.1: in-memory implementations.
 * Phase P2+: backed by gateway.provider_configs (table) +
 * gateway.provider_models (catalog) + gateway.provider_residency_map.
 */
export interface ResolverStores {
  /** Lookup config for (scope_kind, scope_id). null if no override at that scope. */
  getProviderConfig: (scope_kind: ResolverScopeKind, scope_id: string) => Promise<ProviderConfigRecord | null>;
  /** Lookup model capability metadata. */
  getModelCatalogEntry: (provider_kind: ProviderKind, model_id: string) => Promise<ProviderModelCatalogEntry | null>;
  /** Lookup egress policy for a provider. */
  getEgressPolicy: (provider_kind: ProviderKind) => Promise<EgressPolicyEntry | null>;
}
