import { getCorsHeaders } from "../_shared/cors.ts"
import { extractBearerToken, requireAuth } from "../_shared/auth.ts"
import { sanitizeForLLM } from "../_shared/pii-guard.ts"
import { logAiCall } from "../_shared/audit.ts"
import { serveWithLogger, Logger } from "../_shared/logger.ts"
import { callLLM, callLLMWithTools, LlmCallContext, ToolDefinition } from "../_shared/llm-gateway.ts"
import { loadTenantRateProviders, getRateProviderTool } from "../_shared/rate-providers/registry.ts"
import { executeRateToolCall } from "../_shared/rate-providers/orchestrator.ts"
import { NormalizedRate } from "../_shared/rate-providers/types.ts"

declare const Deno: any;

// Mock Knowledge Base for fallback
const KNOWLEDGE_BASE = {
  commodities: [
    { keywords: ["coal", "ore", "sand", "gravel"], unit: "ton", type: "Bulk", hts: "2701.12", scheduleB: "2701.12.0000" },
    { keywords: ["iphone", "phone", "laptop", "computer", "electronics"], unit: "kg", type: "General Cargo", hts: "8517.12", scheduleB: "8517.12.0000" },
    { keywords: ["banana", "fruit", "vegetable", "meat", "fish"], unit: "kg", type: "Perishable", hts: "0803.10", scheduleB: "0803.10.0000" },
    { keywords: ["oil", "gas", "liquid"], unit: "cbm", type: "Liquid", hts: "2709.00", scheduleB: "2709.00.0000" },
    { keywords: ["furniture", "sofa", "table"], unit: "cbm", type: "General Cargo", hts: "9403.50", scheduleB: "9403.50.0000" },
    { keywords: ["car", "vehicle", "truck"], unit: "unit", type: "RoRo", hts: "8703.23", scheduleB: "8703.23.0000" },
  ],
  ports: [
    { code: "USLAX", name: "Los Angeles", country: "US", type: "ocean" },
    { code: "CNSHA", name: "Shanghai", country: "CN", type: "ocean" },
    { code: "NLRTM", name: "Rotterdam", country: "NL", type: "ocean" },
    { code: "SGSIN", name: "Singapore", country: "SG", type: "ocean" },
  ],
  airports: [
    { code: "LAX", name: "Los Angeles Int", country: "US", type: "air" },
    { code: "PVG", name: "Shanghai Pudong", country: "CN", type: "air" },
    { code: "LHR", name: "London Heathrow", country: "UK", type: "air" },
    { code: "DXB", name: "Dubai Int", country: "AE", type: "air" },
  ],
  rail_terminals: [
    { code: "DEDUI", name: "Duisburg Intermodal Terminal", country: "DE", type: "rail" },
    { code: "CNXIA", name: "Xi'an International Port", country: "CN", type: "rail" },
    { code: "PLMAL", name: "Małaszewicze Terminal", country: "PL", type: "rail" },
    { code: "KZDOZ", name: "Dostyk", country: "KZ", type: "rail" },
  ]
};

serveWithLogger(async (req, logger, supabase) => {
  const headers = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const correlationId = crypto.randomUUID();

    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      logger.warn("Rejecting unauthenticated request", { correlationId, error: authError });
      return new Response(
        JSON.stringify({ error: authError || "Unauthorized" }),
        { status: 401, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }

    const { data: roleRows, error: roleError } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .not('tenant_id', 'is', null)
      .limit(1);

    const tenantId: string | null = roleRows?.[0]?.tenant_id ?? null;
    if (roleError || !tenantId) {
      logger.warn("Caller has no tenant assignment", { correlationId, userId: user.id, error: roleError?.message });
      return new Response(
        JSON.stringify({ error: "No tenant assignment for this user" }),
        { status: 403, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }

    const { action, payload } = await req.json()
    logger.info(`Action: ${action}, correlationId: ${correlationId}, userId: ${user?.id ?? 'anonymous'}`);

    // Get User Token
    const authHeader = req.headers.get('Authorization');
    const userToken = authHeader ? extractBearerToken(authHeader) ?? undefined : undefined;

    let result = {};

    switch (action) {
      case 'suggest_unit':
        result = await suggestUnit(payload.commodity);
        break;
      case 'classify_commodity':
        result = await classifyCommodity(payload.commodity);
        break;
      case 'predict_price':
        result = await predictPrice(payload);
        break;
      case 'generate_smart_quotes':
        result = await generateSmartQuotes(payload, supabase, logger, tenantId, userToken, user.id);
        break;
      case 'lookup_codes':
        result = await lookupCodes(payload.query, payload.mode, supabase);
        break;
      case 'validate_compliance':
        result = await validateCompliance(payload);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
            ...headers, 
            "Content-Type": "application/json",
            "Content-Language": "en"
        },
        status: 200 
      }
    )

  } catch (error: any) {
    logger.error("Error processing request", { error: error.message || String(error) });
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { 
        headers: { 
            ...headers, 
            "Content-Type": "application/json",
            "Content-Language": "en"
        },
        status: 400 
      }
    )
  }
}, "ai-advisor")

// --- Helper Functions ---

async function suggestUnit(commodity: string) {
  if (!commodity) return { unit: 'kg', confidence: 0.1, source: 'default' };
  const lowerComm = commodity.toLowerCase();
  const match = KNOWLEDGE_BASE.commodities.find(k => k.keywords.some(kw => lowerComm.includes(kw)));
  if (match) return { unit: match.unit, confidence: 0.8, source: 'heuristic' };
  if (lowerComm.length > 3) return { unit: 'kg', confidence: 0.4, source: 'ai-mock' };
  return { unit: 'kg', confidence: 0.1, source: 'fallback' };
}

async function classifyCommodity(commodity: string) {
  if (!commodity) return { type: 'General Cargo', confidence: 0.5 };
  const lowerComm = commodity.toLowerCase();
  const match = KNOWLEDGE_BASE.commodities.find(k => k.keywords.some(kw => lowerComm.includes(kw)));
  if (match) return { type: match.type, hts: match.hts, scheduleB: match.scheduleB, confidence: 0.9, source: 'heuristic' };
  return { type: 'General Cargo', confidence: 0.3, source: 'default' };
}

async function predictPrice(payload: any) {
  const basePrice = 1000; 
  const randomFactor = 0.8 + Math.random() * 0.4; 
  return {
    predicted_price: Math.round(basePrice * randomFactor),
    confidence_interval: { low: Math.round(basePrice * 0.8), high: Math.round(basePrice * 1.2) },
    trend: Math.random() > 0.5 ? 'increasing' : 'stable',
    source: 'historical_model'
  };
}

