-- AOG S8 — fleet context aggregation RPC.
--
-- Per docs/plans/2026-06-04-aog-alert-surface-design.md slice S8.
-- Replaces the stub fleet_context shipped in S2's /triage endpoint
-- with real-data aggregation. The LLM's confidence + recommendation
-- quality both improve materially when these arrays are populated.
--
-- Achievable today with existing schema:
--   ✓ same_type_aircraft_nearby — from public.aircraft.home_base
--     + public.airports lat/lng haversine for ≤500nm proximity
--   ✓ parts_at_airport — from public.uim_inventory_items joined to
--     uim_catalog_items, filtered by location_id matching the
--     AOG airport
--
-- Honestly stubbed (no source data exists):
--   ⚠ tools_at_airport — no tool-by-station table. Empty array.
--   ⚠ station_capability — no per-tenant station-capability config
--     table. Default 'vendor_required' (most pessimistic + safest).
--   ⚠ sla_recovery_hours — no per-route SLA config table. Default
--     24 (conservative target). A tenant settings RPC override is
--     a follow-up slice.
--
-- The honest stubs surface as flags in the LLM prompt's warnings;
-- the LLM is designed to handle them and lower confidence
-- accordingly.

CREATE OR REPLACE FUNCTION amro.fleet_context_at_airport(
  p_airport_iata   text,
  p_aircraft_model text,
  p_tenant_id      uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, amro AS $$
DECLARE
  v_airport_id        uuid;
  v_airport_lat       numeric;
  v_airport_lng       numeric;
  v_same_type_nearby  jsonb;
  v_parts_at_airport  jsonb;
  v_self_aircraft_id  uuid;
BEGIN
  -- 1. Resolve the AOG airport row.
  SELECT id, latitude, longitude
  INTO v_airport_id, v_airport_lat, v_airport_lng
  FROM public.airports
  WHERE iata_code = upper(p_airport_iata)
  LIMIT 1;

  IF v_airport_id IS NULL THEN
    -- Airport not in our catalog. Return all stubs so the LLM can
    -- still triage on aircraft + defect alone.
    RETURN jsonb_build_object(
      'same_type_aircraft_nearby', '[]'::jsonb,
      'tools_at_airport',          '[]'::jsonb,
      'parts_at_airport',          '[]'::jsonb,
      'station_capability',        'vendor_required',
      'sla_recovery_hours',        24,
      'data_quality_notes',        jsonb_build_array(
        format('Airport %s not in airports catalog — context could not be resolved', upper(p_airport_iata))
      )
    );
  END IF;

  -- 2. Same-type aircraft nearby.
  -- "Nearby" = same home_base airport (strict) OR home_base within
  -- ~500 nm great-circle distance. 500 nm is roughly the ferry
  -- radius for "swap an aircraft" scenarios on narrow-body fleets.
  -- For wide-body or remote ops, the operator can override the
  -- recommendation; this is a starting point not a verdict.
  --
  -- Haversine formula in nautical miles:
  --   3440.065 * 2 * asin(sqrt(
  --     sin((lat2-lat1)/2)^2 +
  --     cos(lat1)*cos(lat2)*sin((lng2-lng1)/2)^2
  --   ))
  WITH nearby_aircraft AS (
    SELECT
      a.id,
      a.registration,
      ap.iata_code AS at_airport,
      CASE
        WHEN a.home_base = v_airport_id THEN 0
        ELSE 3440.065 * 2 * asin(sqrt(
          power(sin(radians(ap.latitude - v_airport_lat) / 2), 2) +
          cos(radians(v_airport_lat)) * cos(radians(ap.latitude)) *
          power(sin(radians(ap.longitude - v_airport_lng) / 2), 2)
        ))
      END AS distance_nm,
      -- Status placeholder — we don't have a live aircraft-status
      -- feed; "available" is optimistic. Mark with a data note.
      'available'::text AS status
    FROM public.aircraft a
    JOIN public.airports ap ON ap.id = a.home_base
    WHERE a.model = p_aircraft_model
      AND a.tenant_id = p_tenant_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'registration',  registration,
      'airport_iata',  at_airport,
      'status',        status,
      'distance_nm',   round(distance_nm::numeric, 1)
    )
    ORDER BY distance_nm
  )
  INTO v_same_type_nearby
  FROM nearby_aircraft
  WHERE distance_nm <= 500;

  v_same_type_nearby := COALESCE(v_same_type_nearby, '[]'::jsonb);

  -- 3. Parts at airport.
  -- Aggregates available qty per part_number at this location.
  -- Joins uim_inventory_items → uim_catalog_items for the part_number.
  WITH parts_qty AS (
    SELECT
      c.part_number,
      sum(i.quantity)::numeric AS qty_available
    FROM public.uim_inventory_items i
    JOIN public.uim_catalog_items c ON c.id = i.catalog_item_id
    WHERE i.location_id = v_airport_id
      AND i.tenant_id = p_tenant_id
      AND i.status = 'available'
      AND i.deleted_at IS NULL
      AND c.part_number IS NOT NULL
    GROUP BY c.part_number
    HAVING sum(i.quantity) > 0
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'part_number',   part_number,
      'qty_available', qty_available
    )
    ORDER BY part_number
  )
  INTO v_parts_at_airport
  FROM parts_qty;

  v_parts_at_airport := COALESCE(v_parts_at_airport, '[]'::jsonb);

  -- 4. Compose the LLM input shape.
  RETURN jsonb_build_object(
    'same_type_aircraft_nearby', v_same_type_nearby,
    'tools_at_airport',          '[]'::jsonb,
    'parts_at_airport',          v_parts_at_airport,
    'station_capability',        'vendor_required',
    'sla_recovery_hours',        24,
    'data_quality_notes',        jsonb_build_array(
      'tools_at_airport not tracked — empty array stub',
      'station_capability defaulted to vendor_required (no per-tenant station-capability config table yet)',
      'sla_recovery_hours defaulted to 24h (no per-route SLA config table yet)'
    )
  );
END $$;

COMMENT ON FUNCTION amro.fleet_context_at_airport IS
  'Aggregates fleet_context for the amro.aog.triage LLM input. Returns '
  'a jsonb object with same_type_aircraft_nearby + parts_at_airport from '
  'real data; tools_at_airport / station_capability / sla_recovery_hours '
  'are honest stubs until per-tenant config tables exist. The data_quality_notes '
  'array surfaces which fields are stubbed so the LLM can lower confidence '
  'accordingly. SECURITY DEFINER so amro-api service role can call it without '
  'RLS friction.';

GRANT EXECUTE ON FUNCTION amro.fleet_context_at_airport(text, text, uuid)
  TO authenticated, service_role;
