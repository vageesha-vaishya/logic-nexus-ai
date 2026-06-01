-- Phase 6 Step 63 — amro.part_profiles + amro.inventory_extensions.
--
-- Implements ADR-0013 step 3: two NEW tables (no source to mirror)
-- carrying AMRO-specific aviation regulatory metadata atop the UIM
-- canonical item catalog.
--
-- Both tables FK to uim.item_master (Step 61). If an item is
-- genuinely deleted from the canonical catalog, its aviation
-- metadata goes with it (ON DELETE CASCADE) — these are
-- supplemental annotations, not independent entities.
--
-- Split into two tables (rather than one wide one) because the
-- two concerns have different lifecycles:
--
--   amro.part_profiles
--     Maintenance/airworthiness metadata per item type. Set once
--     when the item is added to the AMRO catalog; rarely changes
--     thereafter except via engineering change orders. Drives
--     life-limit tracking, AD/SB applicability, scheduled-task
--     generation.
--
--   amro.inventory_extensions
--     Inventory-handling metadata per item type. Storage / hazmat /
--     shelf-life / special-handling info. Drives warehouse routing,
--     pick rules, customs declarations. Changes more frequently
--     (shelf life updates, new hazmat classifications).
--
-- Both tables use jsonb 'metadata' columns for tenant-specific or
-- not-yet-modeled fields, so new attributes don't require migrations.

-- ══════════════════════════════════════════════════════════════════════
-- amro.part_profiles
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE amro.part_profiles (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                       uuid NOT NULL,
  item_id                         uuid NOT NULL
                                  REFERENCES uim.item_master(id) ON DELETE CASCADE,

  -- Regulatory class. 'rotable' = repairable + tracked life;
  -- 'consumable' = one-use; 'expendable' = ground equipment / not tracked.
  regulatory_class                text NOT NULL DEFAULT 'consumable'
                                  CHECK (regulatory_class IN ('rotable','consumable','expendable','tooling')),

  -- Life-limit tracking (any combination allowed; NULL = not life-limited
  -- on that axis). Used by amro.maintenance_triggers to compute remaining
  -- service life.
  life_limited                    boolean NOT NULL DEFAULT false,
  life_limit_hours                integer
                                  CHECK (life_limit_hours IS NULL OR life_limit_hours > 0),
  life_limit_cycles               integer
                                  CHECK (life_limit_cycles IS NULL OR life_limit_cycles > 0),
  life_limit_calendar_months      integer
                                  CHECK (life_limit_calendar_months IS NULL OR life_limit_calendar_months > 0),

  -- ATA Spec 100 chapter. Format: '<chapter>' or '<chapter>-<section>'.
  -- e.g. '27' (flight controls), '32-40' (landing gear / wheels & brakes).
  ata_chapter                     text,

  -- Calibration: tools, test equipment, measurement-critical parts.
  calibration_required            boolean NOT NULL DEFAULT false,
  calibration_interval_hours      integer
                                  CHECK (calibration_interval_hours IS NULL OR calibration_interval_hours > 0),
  calibration_interval_months     integer
                                  CHECK (calibration_interval_months IS NULL OR calibration_interval_months > 0),

  -- Certification / airworthiness.
  requires_certification          boolean NOT NULL DEFAULT false,
  requires_airworthiness_release  boolean NOT NULL DEFAULT false,
  certification_authorities       text[] NOT NULL DEFAULT '{}'::text[],
                                  -- e.g. {'FAA','EASA','CAAC','SACAA'}

  -- Free-form for tenant- or domain-specific attributes.
  metadata                        jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, item_id),
  -- If you say it's life-limited you owe AT LEAST one of the three axes.
  CONSTRAINT part_profiles_life_limited_has_axis
    CHECK (
      life_limited = false
      OR life_limit_hours IS NOT NULL
      OR life_limit_cycles IS NOT NULL
      OR life_limit_calendar_months IS NOT NULL
    ),
  -- Same for calibration.
  CONSTRAINT part_profiles_calibration_has_interval
    CHECK (
      calibration_required = false
      OR calibration_interval_hours IS NOT NULL
      OR calibration_interval_months IS NOT NULL
    )
);

COMMENT ON TABLE amro.part_profiles IS
  'Phase 6 Step 63 — aviation maintenance/airworthiness metadata per item type, keyed to uim.item_master. ADR-0013. Drives life-limit tracking, AD/SB applicability, scheduled-task generation.';