async function lookupCodes(query: string, mode: string, supabase: any) {
    if (!query || query.length < 2) return { suggestions: [] };
    const lowerQ = query.toLowerCase();
    let source: any[] = [];
    if (mode === 'ocean') source = KNOWLEDGE_BASE.ports;
    else if (mode === 'air') source = KNOWLEDGE_BASE.airports;
    else if (mode === 'rail') source = KNOWLEDGE_BASE.rail_terminals;
    else return { suggestions: [] }; 
    const suggestions = source.filter(item => 
        item.code.toLowerCase().includes(lowerQ) || 
        item.name.toLowerCase().includes(lowerQ) ||
        item.country.toLowerCase().includes(lowerQ)
    ).map(item => ({ label: `${item.name} (${item.code})`, value: item.code, details: item }));
    
    try {
      // Enhance with real IDs from ports_locations when available
      const { data, error } = await supabase
        .from('ports_locations')
        .select('id, location_name, location_code, location_type, country, city')
        .or(`location_code.ilike.%${query}%,location_name.ilike.%${query}%`)
        .limit(10);
      
      if (!error && Array.isArray(data)) {
        const byCode = new Map<string, any>();
        for (const row of data) {
          if (row.location_code) byCode.set(String(row.location_code).toUpperCase(), row);
        }
        // Merge IDs into suggestions where codes match
        for (const s of suggestions) {
          const codeKey = String(s.value || s.details?.code || '').toUpperCase();
          const match = byCode.get(codeKey);
          if (match) {
            s.details = {
              ...s.details,
              id: match.id,
              name: match.location_name || s.details?.name,
              code: match.location_code || s.details?.code,
              country: match.country || s.details?.country,
              type: match.location_type || s.details?.type,
              city: match.city || s.details?.city
            };
          }
        }
      }
    } catch (_err) {
      // Silent fallback to mock suggestions when DB unavailable
    }
    
    return { suggestions };
}

// ─── Maritime chokepoint reference (Suez / Panama) ─────────────────────
//
// Verified via live web search 2026-09-11 -- NOT from the model's training
// data, which is stale and would either miss 2026's toll changes entirely
// or (worse) confidently state the pre-crisis Suez/Cape routing norm that
// no longer holds. This is a dated snapshot, not a live feed: the values
// LAST-RESORT FALLBACK ONLY (see buildMaritimeContext below). The primary
// source is now the admin-editable public.maritime_advisories table
// (docs/smart-quote-module-design.md §6/§10 item 2) -- this hardcoded
// snapshot is used only if that query itself errors (DB unreachable),
// never when the query succeeds but simply returns no matching rows,
// since an empty-but-successful result is a real fact ("no known active
// advisory for this chokepoint right now") that this stale constant must
// not override. Kept around specifically so a maritime_advisories outage
// degrades to today's old behavior rather than to no context at all.
// Values below need a human to re-verify and bump SOURCED_AT periodically
// -- see docs/smart-quote-module-design.md "Maintenance" for the
// suggested cadence and source links. Injected into the prompt as
// read-only context the model must not contradict or embellish -- same
// STRICT GROUNDING pattern already used for markets.daily_brief.
const MARITIME_REFERENCE = {
  sourcedAt: "2026-09-11",
  suez: {
    tollTrend:
      "Suez Canal Authority raised transit tolls three times in 2026 (Mar 1, May 1, Jul 15); " +
      "containership tier surcharge is ~12% on top of the base tariff, which has been unchanged since 2024.",
    routingReality:
      "Despite the toll increases, most carriers are NOT actually transiting Suez right now. Ongoing Houthi " +
      "attacks in the Red Sea have kept the large majority of Asia-Europe and Asia-US East Coast services on " +
      "Cape of Good Hope diversion since late 2023 -- Suez traffic in 2026 remains roughly 60% below pre-crisis " +
      "levels, and the industry expects this to continue through at least 2027.",
    costImpact:
      "Cape diversion adds ~10-14 days transit and a war-risk/diversion surcharge of roughly $200-800 per " +
      "container; the per-TEU cost differential between a (rare) Suez transit and the Cape diversion routing " +
      "most carriers actually use is roughly $200-400/TEU.",
  },
  panama: {
    tollTrend:
      "Panama Canal Authority has frozen its main toll structure through September 30, 2026. Container vessels " +
      "are charged per laden TEU, roughly $35-45/TEU (so ~$70-90 per 40ft/2-TEU container), plus a fixed " +
      "per-transit vessel fee that is not directly allocable to an individual shipper's container.",
    routingReality:
      "Panama routing (used for Asia <-> US East/Gulf Coast and Caribbean lanes) has not seen the same disruption " +
      "as Suez; it remains the standard routing for those lanes in 2026, subject to normal seasonal draft " +
      "restrictions.",
  },
} as const;

// FALLBACK ONLY (see buildMaritimeContext below) -- deliberately coarse
// keyword/region heuristic matched against the free-text origin/destination
// display strings. Used only when the real port/region lookup (§10 item 4,
// classifySuezSide/classifyPanamaSide below) isn't available for this
// request -- no originDetails/destinationDetails id (an older caller, or
// LocationAutocomplete never resolved a real location), or the resolved
// country isn't in the real lookup's classification sets. A false negative
// just means the model gets no canal guidance (falls back to its own,
// weaker judgement) rather than anything actively wrong, and a false
// positive just adds a short, accurate paragraph that happens not to
// apply -- a stricter guardrail than the alternative either way.
const SUEZ_SIDE_A = ["china", "hong kong", "shanghai", "shenzhen", "ningbo", "qingdao", "vietnam", "singapore", "malaysia", "thailand", "india", "japan", "korea", "uae", "dubai", "taiwan"];
const SUEZ_SIDE_B = ["netherlands", "rotterdam", "germany", "hamburg", "belgium", "antwerp", "uk", "united kingdom", "london", "felixstowe", "france", "le havre", "italy", "genoa", "spain", "valencia", "mediterranean"];
const PANAMA_SIDE_A = ["china", "hong kong", "shanghai", "shenzhen", "vietnam", "singapore", "japan", "korea", "taiwan"];
const PANAMA_SIDE_B = ["usa", "united states", "new york", "savannah", "charleston", "miami", "houston", "gulf coast", "caribbean", "jamaica", "panama", "colombia", "brazil"];

function matchesAny(value: string, keywords: string[]): boolean {
    const v = value.toLowerCase();
    return keywords.some((k) => v.includes(k));
}

// Real port/region lookup (docs/smart-quote-module-design.md §10 item 4),
// replacing the keyword heuristic above as the PRIMARY path. Same
// conceptual structure as the old side-A/side-B keyword lists -- these are
// just backed by ports_locations' real `country`/`state_province` columns,
// looked up by the real UUID LocationAutocomplete already resolves
// (originDetails.id/destinationDetails.id), instead of substring-matching
// whatever free-text label happened to be typed. Built from the actual 59
// distinct country values present in ports_locations today (checked live,
// 2026-09-11), not a guessed list.
//
// A country can legitimately belong to more than one set (e.g. China is
// both a Suez-side and a Panama-side "Asia" origin -- which canal actually
// matters depends on the OTHER end of the route, decided in
// buildMaritimeContext below, exactly like the old keyword lists worked).
const REAL_SUEZ_SIDE_A_COUNTRIES = new Set([
    "china", "hong kong", "taiwan", "japan", "south korea", "singapore", "malaysia", "thailand",
    "vietnam", "indonesia", "philippines", "india", "sri lanka", "bangladesh", "pakistan",
    "united arab emirates", "saudi arabia", "qatar", "oman",
]);
const REAL_SUEZ_SIDE_B_COUNTRIES = new Set([
    "netherlands", "germany", "united kingdom", "belgium", "france", "italy", "spain", "ireland",
    "portugal", "sweden", "denmark", "norway", "finland", "poland", "greece", "israel", "turkey",
]);
// Deliberately narrower than SUEZ_SIDE_A -- South Asia/Middle East origins
// don't typically route to the US via Panama (same restriction the old
// PANAMA_SIDE_A keyword list already applied by simply omitting India/UAE).
const REAL_PANAMA_SIDE_A_COUNTRIES = new Set([
    "china", "hong kong", "taiwan", "japan", "south korea", "singapore", "malaysia", "thailand",
    "vietnam", "indonesia", "philippines",
]);
// Non-US Americas-Atlantic side of Panama -- from the actual country values
// present in ports_locations, not every plausible Caribbean nation.
const REAL_PANAMA_SIDE_B_OTHER_COUNTRIES = new Set(["panama", "colombia", "brazil", "uruguay", "argentina"]);

