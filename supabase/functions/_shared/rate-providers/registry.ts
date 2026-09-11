// _shared/rate-providers/registry.ts
//
// Loads a tenant's active, non-circuit-broken rate providers and builds
// both (a) the tool-schema the LLM is offered and (b) the dispatch map
// used to actually execute a tool_call. See types.ts and
// docs/smart-quote-module-design.md §11.

import { SupabaseClient } from "@supabase/supabase-js";
import type { RateProviderAdapter, ResolvedProviderConfig } from "./types.ts";

// Real adapters register themselves here. Of the user's "11 specified
// third-party quote rate platforms" (see design doc §9.8 for the full
// research), only SeaRates has genuinely public API documentation -- the
// other 5 distinct platforms (Freightify, VelocityOS, CargoRates.ai,
// Cargofive, Freightoscope) all gate their real API contract behind a
// sales/demo engagement, so no adapter is registered for them yet (building
// one without their real docs would mean fabricating a request/response
// shape -- exactly what §4's grounding principle exists to prevent).
//
// Registering an adapter here does NOT, by itself, offer it to the LLM or
// call it: a tenant must also have an active `rate_provider_configs` row
// for that `provider_name` (§9.4/§9.6) before it appears in `callable`.
// Zero tenants have one today, so this registration is inert in production
// until an admin configures a real SeaRates account.
const ADAPTERS = new Map<string, RateProviderAdapter>();

export function registerRateProviderAdapter(adapter: RateProviderAdapter): void {
  ADAPTERS.set(adapter.providerName, adapter);
}

import { searatesAdapter } from "./searates-provider.ts";
registerRateProviderAdapter(searatesAdapter);

// import { exampleAdapter } from "./example-provider.ts";
// registerRateProviderAdapter(exampleAdapter);   // <- pattern for a template/reference adapter, left commented:
//                                                     this one is not a real integration -- see example-provider.ts.

export interface TenantRateProviderRegistry {
  /** Providers with both a DB config AND a registered code adapter -- the only ones actually callable. */
  callable: Array<{ config: ResolvedProviderConfig; adapter: RateProviderAdapter }>;
  /** Configs present in the DB with no matching adapter yet -- logged, not offered to the LLM. Surfaces a real ops gap (a provider an admin configured but nobody built the adapter for) without failing the request. */
  unmatchedConfigCount: number;
}

/**
 * Single entry point: call once per generateSmartQuotes request. Returns
 * an empty `callable` array (not an error) when the tenant has no
 * providers configured, or none of them have a matching code adapter --
 * both are expected, normal states today.
 */
export async function loadTenantRateProviders(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
): Promise<TenantRateProviderRegistry> {
  const { data, error } = await (supabaseAdmin as any).rpc("get_tenant_rate_providers", {
    p_tenant_id: tenantId,
  });

  if (error || !Array.isArray(data)) {
    return { callable: [], unmatchedConfigCount: 0 };
  }

  const callable: TenantRateProviderRegistry["callable"] = [];
  let unmatched = 0;

  for (const row of data) {
    const adapter = ADAPTERS.get(row.provider_name);
    if (!adapter) {
      unmatched += 1;
      continue;
    }
    if (!row.api_key) {
      // Config exists but the vault secret didn't resolve -- same failure
      // mode already seen and documented for platform.llm_provider_configs
      // (audit doc §9). Treat identically: skip, don't call with a blank key.
      unmatched += 1;
      continue;
    }
    callable.push({
      adapter,
      config: {
        configId: row.config_id,
        providerName: row.provider_name,
        displayName: row.display_name,
        baseUrl: row.base_url,
        authScheme: row.auth_scheme,
        authHeaderName: row.auth_header_name,
        apiKey: row.api_key,
        timeoutMs: row.timeout_ms,
        priority: row.priority,
      },
    });
  }

  return { callable, unmatchedConfigCount: unmatched };
}

/**
 * Builds the OpenAI-compatible tool definition offered to the LLM, with
 * `provider` constrained to an enum of exactly the tenant's callable
 * providers -- never an open string. This is the fix for the exact
 * failure observed testing this live: given an unconstrained `provider`
 * string field, the model filled in "Xeneta" unprompted, a platform this
 * deployment has no adapter or credentials for at all.
 *
 * Returns null (omit the tool entirely) when there's nothing callable --
 * an empty enum is not a safe substitute for omitting the tool, since
 * some models will still attempt a call with a hallucinated value.
 */
export function getRateProviderTool(registry: TenantRateProviderRegistry): Record<string, unknown> | null {
  if (registry.callable.length === 0) return null;

  const providerNames = registry.callable.map((c) => c.config.providerName);

  return {
    type: "function",
    function: {
      name: "get_freight_rate",
      description:
        "Look up a live, real freight rate from one of this tenant's configured rate providers. " +
        "Only call this for the 'provider' values listed in the enum -- there is no provider available " +
        "beyond that list, regardless of what you may know about other freight rate platforms.",
      parameters: {
        type: "object",
        properties: {
          provider: { type: "string", enum: providerNames },
          origin: { type: "string" },
          destination: { type: "string" },
          mode: { type: "string", enum: ["ocean", "air", "road", "rail"] },
          container_type: { type: "string" },
        },
        required: ["provider", "origin", "destination", "mode"],
      },
    },
  };
}
