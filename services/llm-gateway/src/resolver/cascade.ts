// 6-layer provider resolution algorithm.
//
// Per design §3.1: walk scopes in priority order; first match wins.
// feature_pin (highest) → user → franchisee → tenant → domain →
// platform_default (lowest). Pin layer short-circuits provider-override
// from InvokeOptions.
//
// Egress + capability validation run on the chosen config before
// returning. Pure logic — stores are injected so this file is testable
// without DB or HTTP.

import type { InvokeRequest } from '../types/gateway.types.js';
import { ResolverError } from './errors.js';
import {
  SCOPE_PRIORITY,
  type CallContext,
  type ResolvedProvider,
  type ResolverScopeKind,
  type ResolverStores,
  type ProviderConfigRecord,
} from './types.js';

function scopeKey(req: InvokeRequest, ctx: CallContext, kind: ResolverScopeKind): string | null {
  switch (kind) {
    case 'feature_pin':       return req.prompt_key;
    case 'user':              return ctx.user_id ?? null;
    case 'franchisee':        return ctx.franchisee_id ?? null;
    case 'tenant':            return req.tenant_id;
    case 'domain':            return ctx.domain_id ?? null;
    case 'platform_default':  return '*';
  }
}

export async function resolveProvider(
  req: InvokeRequest,
  ctx: CallContext,
  stores: ResolverStores,
): Promise<ResolvedProvider> {
  // ── 1. Walk the cascade and find the first matching config ──────────
  let chosen: ProviderConfigRecord | null = null;
  for (const kind of SCOPE_PRIORITY) {
    const id = scopeKey(req, ctx, kind);
    if (!id) continue;
    const cfg = await stores.getProviderConfig(kind, id);
    if (cfg) {
      chosen = cfg;
      break;
    }
  }

  if (!chosen) {
    throw new ResolverError(
      'PROVIDER_NOT_CONFIGURED',
      `no provider config found for tenant ${req.tenant_id} / prompt ${req.prompt_key}`,
      { tenant_id: req.tenant_id, prompt_key: req.prompt_key },
    );
  }

  // ── 2. is_pin short-circuits provider/model overrides from InvokeOptions ──
  const optionsOverride = !chosen.is_pin && req.options ? req.options : undefined;
  const provider_kind = optionsOverride?.provider_override ?? chosen.provider_kind;
  const model_id = optionsOverride?.model_override ?? chosen.model_id;

  // ── 3. Capability validation ───────────────────────────────────────
  const required = mergeCapabilities(chosen.required_capabilities, req.required_capabilities);
  if (required.length > 0) {
    const catalog = await stores.getModelCatalogEntry(provider_kind, model_id);
    if (!catalog) {
      throw new ResolverError(
        'MODEL_CAPABILITY_MISMATCH',
        `model ${provider_kind}:${model_id} not in catalog; cannot verify capabilities`,
        { provider_kind, model_id, required },
      );
    }
    const missing = required.filter((cap) => !catalog.capabilities.includes(cap));
    if (missing.length > 0) {
      throw new ResolverError(
        'MODEL_CAPABILITY_MISMATCH',
        `model ${provider_kind}:${model_id} missing capabilities: ${missing.join(', ')}`,
        { provider_kind, model_id, missing, required, supported: catalog.capabilities },
      );
    }
  }

  // ── 4. Egress / residency check ────────────────────────────────────
  if (ctx.tenant_residency) {
    const egress = await stores.getEgressPolicy(provider_kind);
    if (egress && !egress.allowed_regions.includes(ctx.tenant_residency)) {
      throw new ResolverError(
        'EGRESS_FORBIDDEN',
        `provider ${provider_kind} not allowed for residency ${ctx.tenant_residency}`,
        {
          provider_kind,
          tenant_residency: ctx.tenant_residency,
          allowed_regions: egress.allowed_regions,
        },
      );
    }
  }

  return {
    resolved_scope_kind: chosen.scope_kind,
    resolved_scope_id: chosen.scope_id,
    provider_kind,
    model_id,
    credentials_ref: chosen.credentials_ref,
    endpoint_url: chosen.endpoint_url,
    fallback_provider_kind: chosen.fallback_provider_kind,
    fallback_model_id: chosen.fallback_model_id,
    billing_mode: chosen.billing_mode,
    is_pin: chosen.is_pin,
    required_capabilities: chosen.required_capabilities,
  };
}

function mergeCapabilities(a?: string[] | null, b?: string[] | null): string[] {
  const set = new Set<string>();
  (a ?? []).forEach((c) => set.add(c));
  (b ?? []).forEach((c) => set.add(c));
  return Array.from(set);
}