// A country-level classification can't distinguish US East/Gulf (Panama-
// relevant from Asia) from US West Coast (direct trans-Pacific, no canal
// needed) -- unlike every other country here, the US genuinely has ports on
// both sides. ports_locations.state_province is populated for 609/613
// (99.3%) of its US rows (checked live), which is precise enough to make
// this distinction for real instead of guessing "USA" means one coast.
// Values are a real, if imperfect, mix of 2-letter codes and full names
// (plus some city/facility names that clearly belong in a different column
// -- those simply won't match either set below and fall through to "can't
// tell," the same safe failure mode as an unrecognized country).
const US_WEST_COAST_STATES = new Set([
    "ca", "california", "or", "oregon", "wa", "washington", "ak", "alaska", "hi", "hawaii",
]);

function isUsCountry(country: string): boolean {
    const c = country.trim().toLowerCase();
    return c === "usa" || c === "united states" || c === "united states of america";
}

function isUsEastOrGulfCoast(country: string, stateProvince: string | null): boolean {
    if (!isUsCountry(country)) return false;
    const s = String(stateProvince || "").trim().toLowerCase();
    if (!s) return false; // no state on record -- can't tell, don't guess which coast
    return !US_WEST_COAST_STATES.has(s);
}

function isRealPanamaSideB(country: string, stateProvince: string | null): boolean {
    if (isUsEastOrGulfCoast(country, stateProvince)) return true;
    return REAL_PANAMA_SIDE_B_OTHER_COUNTRIES.has(country.trim().toLowerCase());
}

interface PortRegionInfo { country: string; stateProvince: string | null; }

// One query, both ports, by their real ports_locations UUIDs -- returns
// null for either side whenever a real id isn't available or the row
// wasn't found, so the caller can fall back to the keyword heuristic
// cleanly rather than half-apply the real lookup to only one side.
async function lookupPortRegions(
    supabase: any,
    originId?: string,
    destinationId?: string,
): Promise<{ origin: PortRegionInfo | null; destination: PortRegionInfo | null }> {
    const ids = [originId, destinationId].filter((id): id is string => !!id);
    if (ids.length === 0) return { origin: null, destination: null };

    try {
        const { data, error } = await supabase
            .from('ports_locations')
            .select('id, country, state_province')
            .in('id', ids);

        if (error || !data) return { origin: null, destination: null };

        const byId = new Map(data.map((row: any) => [row.id, row]));
        const toInfo = (id?: string): PortRegionInfo | null => {
            if (!id || !byId.has(id)) return null;
            const row: any = byId.get(id);
            const country = String(row.country || '').trim();
            if (!country) return null;
            return { country, stateProvince: row.state_province || null };
        };

        return { origin: toInfo(originId), destination: toInfo(destinationId) };
    } catch {
        return { origin: null, destination: null };
    }
}

function fallbackMaritimeContext(chokepoint: 'suez' | 'panama'): string {
    const label = chokepoint === 'suez' ? 'SUEZ CANAL' : 'PANAMA CANAL';
    const ref = MARITIME_REFERENCE[chokepoint];
    const bits = chokepoint === 'suez'
        ? [ref.tollTrend, (ref as typeof MARITIME_REFERENCE.suez).routingReality, (ref as typeof MARITIME_REFERENCE.suez).costImpact]
        : [ref.tollTrend, (ref as typeof MARITIME_REFERENCE.panama).routingReality];
    return `${label} CONTEXT (as of ${MARITIME_REFERENCE.sourcedAt}, fallback snapshot -- advisories table unavailable): ${bits.filter(Boolean).join(' ')}`;
}

// Queries public.maritime_advisories (docs/smart-quote-module-design.md
// §6/§10 item 2) for every active, currently-effective advisory matching
// a given chokepoint, and concatenates them into one dated context block
// -- same STRICT GROUNDING pattern as before, just sourced from an
// admin-editable table instead of a hardcoded constant. Never throws:
// a query error degrades to the hardcoded MARITIME_REFERENCE snapshot for
// that chokepoint (see its comment above for why that's the right
// fallback), while a query that succeeds but returns zero rows correctly
// produces no context at all -- "nothing currently on record" is itself
// real information the STRICT GROUNDING prompt rule (§8, rule 9) already
// knows how to handle (say nothing rather than guess).
async function fetchAdvisoryContext(supabase: any, chokepoint: 'suez' | 'panama'): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    try {
        const { data, error } = await supabase
            .from('maritime_advisories')
            .select('headline, cost_impact_text, transit_impact_text')
            .eq('chokepoint', chokepoint)
            .eq('is_active', true)
            .or(`effective_from.is.null,effective_from.lte.${today}`)
            .or(`effective_to.is.null,effective_to.gte.${today}`)
            .order('effective_from', { ascending: true, nullsFirst: true });

        if (error) {
            return fallbackMaritimeContext(chokepoint);
        }
        if (!data || data.length === 0) {
            return '';
        }

        const label = chokepoint === 'suez' ? 'SUEZ CANAL' : 'PANAMA CANAL';
        const body = data
            .map((row: any) => [row.headline, row.cost_impact_text, row.transit_impact_text].filter(Boolean).join(' '))
            .join(' ');
        return `${label} CONTEXT (advisories current as of ${today}): ${body}`;
    } catch {
        return fallbackMaritimeContext(chokepoint);
    }
}

