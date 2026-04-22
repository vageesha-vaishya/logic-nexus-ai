-- AMRO facilities locations
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: pending-review

BEGIN;

CREATE TABLE IF NOT EXISTS public.amro_facilities_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  franchise_id uuid NULL,
  facility_name text NOT NULL,
  facility_code text NULL,
  facility_type text NULL,

  -- Geographic data
  country_id uuid NULL,
  city_id uuid NULL,
  country_code text NULL,
  airport_code text NULL,
  state_province text NULL,
  postal_code text NULL,
  coordinates jsonb NULL DEFAULT '{}'::jsonb,

  -- MRO specific attributes
  certification_type text[] NULL,
  capacity_description jsonb NULL,
  has_paint_booth boolean DEFAULT false,
  has_engine_shop boolean DEFAULT false,
  environmental_control boolean DEFAULT false,

  -- Operational data
  work_centers jsonb NULL DEFAULT '[]'::jsonb,
  operating_hours text NULL,
  is_bonded_warehouse boolean DEFAULT false,
  is_active boolean NULL DEFAULT true,

  -- Audit
  notes text NULL,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),

  CONSTRAINT amro_facilities_locations_pkey PRIMARY KEY (id),
  CONSTRAINT amro_facilities_locations_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT amro_facilities_locations_franchise_fk
    FOREIGN KEY (franchise_id) REFERENCES public.franchises(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT amro_facilities_locations_country_fk
    FOREIGN KEY (country_id) REFERENCES public.countries(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT amro_facilities_locations_city_fk
    FOREIGN KEY (city_id) REFERENCES public.cities(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT amro_facilities_locations_type_check
    CHECK (
      facility_type IS NULL
      OR facility_type = ANY (
        ARRAY[
          'hangar'::text,
          'line_station'::text,
          'component_shop'::text,
          'engine_shop'::text,
          'parts_warehouse'::text,
          'tool_room'::text
        ]
      )
    ),
  CONSTRAINT amro_facilities_locations_airport_code_chk
    CHECK (airport_code IS NULL OR airport_code ~ '^[A-Z]{3,4}$')
);

CREATE INDEX IF NOT EXISTS idx_amro_facilities_locations_tenant_id
  ON public.amro_facilities_locations USING btree (tenant_id);

CREATE INDEX IF NOT EXISTS idx_amro_facilities_locations_franchise_id
  ON public.amro_facilities_locations USING btree (franchise_id);

CREATE INDEX IF NOT EXISTS idx_amro_facilities_locations_type
  ON public.amro_facilities_locations USING btree (facility_type);

COMMIT;
