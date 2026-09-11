// _shared/rate-providers/example-provider.ts
//
// TEMPLATE, not a real integration. This is not wired into the registry
// (see registry.ts's commented-out import) and calling it against a real
// base_url will fail unless that URL happens to implement this exact
// made-up request/response shape, which no real platform does.
//
// Purpose: show the pattern a real adapter follows, so that once the
// actual 11 platforms are named (docs/smart-quote-module-design.md §11),
// building each one is "copy this file, replace the fetch call and the
// response mapping with that platform's real API contract" rather than
// designing the pattern from scratch each time.
//
// A REAL adapter needs, at minimum:
//   1. That platform's actual auth mechanism (many freight-rate APIs use
//      OAuth2 client-credentials, not a static bearer token -- config.authScheme
//      exists precisely so different adapters can branch on this).
//   2. That platform's actual request shape (query params vs. POST body,
//      their own field names for origin/destination/mode/container).
//   3. That platform's actual response shape, mapped field-by-field into
//      NormalizedRate -- most real freight-rate APIs return far more
//      detail than NormalizedRate captures; only map what the module
//      actually uses (see types.ts), don't grow NormalizedRate to
//      capture everything "just in case."
//   4. Real error handling for that platform's specific error responses
//      (rate limit headers, partial-match "no exact rate, here's a
//      range" responses, etc.) -- throw with a message the orchestrator's
//      classifyError() can categorize, or extend classifyError() if a
//      platform has an error shape none of the existing categories fit.

import type { NormalizedRate, RateLookupRequest, RateProviderAdapter, ResolvedProviderConfig } from "./types.ts";

export const exampleAdapter: RateProviderAdapter = {
  providerName: "example-provider",

  async fetchRate(request: RateLookupRequest, config: ResolvedProviderConfig): Promise<NormalizedRate> {
    const authHeaders: Record<string, string> =
      config.authScheme === "bearer"
        ? { Authorization: `Bearer ${config.apiKey}` }
        : config.authScheme === "api_key_header"
        ? { [config.authHeaderName || "X-API-Key"]: config.apiKey }
        : {}; // basic / oauth2_client_credentials need their own real branch when a real platform needs them

    const resp = await fetch(`${config.baseUrl.replace(/\/$/, "")}/v1/rates/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        origin: request.origin,
        destination: request.destination,
        mode: request.mode,
        container_type: request.containerType,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`example-provider ${resp.status}: ${body.slice(0, 300)}`);
    }

    const json: any = await resp.json();

    // This mapping is entirely made up -- a real adapter's mapping comes
    // from that platform's actual documented response schema, not a guess.
    return {
      provider: "example-provider",
      origin: request.origin,
      destination: request.destination,
      mode: request.mode,
      containerType: request.containerType,
      carrier: json.carrier_name,
      baseRate: Number(json.base_rate ?? 0),
      currency: json.currency ?? "USD",
      surcharges: json.surcharges ?? {},
      transitDays: json.transit_days ? Number(json.transit_days) : undefined,
      validUntil: json.valid_until ?? new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      sourceTimestamp: json.quoted_at ?? new Date().toISOString(),
      confidence: typeof json.confidence === "number" ? json.confidence : undefined,
      raw: json,
    };
  },
};