async function buildMaritimeContext(
    supabase: any,
    origin: string,
    destination: string,
    mode: string,
    originDetails?: { id?: string } | null,
    destinationDetails?: { id?: string } | null,
): Promise<string> {
    if (String(mode || '').toLowerCase() !== 'ocean') return '';

    let suezRoute = false;
    let panamaRoute = false;
    let classifiedFromRealData = false;

    if (originDetails?.id && destinationDetails?.id) {
        const regions = await lookupPortRegions(supabase, originDetails.id, destinationDetails.id);
        if (regions.origin && regions.destination) {
            const oc = regions.origin.country.toLowerCase();
            const dc = regions.destination.country.toLowerCase();
            const oSuezA = REAL_SUEZ_SIDE_A_COUNTRIES.has(oc);
            const dSuezA = REAL_SUEZ_SIDE_A_COUNTRIES.has(dc);
            const oSuezB = REAL_SUEZ_SIDE_B_COUNTRIES.has(oc);
            const dSuezB = REAL_SUEZ_SIDE_B_COUNTRIES.has(dc);
            const oPanamaA = REAL_PANAMA_SIDE_A_COUNTRIES.has(oc);
            const dPanamaA = REAL_PANAMA_SIDE_A_COUNTRIES.has(dc);
            const oPanamaB = isRealPanamaSideB(regions.origin.country, regions.origin.stateProvince);
            const dPanamaB = isRealPanamaSideB(regions.destination.country, regions.destination.stateProvince);

            // "Classified" means at least one side matched a known bucket --
            // if neither country appears in any of these real sets at all
            // (e.g. Australia <-> New Zealand), that's a genuine "no chokepoint
            // applies" answer from real data, not a lookup failure, so it
            // should NOT fall through to the free-text keyword heuristic below.
            classifiedFromRealData = oSuezA || dSuezA || oSuezB || dSuezB || oPanamaA || dPanamaA || oPanamaB || dPanamaB;
            suezRoute = (oSuezA && dSuezB) || (dSuezA && oSuezB);
            panamaRoute = (oPanamaA && dPanamaB) || (dPanamaA && oPanamaB);
        }
    }

    if (!classifiedFromRealData) {
        // Real lookup unavailable (no location ids on this request) or found
        // nothing recognizable for either port -- fall back to the original
        // free-text heuristic rather than silently produce no context at all.
        const o = String(origin || '');
        const d = String(destination || '');
        suezRoute =
            (matchesAny(o, SUEZ_SIDE_A) && matchesAny(d, SUEZ_SIDE_B)) ||
            (matchesAny(d, SUEZ_SIDE_A) && matchesAny(o, SUEZ_SIDE_B));
        panamaRoute =
            (matchesAny(o, PANAMA_SIDE_A) && matchesAny(d, PANAMA_SIDE_B)) ||
            (matchesAny(d, PANAMA_SIDE_A) && matchesAny(o, PANAMA_SIDE_B));
    }

    if (!suezRoute && !panamaRoute) return '';

    const [suezContext, panamaContext] = await Promise.all([
        suezRoute ? fetchAdvisoryContext(supabase, 'suez') : Promise.resolve(''),
        panamaRoute ? fetchAdvisoryContext(supabase, 'panama') : Promise.resolve(''),
    ]);

    return [suezContext, panamaContext].filter(Boolean).join(' ');
}

// Deliberately coarse, same spirit as the SUEZ/PANAMA keyword lists above --
// public.duty_rates.jurisdiction is CHECK-constrained to only 4 values
// ('US','EU','CN','UK'), and ports_locations.country_code is unpopulated
// for every row today, so the only usable signal is the free-text country
// name already present in destinationDetails.formatted_address. A false
// negative (an EU country name this list misses) just means no duty
// context is offered, same as today; there's no false-positive risk since
// an unmatched jurisdiction returns no context at all.
const EU_COUNTRY_NAMES = new Set([
    "netherlands", "germany", "france", "italy", "spain", "belgium", "poland", "austria",
    "portugal", "ireland", "sweden", "denmark", "finland", "greece", "czech republic",
    "czechia", "hungary", "romania", "bulgaria", "croatia", "slovakia", "slovenia",
    "lithuania", "latvia", "estonia", "luxembourg", "malta", "cyprus",
]);

function resolveDutyJurisdiction(country: string): "US" | "EU" | "CN" | "UK" | null {
    const c = String(country || '').trim().toLowerCase();
    if (!c) return null;
    if (c === 'usa' || c === 'us' || c === 'united states' || c === 'united states of america') return 'US';
    if (c === 'china' || c === 'cn' || c === "people's republic of china") return 'CN';
    if (c === 'uk' || c === 'united kingdom' || c === 'great britain' || c === 'england') return 'UK';
    if (EU_COUNTRY_NAMES.has(c)) return 'EU';
    return null;
}

// Real duty-rate lookup against public.duty_rates (docs/smart-quote-module-design.md
// §10 item 5 -- schema already existed, was never queried anywhere before this).
// Informational only, by design: every row in this table today is
// calculation_method-equivalent "ad_valorem" (a PERCENTAGE of the shipment's
// declared customs value) -- and no declared value is captured anywhere in
// the Smart Quote flow (weight/volume/container count exist; a commercial/
// customs value does not). A percentage without a value can't produce a
// real dollar figure, so this never computes one -- it only surfaces the
// real, sourced RATE as context the model may cite informationally
// (regulatory_info.customs_procedures), while price_breakdown.taxes stays
// grounded at 0 unconditionally (enforced in code, see applyDynamicPricing --
// not left to the prompt alone). Coverage is intentionally narrow today
// (30 seed HTS codes, 4 jurisdictions): a query that finds nothing is the
// overwhelmingly common, correct case, not a failure.
async function buildDutyContext(supabase: any, htsCode: string, destinationCountry: string, logger?: Logger): Promise<string> {
    const jurisdiction = resolveDutyJurisdiction(destinationCountry);
    const cleanHts = String(htsCode || '').trim();
    if (!jurisdiction || !cleanHts) return '';

    try {
        const { data: htsRow, error: htsError } = await supabase
            .from('aes_hts_codes')
            .select('id, description')
            .eq('hts_code', cleanHts)
            .maybeSingle();

        if (htsError || !htsRow) return '';

        const today = new Date().toISOString().slice(0, 10);
        const { data: dutyRows, error: dutyError } = await supabase
            .from('duty_rates')
            .select('rate_type, ad_valorem_rate, specific_amount, specific_unit, effective_date')
            .eq('aes_hts_id', htsRow.id)
            .eq('jurisdiction', jurisdiction)
            .lte('effective_date', today)
            .or(`end_date.is.null,end_date.gte.${today}`)
            .order('effective_date', { ascending: false })
            .limit(1);

        if (dutyError) {
            logger?.warn("duty_rates query failed, omitting duty context:", { error: dutyError.message });
            return '';
        }
        if (!dutyRows || dutyRows.length === 0) return '';

        const row = dutyRows[0];
        const rateText = row.ad_valorem_rate != null
            ? `${(Number(row.ad_valorem_rate) * 100).toFixed(2)}% ad valorem`
            : (row.specific_amount != null ? `$${row.specific_amount} per ${row.specific_unit || 'unit'}` : null);
        if (!rateText) return '';

        return (
            `DUTY RATE CONTEXT (informational only, real sourced rate): the ${jurisdiction} ${row.rate_type} duty rate for ` +
            `HTS ${cleanHts} (${htsRow.description}) is ${rateText}, effective ${row.effective_date}. You may cite this rate in ` +
            `regulatory_info.customs_procedures as informational context for the buyer. Do NOT compute or state a dollar duty/tax ` +
            `amount from it -- no declared customs value is available in this request, so price_breakdown.taxes must remain 0.`
        );
    } catch {
        return '';
    }
}

