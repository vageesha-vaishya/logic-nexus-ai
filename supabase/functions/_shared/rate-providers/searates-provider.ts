// _shared/rate-providers/searates-provider.ts
//
// Real adapter for SeaRates (searates.com, a DP World company), built from
// their PUBLIC developer documentation at docs.searates.com -- researched
// 2026-09-11 in response to the user naming SeaRates among the "11
// specified third-party quote rate platforms" (docs/smart-quote-module-design.md
// §9/§10 item 9). Unlike example-provider.ts, this is a real integration
// against a real, documented API -- but see "WHAT IS VERIFIED vs. BEST-EFFORT"
// below: one piece (the exact GraphQL query body) could not be confirmed from
// public docs alone and must be validated on first real test.
//
// Of the 6 distinct platforms in the user's list (Freightify, SeaRates,
// VelocityOS, CargoRates.ai, Cargofive, Freightoscope -- the other 5 of the
// "11" numbered items were either duplicate URLs for these same platforms or
// third-party review articles, not platforms themselves), SeaRates is the
// ONLY one with genuinely public API documentation. The other 5 gate their
// real API contracts behind a sales/demo engagement -- building adapters for
// those now would mean fabricating a request/response shape, which is
// exactly what this entire module (§4's grounding principle) exists to
// avoid. See docs/smart-quote-module-design.md §9.8 for the full per-platform
// status and what's needed to unblock each one.
//
// WHAT IS VERIFIED (directly from docs.searates.com, fetched 2026-09-11):
//   - Auth flow for the Rate Management System / Booking System APIs:
//     GET https://www.searates.com/auth/platform-token?id=X&api_key=Y&login=Z&password=W
//     returns a bearer token; subsequent calls send `Authorization: Bearer <token>`.
//   - Geocoding/Autocomplete API (resolves a free-text place name into the
//     pointId the rates API needs): POST https://geocoding.searates.com/autocomplete/compact
//     with `api_key` as a query parameter and `{ query: "<text>" }` as the
//     JSON body; response is `{ data: [{ id, place, name, locode, iata, ... }] }`.
//   - The rates endpoint itself: POST https://rates.searates.com/graphql,
//     documented input fields (shippingType, pointIdFrom/pointIdTo or
//     coordinatesFrom/coordinatesTo, date, container, weight/weightUnit,
//     volume/volumeUnit) and documented response fields (`points[]`,
//     `General.totalPrice/totalCurrency/totalTransitTime/totalCo2`).
//
// WHAT IS BEST-EFFORT, NOT VERIFIED (flagged, not silently assumed):
//   - The exact GraphQL query document (operation name, how the documented
//     input fields nest into arguments, and the exact selection set) is not
//     shown in the public reference pages -- only the flat list of
//     input/output field names is. The query below is constructed from those
//     field names using the RMS API's own naming conventions and should be
//     validated against SeaRates' GraphQL schema (introspection, or their
//     Logistics Explorer playground if one is exposed to partners) before
//     this adapter is trusted with a real `rate_provider_configs` row.
//   - Whether the same `apiKey` value is reused for both the platform-token
//     exchange and the Geocoding API's `api_key` query parameter, or whether
//     SeaRates issues separate keys per API. Assumed reused here (both
//     credentials are described in the docs as coming from the same
//     "manager"-provisioned SeaRates account) -- verify on first real setup.
//
// Credential storage convention: `rate_provider_configs.vault_secret_name`
// for this provider must store a JSON string (not a bare token), since the
// platform-token exchange needs four values, not one:
//   { "platformId": "...", "apiKey": "...", "login": "...", "password": "..." }
// Set `auth_scheme` to 'oauth2_client_credentials' when configuring this
// provider -- the closest semantic match (long-lived credentials exchanged
// for a short-lived bearer token), even though the wire format isn't
// standard OAuth2. This adapter does its own auth entirely; it ignores
// `resolvedConfig.authHeaderName`.
//
// Known limitation: a fresh bearer token is requested on every fetchRate()
// call rather than cached and reused across calls. Correct, but wasteful --
// worth optimizing (cache the token for its actual validity window, once
// that's confirmed) once this adapter sees real call volume. Not done here
// to avoid adding shared, cross-request token-cache state to a first version
// of an adapter that hasn't been exercised against the real API even once.

import type { NormalizedRate, RateLookupRequest, RateProviderAdapter, ResolvedProviderConfig } from "./types.ts";

interface SearatesCredentials {
  platformId: string;
  apiKey: string;
  login: string;
  password: string;
}

function parseCredentials(raw: string): SearatesCredentials {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "SeaRates adapter: vault secret must be a JSON object " +
        '{"platformId","apiKey","login","password"} -- see searates-provider.ts header comment.',
    );
  }
  const c = parsed as Partial<SearatesCredentials>;
  if (!c.platformId || !c.apiKey || !c.login || !c.password) {
    throw new Error("SeaRates adapter: vault secret JSON is missing one of platformId/apiKey/login/password.");
  }
  return c as SearatesCredentials;
}