COMMENT ON COLUMN amro.part_profiles.regulatory_class IS
  'rotable (repairable+tracked) | consumable (one-use) | expendable (ground eqpt) | tooling (non-installed).';
COMMENT ON COLUMN amro.part_profiles.ata_chapter IS
  'ATA Spec 100 chapter or chapter-section, e.g. ''27'' (flight controls), ''32-40'' (wheels & brakes).';

CREATE INDEX part_profiles_item_idx          ON amro.part_profiles (item_id);
CREATE INDEX part_profiles_tenant_class_idx  ON amro.part_profiles (tenant_id, regulatory_class);
CREATE INDEX part_profiles_life_limited_idx  ON amro.part_profiles (tenant_id, item_id)
  WHERE life_limited = true;
CREATE INDEX part_profiles_calibration_idx   ON amro.part_profiles (tenant_id, item_id)
  WHERE calibration_required = true;

ALTER TABLE amro.part_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY part_profiles_tenant_select ON amro.part_profiles
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_amro_part_profiles_updated_at
  BEFORE UPDATE ON amro.part_profiles
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON amro.part_profiles TO authenticated;
GRANT ALL    ON amro.part_profiles TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- amro.inventory_extensions
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE amro.inventory_extensions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL,
  item_id                  uuid NOT NULL
                           REFERENCES uim.item_master(id) ON DELETE CASCADE,

  -- Hazmat: IATA DGR / 49 CFR classification.
  hazmat_class             text,
                           -- e.g. '1.4S','9','Forbidden'
  un_number                text,
                           -- e.g. 'UN3481'
  hazmat_packing_group     text
                           CHECK (hazmat_packing_group IS NULL OR hazmat_packing_group IN ('I','II','III')),

  -- Shelf life. For batteries, sealants, adhesives, paints, etc.
  shelf_life_days          integer
                           CHECK (shelf_life_days IS NULL OR shelf_life_days > 0),
  -- After opening — e.g. paint, sealants.
  shelf_life_open_days     integer
                           CHECK (shelf_life_open_days IS NULL OR shelf_life_open_days > 0),

  -- Storage conditions (per AS9120 / GMP-style requirements).
  storage_temp_min_c       numeric(5,2),
  storage_temp_max_c       numeric(5,2),
  storage_humidity_max_pct integer
                           CHECK (storage_humidity_max_pct IS NULL
                                  OR (storage_humidity_max_pct >= 0 AND storage_humidity_max_pct <= 100)),
  storage_class            text,
                           -- e.g. 'static-sensitive','flammable','cold-storage'

  -- Special handling flags.
  esd_sensitive            boolean NOT NULL DEFAULT false,
  light_sensitive          boolean NOT NULL DEFAULT false,
  requires_dehumidification boolean NOT NULL DEFAULT false,

  -- Customs / export.
  hs_code                  text,
  ecn_eccn                 text,
  country_of_origin        text,   -- ISO 3166-1 alpha-2

  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, item_id),
  CONSTRAINT inventory_extensions_temp_range_sane
    CHECK (
      storage_temp_min_c IS NULL
      OR storage_temp_max_c IS NULL
      OR storage_temp_min_c <= storage_temp_max_c
    ),
  CONSTRAINT inventory_extensions_open_le_unopened
    CHECK (
      shelf_life_days IS NULL
      OR shelf_life_open_days IS NULL
      OR shelf_life_open_days <= shelf_life_days
    )
);

COMMENT ON TABLE amro.inventory_extensions IS
  'Phase 6 Step 63 — aviation inventory-handling metadata per item type, keyed to uim.item_master. ADR-0013. Drives warehouse routing, pick rules, hazmat declarations, customs.';

CREATE INDEX inventory_extensions_item_idx          ON amro.inventory_extensions (item_id);
CREATE INDEX inventory_extensions_tenant_hazmat_idx ON amro.inventory_extensions (tenant_id, hazmat_class)
  WHERE hazmat_class IS NOT NULL;
CREATE INDEX inventory_extensions_shelf_idx         ON amro.inventory_extensions (tenant_id, item_id)
  WHERE shelf_life_days IS NOT NULL;

ALTER TABLE amro.inventory_extensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_extensions_tenant_select ON amro.inventory_extensions
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_amro_inventory_extensions_updated_at
  BEFORE UPDATE ON amro.inventory_extensions
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON amro.inventory_extensions TO authenticated;
GRANT ALL    ON amro.inventory_extensions TO service_role;