// Live competitive benchmark, sourced from real carrier_rates rows on this
// exact lane -- the same table rate-engine's "MARKET RATE" tier reads from
// (see docs/smart-quote-module-design.md §10 item 1). Deliberately does NOT
// call rate-engine's HTTP endpoint and filter its response: rate-engine pads
// out to 10+ options with RANDOMLY SIMULATED prices (see rate-engine/index.ts
// section 6, "Fallback / 10+ Options Guarantee Strategy") whenever fewer than
// 10 real DB rows exist for a lane -- the common case -- and its response
// gives no field distinguishing a real row from a simulated one except the
// simulated rows' `sim_`-prefixed id, which isn't worth parsing for when a
// direct, real-rows-only query is simpler and cheaper. Feeding a randomly
// generated number into the prompt as a "real competitive benchmark" is
// exactly the failure mode §4 exists to prevent, so this queries carrier_rates
// directly and only ever sees genuine DB rows.
async function fetchLiveMarketRateBenchmark(
    supabase: any,
    tenantId: string,
    originPortId: string,
    destinationPortId: string,
    mode: string,
    containerQty: number,
    weightKg: number,
    accountId?: string,
): Promise<{ avg: number; count: number }> {
    try {
        const today = new Date().toISOString().split('T')[0];
        // ai-advisor runs on the service-role admin client (serveWithLogger),
        // which bypasses RLS entirely -- unlike rate-engine's own carrier_rates
        // query, which runs on a user-scoped client and relies on RLS to
        // enforce tenant isolation. An explicit tenant_id filter here is NOT
        // optional: without it this would leak other tenants' negotiated
        // carrier rates into this tenant's quote-generation prompt.
        const { data: rates, error } = await supabase
            .from('carrier_rates')
            .select('total_amount, tier, account_id')
            .eq('tenant_id', tenantId)
            .eq('origin_port_id', originPortId)
            .eq('destination_port_id', destinationPortId)
            .eq('mode', mode)
            .eq('status', 'active')
            .eq('is_simulated', false)
            .or(`valid_to.is.null,valid_to.gte.${today}`);

        if (error || !rates) return { avg: 0, count: 0 };

        const prices: number[] = [];
        for (const r of rates) {
            // Same restriction rate-engine applies: a contract-tier rate is
            // only a real, usable price for the account it was negotiated
            // for -- never treat another account's contract rate as a public
            // market benchmark.
            if (r.tier === 'contract' && r.account_id !== accountId) continue;
            let price = Number(r.total_amount);
            if (!Number.isFinite(price) || price <= 0) continue;
            if (mode === 'ocean' && containerQty) price *= containerQty;
            else if (weightKg > 0) price *= weightKg;
            prices.push(price);
        }

        if (prices.length === 0) return { avg: 0, count: 0 };
        return { avg: prices.reduce((a, b) => a + b, 0) / prices.length, count: prices.length };
    } catch {
        return { avg: 0, count: 0 };
    }
}

function buildBenchmarkContext(avg: number, count: number, source: 'market' | 'historical'): string {
    if (count === 0 || avg <= 0) return '';
    const basis = source === 'market'
        ? `real, currently-active carrier rate agreements on this exact lane (${count} found)`
        : `this tenant's own last ${count} quotes on this lane`;
    return (
        `Internal benchmark: ${basis} averaged $${avg.toFixed(2)} base freight. Position 'cheapest' at or below ` +
        `this figure and 'best_value' within a reasonable band above it -- do not invent a competitor's price, only use this figure.`
    );
}

// Matches a resolved location against a country, tolerant of what callers
// actually send: `destination` is a free-text label typed into
// LocationAutocomplete (e.g. "Tehran, Iran", or literally "Global" as a
// QuoteDetailsStep default) -- it is NEVER an ISO-2 code in practice, so an
// exact `destination === 'IR'` comparison silently never matches anything a
// real user would type. `destinationDetails.formatted_address` (when the
// frontend has a resolved ports_locations row) is `"<city>, <country>"` and
// is the more reliable signal when present.
function destinationMatchesCountry(candidates: string[], isoCode: string, names: string[]): boolean {
    const iso = isoCode.toLowerCase();
    return candidates.some(v => v === iso || names.some(n => v.includes(n)));
}

async function validateCompliance(payload: any) {
    const { destination, commodity, mode, dangerous_goods, destinationDetails } = payload;
    const issues = [];

    const destinationCandidates = [
        destination,
        destinationDetails?.formatted_address,
        destinationDetails?.name,
        destinationDetails?.code,
    ].filter(Boolean).map((s: any) => String(s).trim().toLowerCase());

    // NOTE: not a comprehensive sanctions list -- only the two countries
    // this check has always targeted. Expand with compliance/legal sign-off,
    // not ad hoc, and treat this as an advisory signal, not a hard gate.
    const isSanctionedDestination =
        destinationMatchesCountry(destinationCandidates, 'KP', ['north korea', 'dprk']) ||
        destinationMatchesCountry(destinationCandidates, 'IR', ['iran']);
    if (isSanctionedDestination) issues.push({ level: 'critical', message: 'Destination is under sanctions.' });

    if (dangerous_goods) {
        if (mode === 'air') issues.push({ level: 'warning', message: 'IATA DGR check required for Air Cargo.' });
        if (commodity && commodity.toLowerCase().includes('battery')) issues.push({ level: 'info', message: 'Lithium Battery regulations apply (UN3480/UN3481).' });
    }
    const isChinaDestination = destinationMatchesCountry(destinationCandidates, 'CN', ['china']);
    if (commodity && commodity.toLowerCase().includes('chip') && isChinaDestination) issues.push({ level: 'warning', message: 'Check Export Administration Regulations (EAR) for semiconductors.' });
    return { compliant: issues.length === 0 || issues.every(i => i.level === 'info'), issues };
}

// --- Main Generation Logic ---