async function fetchBearerToken(creds: SearatesCredentials): Promise<string> {
  const url =
    `https://www.searates.com/auth/platform-token?id=${encodeURIComponent(creds.platformId)}` +
    `&api_key=${encodeURIComponent(creds.apiKey)}&login=${encodeURIComponent(creds.login)}` +
    `&password=${encodeURIComponent(creds.password)}`;
  const resp = await fetch(url, { method: "GET" });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`SeaRates platform-token exchange ${resp.status}: ${body.slice(0, 300)}`);
  }
  const text = await resp.text();
  // The exact response field name for the token isn't confirmed in public
  // docs (see header comment) -- accept the common shapes defensively
  // rather than assume one, and fall back to a bare-string body.
  try {
    const json: any = JSON.parse(text);
    const token = json?.token ?? json?.access_token ?? json?.bearer_token ?? json?.data?.token;
    if (typeof token === "string" && token.length > 0) return token;
    throw new Error(`unrecognized token response shape: ${JSON.stringify(json).slice(0, 200)}`);
  } catch {
    const bare = text.trim();
    if (bare.length > 0 && !bare.startsWith("{") && !bare.startsWith("<")) return bare;
    throw new Error(`SeaRates platform-token response was not parseable as a token: ${text.slice(0, 200)}`);
  }
}

async function geocodeToPointId(apiKey: string, query: string): Promise<string> {
  const url = `https://geocoding.searates.com/autocomplete/compact?api_key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`SeaRates geocoding ${resp.status} for "${query}": ${body.slice(0, 300)}`);
  }
  const json: any = await resp.json();
  const first = Array.isArray(json?.data) ? json.data[0] : undefined;
  if (!first?.id) {
    throw new Error(`SeaRates geocoding returned no location match for "${query}".`);
  }
  return String(first.id);
}

function toShippingType(mode: RateLookupRequest["mode"], containerType?: string): string {
  if (mode === "air") return "AIR";
  if (mode === "rail") return "RAIL_FCL";
  if (mode === "road") return "FTL";
  // ocean: default to FCL (this module only calls the tool for
  // container-based Smart Quote requests today); treat an explicit "LCL"
  // container type as LCL, everything else as FCL.
  return /lcl/i.test(containerType ?? "") ? "LCL" : "FCL";
}

// Best-effort GraphQL query -- see header comment: the operation name and
// exact nesting are not shown in public docs, only these input/output field
// names. Validate against SeaRates' real schema before production use.
const RATES_QUERY = `
  query GetRates($shippingType: ShippingType!, $pointIdFrom: String, $pointIdTo: String, $date: String, $container: ContainerType, $weight: Float, $weightUnit: WeightUnit, $volume: Float, $volumeUnit: VolumeUnit) {
    points(shippingType: $shippingType, pointIdFrom: $pointIdFrom, pointIdTo: $pointIdTo, date: $date, container: $container, weight: $weight, weightUnit: $weightUnit, volume: $volume, volumeUnit: $volumeUnit) {
      provider
      distance
      transitTime
    }
    General(shippingType: $shippingType, pointIdFrom: $pointIdFrom, pointIdTo: $pointIdTo, date: $date, container: $container, weight: $weight, weightUnit: $weightUnit, volume: $volume, volumeUnit: $volumeUnit) {
      totalPrice
      totalCurrency
      totalCo2
      totalTransitTime
      validityFrom
      validityTo
      spot
    }
  }
`;

export const searatesAdapter: RateProviderAdapter = {
  providerName: "searates",

  async fetchRate(request: RateLookupRequest, config: ResolvedProviderConfig): Promise<NormalizedRate> {
    const creds = parseCredentials(config.apiKey);

    const [token, pointIdFrom, pointIdTo] = await Promise.all([
      fetchBearerToken(creds),
      geocodeToPointId(creds.apiKey, request.origin),
      geocodeToPointId(creds.apiKey, request.destination),
    ]);

    const shippingType = toShippingType(request.mode, request.containerType);
    const today = new Date().toISOString().slice(0, 10);

    const resp = await fetch("https://rates.searates.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: RATES_QUERY,
        variables: {
          shippingType,
          pointIdFrom,
          pointIdTo,
          date: today,
          container: request.containerType ?? null,
          weight: request.weightKg ?? null,
          weightUnit: request.weightKg != null ? "KG" : null,
          volume: request.volumeCbm ?? null,
          volumeUnit: request.volumeCbm != null ? "M3" : null,
        },
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`SeaRates rates ${resp.status}: ${body.slice(0, 300)}`);
    }

    const json: any = await resp.json();
    if (Array.isArray(json?.errors) && json.errors.length > 0) {
      throw new Error(`SeaRates GraphQL error: ${JSON.stringify(json.errors).slice(0, 300)}`);
    }

    const general = json?.data?.General;
    if (!general || typeof general.totalPrice !== "number") {
      throw new Error(`SeaRates rates response missing General.totalPrice: ${JSON.stringify(json).slice(0, 300)}`);
    }

    const firstPoint = Array.isArray(json?.data?.points) ? json.data.points[0] : undefined;

    return {
      provider: "searates",
      origin: request.origin,
      destination: request.destination,
      mode: request.mode,
      containerType: request.containerType,
      carrier: firstPoint?.provider,
      baseRate: Number(general.totalPrice),
      currency: general.totalCurrency ?? "USD",
      surcharges: {},
      transitDays: general.totalTransitTime != null ? Number(general.totalTransitTime) : undefined,
      validUntil: general.validityTo ?? new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      sourceTimestamp: new Date().toISOString(),
      confidence: general.spot === false ? 0.9 : undefined,
      raw: json,
    };
  },
};