async function generateSmartQuotes(payload: any, supabase: any, logger: Logger, tenantId: string, userToken?: string, userId?: string) {
    const {
        origin, destination, mode, commodity, weight, volume,
        containerType, containerSize, containerQty,
        dangerousGoods, specialHandling, pickupDate, deliveryDeadline,
        originDetails, destinationDetails, account_id: accountId,
        htsCode,
    } = payload;

    // 1. Check Cache
    const cacheKey = `${origin}|${destination}|${mode}|${commodity}|${weight}|${volume}|${containerQty}`;
    let cached = null;
    try {
        const { data, error } = await supabase
            .from('ai_quote_cache')
            .select('response_payload')
            .eq('tenant_id', tenantId)
            .eq('request_hash', cacheKey)
            .gt('expires_at', new Date().toISOString())
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
            logger.warn("[AI-Advisor] Cache lookup warning (continuing):", { error: error.message });
        } else if (data) {
            cached = data;
        }
    } catch (err) {
        logger.warn("[AI-Advisor] Cache lookup failed (continuing):", { error: err });
    }

    if (cached) {
        logger.info("[AI-Advisor] Cache Hit");
        return cached.response_payload;
    }

    // 2. Fetch Historical Context
    let historicalContext = "No specific historical rates found for this route.";
    let historicalAvg = 0;
    let historicalRatesFound = 0;
    try {
        const { data: rates } = await supabase
            .from('rates')
            .select('base_price')
            .eq('tenant_id', tenantId)
            .eq('mode', mode)
            .ilike('origin', `%${origin}%`)
            .ilike('destination', `%${destination}%`)
            .limit(5);

        if (rates && rates.length > 0) {
            historicalRatesFound = rates.length;
            const prices = rates.map((r: any) => Number(r.base_price));
            historicalAvg = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
            historicalContext = `Internal Historical Data: Found ${rates.length} past rates. Average base price: $${historicalAvg.toFixed(2)}.`;
        }
    } catch (err) {
        logger.warn("Failed to fetch historical data:", { error: err });
    }

    // 2c. Live market-rate benchmark, sourced directly from carrier_rates
    // (real, currently-active carrier pricing) when the frontend resolved
    // both locations to a ports_locations id via LocationAutocomplete
    // (originDetails.id/destinationDetails.id -- set by SmartQuoteWorkspace,
    // see docs/smart-quote-module-design.md §10 item 1). This is preferred
    // over the historical `rates`-table average above whenever real rows
    // exist: it reflects actual current carrier pricing on this exact lane,
    // not just what this tenant happened to quote before. Falls back to the
    // historical average when no live carrier rate exists for this lane
    // (new lane, no ports_locations id available) -- never falls back to a
    // simulated/random number (see fetchLiveMarketRateBenchmark's comment).
    let benchmarkAvg = historicalAvg;
    let benchmarkCount = historicalRatesFound;
    let benchmarkSource: 'market' | 'historical' = 'historical';
    if (originDetails?.id && destinationDetails?.id) {
        const weightKg = Number(weight) || 0;
        const market = await fetchLiveMarketRateBenchmark(
            supabase, tenantId, originDetails.id, destinationDetails.id, mode,
            Number(containerQty) || 1, weightKg, accountId,
        );
        if (market.count > 0) {
            benchmarkAvg = market.avg;
            benchmarkCount = market.count;
            benchmarkSource = 'market';
        }
    }

    // 2b. Maritime chokepoint + competitive-benchmark context. Both are
    // deterministic, code-computed strings (not something the model is
    // asked to invent) -- see buildMaritimeContext/buildBenchmarkContext
    // above. Either can legitimately be empty (non-ocean mode, no canal on
    // this lane, no internal rate history yet); the prompt below treats an
    // empty value as "say nothing about it" rather than a gap to fill in.
    const maritimeContext = await buildMaritimeContext(supabase, origin, destination, mode, originDetails, destinationDetails);
    const benchmarkContext = buildBenchmarkContext(benchmarkAvg, benchmarkCount, benchmarkSource);

    // 2c. Duty/tax context (docs/smart-quote-module-design.md §10 item 5).
    // Real, sourced rate when public.duty_rates has one for this exact HTS
    // code + destination jurisdiction; empty otherwise. Informational only
    // -- see buildDutyContext's comment for why price_breakdown.taxes stays
    // 0 regardless (no declared customs value exists anywhere in this flow
    // to compute a real dollar duty amount from).
    const destinationCountry = String(destinationDetails?.formatted_address || '').split(',').pop()?.trim() || '';
    const dutyContext = await buildDutyContext(supabase, htsCode, destinationCountry, logger);

    // 3. Call the LLM Gateway (routes to tenant-configured provider, or
    //    falls through to the self-hosted vLLM rig — see _shared/llm-gateway.ts)
    const vars: Record<string, string> = {
        origin: String(origin ?? ''),
        destination: String(destination ?? ''),
        mode: String(mode ?? ''),
        commodity: String(commodity ?? ''),
        weight: String(weight ?? ''),
        volume: String(volume ?? ''),
        container_qty: String(containerQty || 1),
        container_size: String(containerSize || 'Standard'),
        container_type: String(containerType || ''),
        historical_context: historicalContext,
        maritime_context: maritimeContext,
        benchmark_context: benchmarkContext,
        duty_context: dutyContext,
    };

    const ctx: LlmCallContext = {
        tenantId,
        userId: userId ?? null,
        supabaseAdmin: supabase,
        logger,
    };

    // 3b. Offer the LLM the get_freight_rate tool when this tenant has at
    // least one real, callable rate-provider adapter registered (see
    // docs/smart-quote-module-design.md §9). Registry is empty today (no
    // real adapters built yet -- see _shared/rate-providers/registry.ts),
    // so getRateProviderTool() returns null and callLLMWithTools degrades
    // to plain callLLM() with zero behavior change from before this change.
    const rateProviderRegistry = await loadTenantRateProviders(supabase, tenantId);
    const rateProviderTool = getRateProviderTool(rateProviderRegistry);
    const tools: ToolDefinition[] = rateProviderTool ? [rateProviderTool as unknown as ToolDefinition] : [];

    // Collected here so the model's FINAL option list can be reconciled
    // against them below (docs/smart-quote-module-design.md §10 item 12,
    // §9's own closing note): a real tool result handed to the model as
    // Round 2 context is not automatically reflected in what it generates --
    // nothing stops the model from restating a different price/carrier for
    // the same lane, the same "two independent numbers, nothing forces them
    // to agree" failure mode already fixed for carrier name/charges above.
    // Empty today for every tenant (§9.6: no real adapter configured yet),
    // so this is a no-op until the first one is -- fixed now so it's correct
    // before that happens, not after.
    const realRatesFetched: NormalizedRate[] = [];

    const start = performance.now();
    const llmResult = await callLLMWithTools("logistics.smart_quotes", vars, ctx, tools, async (toolName, argsJson) => {
        if (toolName !== "get_freight_rate") {
            return `Unknown tool '${toolName}'.`;
        }
        const result = await executeRateToolCall(supabase, tenantId, rateProviderRegistry, argsJson);
        if (result.ok) realRatesFetched.push(result.rate);
        return JSON.stringify(result);
    });

    let aiResponse: any;
    try {
        aiResponse = JSON.parse(llmResult.text);
    } catch (_err) {
        // Defensive: unlike the previous OpenAI-only call, the gateway may
        // route to providers with no native "JSON mode" (response_format is
        // enforced via the system prompt instead — see llm-gateway.ts). Strip
        // an accidental markdown code fence before giving up.
        const stripped = llmResult.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
        aiResponse = JSON.parse(stripped);
    }

    // 4. Dynamic Charge Calculation Engine (Post-Processing)
    // Applies real, tenant-configured surcharges from public.dynamic_surcharges
    // where any exist (docs/smart-quote-module-design.md §10 item 3), falling
    // back to the previous hardcoded fuel/currency defaults otherwise -- see
    // applyDynamicPricing's own comments for why.
    aiResponse = await applyDynamicPricing(aiResponse, supabase, tenantId, mode, Number(weight) || 0, realRatesFetched, logger);

    // 5. Cache Result
    await supabase.from('ai_quote_cache').insert({
        tenant_id: tenantId,
        request_hash: cacheKey,
        response_payload: aiResponse
    });

    const latency = Math.round(performance.now() - start);
    const inputSummary = JSON.stringify({ origin, destination, mode, commodity });
    const { sanitized, redacted } = sanitizeForLLM(inputSummary);
    await logAiCall(supabase, {
      tenant_id: tenantId,
      user_id: userId ?? null,
      function_name: "ai-advisor.generate_smart_quotes",
      model_used: `${llmResult.provider}:${llmResult.model}`,
      input_tokens: llmResult.inputTokens,
      output_tokens: llmResult.outputTokens,
      total_cost_usd: llmResult.costUsd,
      latency_ms: latency,
      pii_detected: redacted.length > 0,
      pii_fields_redacted: redacted,
      output_summary: { options_count: aiResponse.options?.length, confidence: aiResponse.confidence_score }
    });

    return aiResponse;
}

 

type DynamicSurchargeType = 'fuel' | 'currency' | 'peak_season' | 'port_congestion' | 'security';
interface ResolvedSurcharge { calculationMethod: 'percentage' | 'fixed'; baseValue: number; }

// Real, tenant-configured surcharges from public.dynamic_surcharges
// (docs/smart-quote-module-design.md §10 item 3 -- schema already existed,
// was never queried anywhere before this). One query per generateSmartQuotes
// request (not per-option): the shipment mode is the same for every option
// in one response, so the applicable rows don't vary within it.
//
// `geographic_scope` (jsonb) is deliberately NOT filtered on here: the only
// data that exists in it today is placeholder metadata (`{"seed_ref": ...,
// "rate_type": ...}`), not a real lane/region shape -- there is no
// established convention yet for what a real geographic scope should
// contain. Filtering on an undefined shape would either match nothing
// (if treated strictly) or require guessing a schema (exactly what this
// module exists to avoid). Left as a documented gap for whenever a real
// geo-scoping convention is defined, not silently implemented as a guess.
//
// `calculation_method = 'formula'` rows are excluded outright: no formula
// evaluator exists anywhere in this codebase, and evaluating an
// admin-authored formula string would need its own careful design
// (safe expression language, not `eval`) -- out of scope here.
async function fetchDynamicSurcharges(
    supabase: any,
    tenantId: string,
    mode: string,
    logger?: Logger,
): Promise<Partial<Record<DynamicSurchargeType, ResolvedSurcharge>>> {
    const today = new Date().toISOString().slice(0, 10);
    const result: Partial<Record<DynamicSurchargeType, ResolvedSurcharge>> = {};
    try {
        // NOTE: deliberately NOT using the .contains() helper for
        // applicable_modes. It serializes a JS array as a Postgres array
        // literal ("{ocean}"), which is correct for a text[] column but
        // invalid for this column's actual type, jsonb -- PostgREST 400s
        // with "invalid input syntax for type json" (confirmed live while
        // testing this). Using .filter() with an explicit JSON string
        // forces the correct "[\"ocean\"]" representation.
        const { data, error } = await supabase
            .from('dynamic_surcharges')
            .select('surcharge_type, calculation_method, base_value')
            .eq('tenant_id', tenantId)
            .in('calculation_method', ['percentage', 'fixed'])
            .filter('applicable_modes', 'cs', JSON.stringify([String(mode || '').toLowerCase()]))
            .filter('validity_period', 'cs', `[${today},${today}]`)
            .order('created_at', { ascending: false });

        if (error) {
            logger?.warn("dynamic_surcharges query failed, using fuel/currency defaults:", { error: error.message });
            return result;
        }
        if (!data) return result;

        for (const row of data) {
            const type = row.surcharge_type as DynamicSurchargeType;
            // First row per type wins -- rows are ordered created_at DESC,
            // so this is "the most recently configured override," a
            // reasonable default when an admin has entered more than one
            // (e.g. superseding an old rate) without deleting the old one.
            if (!type || result[type]) continue;
            const baseValue = Number(row.base_value);
            if (!Number.isFinite(baseValue)) continue;
            result[type] = { calculationMethod: row.calculation_method, baseValue };
        }
    } catch {
        // Best-effort: an outage here must never block quote generation.
        // Callers fall back to their own hardcoded defaults (fuel/currency)
        // or simply omit the surcharge entirely (security/peak_season/
        // port_congestion have no fallback -- see applyDynamicPricing).
    }
    return result;
}

function surchargeAmount(entry: ResolvedSurcharge | undefined, base: number): number {
    if (!entry) return 0;
    return entry.calculationMethod === 'fixed' ? entry.baseValue : base * entry.baseValue;
}

const EXTRA_SURCHARGE_LABELS: Record<string, string> = {
    security_surcharge: 'Security Surcharge',
    peak_season_surcharge: 'Peak Season Surcharge',
    port_congestion_surcharge: 'Port Congestion Surcharge',
};

// Finds a real, tool-fetched rate (§9's LLM tool-calling framework) that
// covers the same carrier/mode as one of the model's own final options.
// Matched by carrier name only (case-insensitive) -- NormalizedRate doesn't
// carry an option id the model could echo back, and carrier name is the
// only field both sides share. A miss just means no real rate to reconcile
// against for that option, not an error.
function findMatchingRealRate(realRates: NormalizedRate[], carrierName: unknown, optionMode: unknown): NormalizedRate | null {
    const normalizedCarrier = String(carrierName || '').trim().toLowerCase();
    if (!normalizedCarrier || realRates.length === 0) return null;
    const normalizedMode = String(optionMode || '').trim().toLowerCase();
    return realRates.find((r) => {
        if (!r.carrier || r.carrier.trim().toLowerCase() !== normalizedCarrier) return false;
        return !normalizedMode || normalizedMode.includes(r.mode);
    }) ?? null;
}

async function applyDynamicPricing(response: any, supabase: any, tenantId: string, mode: string, weightKg: number, realRatesFetched: NormalizedRate[], logger?: Logger) {
    const configured = await fetchDynamicSurcharges(supabase, tenantId, mode, logger);

    // Fuel and currency are the only two categories with an established
    // fallback: they were already being shown to every user as a hardcoded
    // 12%/2% "Mock" value (see git history) before this change, so falling
    // back to that same default when a tenant hasn't configured a real
    // dynamic_surcharges row yet is a continuity measure, not a new
    // fabrication. Security/peak_season/port_congestion were never modeled
    // at all before this change -- they have no equivalent fallback, and
    // are simply omitted (not invented) when nothing is configured.
    const fuelSurcharge: ResolvedSurcharge = configured.fuel ?? { calculationMethod: 'percentage', baseValue: 0.12 };
    const currencySurcharge: ResolvedSurcharge = configured.currency ?? { calculationMethod: 'percentage', baseValue: 0.02 };

    if (response.options) {
        response.options = response.options.map((opt: any) => {
            if (!opt.price_breakdown) opt.price_breakdown = {};
            if (!opt.price_breakdown.fees) opt.price_breakdown.fees = {};
            const currency = opt.price_breakdown.currency || 'USD';

            const hasLegs = Array.isArray(opt.legs) && opt.legs.length > 0;
            let mainLeg: any = null;
            if (hasLegs) {
                // Find Main Leg (longest distance or Ocean/Air)
                // Heuristic: Look for leg with same mode as option, or longest distance
                mainLeg = opt.legs.find((l: any) => opt.transport_mode && l.mode && opt.transport_mode.toLowerCase().includes(l.mode.toLowerCase()));
                if (!mainLeg) mainLeg = opt.legs.reduce((prev: any, current: any) => (prev.distance_km > current.distance_km) ? prev : current);
            }

            // The model also independently generates the option-level
            // `carrier.name` (what the UI displays) and each leg's own
            // `carrier` -- another pair with nothing forcing them to agree.
            // Confirmed live: real responses showed carrier.name as the
            // *pickup/delivery trucker's* name (e.g. "Local Logistics")
            // while the ocean leg was correctly assigned a real carrier
            // (e.g. "CMA CGM") in the very same option. Same fix pattern as
            // the pricing reconciliation above: trust the main leg, not the
            // independently-generated summary field.
            if (mainLeg && mainLeg.carrier) {
                const existingCarrier = typeof opt.carrier === 'object' && opt.carrier ? opt.carrier : {};
                opt.carrier = { ...existingCarrier, name: mainLeg.carrier };
            }

            // The model generates price_breakdown (base_fare/surcharges/fees) and
            // legs[].charges as two INDEPENDENT descriptions of the same cost --
            // nothing forces them to agree, and empirically they often don't
            // (~17-38% of options across both self-hosted and paid providers in
            // live sampling, 2026-09-10). Rather than trust the model's own
            // arithmetic, make legs the source of truth for base_fare/fees when
            // legs exist, then rebuild every dynamic/model surcharge back into
            // the main leg's charges. That makes sum(legs[].charges) and
            // price_breakdown.total identical by construction, not by hoping
            // the model's two independent numbers happened to match.
            let base: number;
            if (mainLeg) {
                base = (mainLeg.charges || []).reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);
                const otherLegsTotal = opt.legs
                    .filter((l: any) => l !== mainLeg)
                    .reduce((sum: number, l: any) => sum + (l.charges || []).reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0), 0);
                // Collapses whatever fee categories the model may have split out
                // (e.g. "terminal_charges") into one reconciled figure -- keeps
                // the fee bucket true to the legs instead of an independent guess.
                opt.price_breakdown.fees = { handling_docs: otherLegsTotal };
            } else {
                // No legs to reconcile against -- fall back to trusting the
                // model's own base_fare, same as before this fix.
                base = opt.price_breakdown.base_fare || 0;
            }
            opt.price_breakdown.base_fare = base;

            // Real, tool-fetched rate reconciliation (docs/smart-quote-module-design.md
            // §10 item 12, §9's own closing note). The model receives a real
            // NormalizedRate as Round 2 context when it calls get_freight_rate,
            // but nothing about that forces its FINAL option to actually use
            // those numbers -- it could restate a different price for the
            // same carrier, the exact "two independent numbers, nothing
            // forces them to agree" failure mode already fixed above for
            // carrier name and legs/price_breakdown. When this option's
            // (already carrier-reconciled) carrier matches a real rate this
            // request actually fetched, trust that real number over the
            // model's own restatement -- same principle, now extended to a
            // genuinely external, verified figure instead of just the
            // model's own internal consistency. Always empty today (no
            // tenant has a real adapter configured -- §9.6), so this has no
            // effect in production yet; fixed now so it's correct before
            // that changes, not discovered after.
            const matchedRealRate = findMatchingRealRate(realRatesFetched, opt.carrier?.name, opt.transport_mode || mode);
            const toolSurcharges: Record<string, number> = {};
            const toolSurchargeLabels: Record<string, string> = {};
            if (matchedRealRate) {
                base = matchedRealRate.baseRate;
                opt.price_breakdown.base_fare = base;
                if (matchedRealRate.transitDays && typeof opt.transit_time === 'object' && opt.transit_time) {
                    opt.transit_time.total_days = matchedRealRate.transitDays;
                }
                // Itemized separately per NormalizedRate's own contract --
                // never pre-summed by the adapter, so don't fold them into
                // `base` here either. Prefixed to keep them visually
                // distinct from the platform's own dynamic surcharges below.
                for (const [key, amt] of Object.entries(matchedRealRate.surcharges || {})) {
                    const rounded = Math.round(Number(amt) || 0);
                    if (rounded === 0) continue;
                    const prefixedKey = `provider_${key}`;
                    toolSurcharges[prefixedKey] = rounded;
                    toolSurchargeLabels[prefixedKey] = `${matchedRealRate.provider} ${key.replace(/_/g, ' ')}`;
                }
            }

            // Discard any other surcharge key the model reported (e.g.
            // "baf_caf") rather than carry it through: requirement #4 in the
            // prompt explicitly tells the model to fold BAF/CAF "included in
            // the rolled-up leg charge" -- confirmed live, base_fare +
            // surcharges.baf_caf consistently equals the main leg's own
            // charge amount exactly (e.g. 2500 + 350 = 2850). Since `base`
            // above is already taken from that same leg charge, it already
            // contains whatever the model folded in; keeping baf_caf as a
            // separate addend on top would double-count it. Only the two
            // dynamic surcharges below are genuinely additional -- they're
            // computed by this function, not something the model could have
            // already baked into the leg.
            const fuelAmt = Math.round(surchargeAmount(fuelSurcharge, base));
            const currencyAmt = Math.round(surchargeAmount(currencySurcharge, base));

            // Only added when a real, currently-valid dynamic_surcharges row
            // exists for this tenant/mode -- no fallback, no fabrication.
            const extraSurcharges: Record<string, number> = { ...toolSurcharges };
            for (const type of ['security', 'peak_season', 'port_congestion'] as const) {
                const entry = configured[type];
                if (!entry) continue;
                const amt = Math.round(surchargeAmount(entry, base));
                if (amt !== 0) extraSurcharges[`${type}_surcharge`] = amt;
            }

            opt.price_breakdown.surcharges = { fuel_adjustment: fuelAmt, currency_adj: currencyAmt, ...extraSurcharges };

            // Duty/tax reconciliation (docs/smart-quote-module-design.md §10
            // item 5): the model's own `taxes` figure is never trusted here,
            // regardless of what it outputs. Sampled empirically across 30
            // real cached options before this change -- it was 0 every
            // single time, so this isn't fixing an observed fabrication, it's
            // closing the latent gap: nothing previously stopped the model
            // from inventing a nonzero figure for a route/commodity it
            // decided looked dutiable. There is no declared customs value
            // anywhere in this flow to compute a REAL duty amount from (see
            // buildDutyContext), so the only grounded value is 0 -- always,
            // unconditionally, the same way base_fare/surcharges are already
            // reconciled above rather than trusted from the model's own math.
            const taxes = 0;
            const extraSurchargesSum = Object.values(extraSurcharges).reduce((a: number, b: number) => a + b, 0);
            const surchargesSum = fuelAmt + currencyAmt + extraSurchargesSum;
            const feesSum = Object.values(opt.price_breakdown.fees).reduce((a: any, b: any) => (Number(a) || 0) + (Number(b) || 0), 0) as number;

            // --- REBUILD THE MAIN LEG'S CHARGES FROM THE FINAL NUMBERS ---
            // Replaces whatever charge line(s) the model originally put on
            // this leg with one line per price_breakdown component (base
            // freight + fuel/currency adjustment + taxes). This is what
            // makes sum(legs[].charges) equal price_breakdown's base_fare +
            // surcharges + fees + taxes unconditionally -- fees already
            // matches by construction (it's literally the sum of every
            // other leg, set above), so once this leg's own total equals
            // base + surcharges + taxes, the two grand totals match.
            if (mainLeg) {
                const unit = (mainLeg.charges && mainLeg.charges[0]?.unit) || 'per_shipment';
                mainLeg.charges = [
                    { name: 'Freight', amount: base, currency, unit },
                    ...(fuelAmt !== 0 ? [{ name: 'Fuel Adjustment (Dynamic)', amount: fuelAmt, currency, unit: 'per_shipment' }] : []),
                    ...(currencyAmt !== 0 ? [{ name: 'Currency Adjustment (Dynamic)', amount: currencyAmt, currency, unit: 'per_shipment' }] : []),
                    ...Object.entries(extraSurcharges).map(([key, amt]) => ({
                        name: EXTRA_SURCHARGE_LABELS[key] ?? toolSurchargeLabels[key] ?? key,
                        amount: amt,
                        currency,
                        unit: 'per_shipment',
                    })),
                    ...(taxes !== 0 ? [{ name: 'Taxes', amount: taxes, currency, unit: 'per_shipment' }] : []),
                ];
            }
            // ------------------------------------------------------------

            // CO2 grounding (docs/smart-quote-module-design.md §10 item 12,
            // prompt rule 12): a live production response showed the model
            // stating a specific CO2 figure ("1600 kg") for a request where
            // the real cargo weight was 0 -- no real basis for that number
            // exists. Never trust the prompt alone for this, same as taxes
            // above: strip whatever the model claimed whenever the real
            // weight it was actually given is 0/missing.
            if (weightKg <= 0 && opt.environmental) {
                opt.environmental.co2_emissions = '';
            }

            // Recalculate Total -- always the sum of the fields above, so it
            // can never disagree with itself, or (via the leg rebuild above)
            // with sum(legs[].charges).
            opt.price_breakdown.total = base + surchargesSum + feesSum + taxes;

            return opt;
        });
    }
    return response;
}
