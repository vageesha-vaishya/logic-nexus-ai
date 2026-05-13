-- DB-VERIFICATION: flight-logs-legacy-form-alignment-overlap-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

-- ============================================================================
-- 1) Flight Log Classification master table (tenant/franchise scoped)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.flight_log_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  classification_name text NOT NULL,
  classification_code text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_flight_log_classifications_tenant_franchise_name
  ON public.flight_log_classifications (
    tenant_id,
    COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(classification_name)
  );

CREATE INDEX IF NOT EXISTS idx_flight_log_classifications_tenant_active_sort
  ON public.flight_log_classifications (tenant_id, is_active, sort_order, classification_name);

ALTER TABLE public.flight_log_classifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flight_log_classifications_platform_admin_access ON public.flight_log_classifications;
CREATE POLICY flight_log_classifications_platform_admin_access
  ON public.flight_log_classifications
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS flight_log_classifications_tenant_franchise_scope ON public.flight_log_classifications;
CREATE POLICY flight_log_classifications_tenant_franchise_scope
  ON public.flight_log_classifications
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  );

COMMENT ON TABLE public.flight_log_classifications IS
  'Tenant/franchise-scoped reference list for flight log classifications used by AMRO flight logging.';

COMMENT ON COLUMN public.flight_log_classifications.classification_name IS
  'Display label (for example: Flight Check, Ground Run, Defect Rectification).';

-- ============================================================================
-- 2) Extend flight_logs for legacy-form field coverage (additive only)
-- ============================================================================
ALTER TABLE public.flight_logs
  ADD COLUMN IF NOT EXISTS pic_in_command text,
  ADD COLUMN IF NOT EXISTS co_pilot text,
  ADD COLUMN IF NOT EXISTS classification_id uuid,
  ADD COLUMN IF NOT EXISTS classification_name text,
  ADD COLUMN IF NOT EXISTS flight_log_attachment_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS airframe_periods jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS engine_periods jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS taxi_out_time_hours numeric(10,2),
  ADD COLUMN IF NOT EXISTS airborne_time_hours numeric(10,2),
  ADD COLUMN IF NOT EXISTS ground_run_time_hours numeric(10,2),
  ADD COLUMN IF NOT EXISTS ground_run_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS total_time_hours numeric(10,2),
  ADD COLUMN IF NOT EXISTS remarks text;

ALTER TABLE public.flight_logs
  DROP CONSTRAINT IF EXISTS flight_logs_attachment_refs_is_array;
ALTER TABLE public.flight_logs
  ADD CONSTRAINT flight_logs_attachment_refs_is_array
  CHECK (jsonb_typeof(flight_log_attachment_refs) = 'array');

ALTER TABLE public.flight_logs
  DROP CONSTRAINT IF EXISTS flight_logs_airframe_periods_is_array;
ALTER TABLE public.flight_logs
  ADD CONSTRAINT flight_logs_airframe_periods_is_array
  CHECK (jsonb_typeof(airframe_periods) = 'array');

ALTER TABLE public.flight_logs
  DROP CONSTRAINT IF EXISTS flight_logs_engine_periods_is_array;
ALTER TABLE public.flight_logs
  ADD CONSTRAINT flight_logs_engine_periods_is_array
  CHECK (jsonb_typeof(engine_periods) = 'array');

ALTER TABLE public.flight_logs
  DROP CONSTRAINT IF EXISTS flight_logs_taxi_out_time_hours_non_negative;
ALTER TABLE public.flight_logs
  ADD CONSTRAINT flight_logs_taxi_out_time_hours_non_negative
  CHECK (taxi_out_time_hours IS NULL OR taxi_out_time_hours >= 0);

ALTER TABLE public.flight_logs
  DROP CONSTRAINT IF EXISTS flight_logs_airborne_time_hours_non_negative;
ALTER TABLE public.flight_logs
  ADD CONSTRAINT flight_logs_airborne_time_hours_non_negative
  CHECK (airborne_time_hours IS NULL OR airborne_time_hours >= 0);

ALTER TABLE public.flight_logs
  DROP CONSTRAINT IF EXISTS flight_logs_ground_run_time_hours_non_negative;
ALTER TABLE public.flight_logs
  ADD CONSTRAINT flight_logs_ground_run_time_hours_non_negative
  CHECK (ground_run_time_hours IS NULL OR ground_run_time_hours >= 0);

ALTER TABLE public.flight_logs
  DROP CONSTRAINT IF EXISTS flight_logs_total_time_hours_non_negative;
ALTER TABLE public.flight_logs
  ADD CONSTRAINT flight_logs_total_time_hours_non_negative
  CHECK (total_time_hours IS NULL OR total_time_hours >= 0);

ALTER TABLE public.flight_logs
  DROP CONSTRAINT IF EXISTS flight_logs_ground_run_percent_range;
ALTER TABLE public.flight_logs
  ADD CONSTRAINT flight_logs_ground_run_percent_range
  CHECK (ground_run_percent IS NULL OR (ground_run_percent >= 0 AND ground_run_percent <= 100));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'flight_logs'
      AND c.conname = 'flight_logs_classification_id_fkey'
  ) THEN
    ALTER TABLE public.flight_logs
      ADD CONSTRAINT flight_logs_classification_id_fkey
      FOREIGN KEY (classification_id)
      REFERENCES public.flight_log_classifications(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_flight_logs_tenant_classification
  ON public.flight_logs (tenant_id, classification_id);

CREATE INDEX IF NOT EXISTS idx_flight_logs_tenant_log_selection_page
  ON public.flight_logs (tenant_id, log_selection_no, log_page_no);

UPDATE public.flight_logs
SET pic_in_command = pilot_name
WHERE pic_in_command IS NULL
  AND pilot_name IS NOT NULL;

COMMENT ON COLUMN public.flight_logs.pic_in_command IS
  'Pilot in Command (PIC) captured from legacy flight log forms.';
COMMENT ON COLUMN public.flight_logs.co_pilot IS
  'Co-pilot or first officer for the flight sector.';
COMMENT ON COLUMN public.flight_logs.classification_id IS
  'Foreign key to flight_log_classifications for controlled classification values.';
COMMENT ON COLUMN public.flight_logs.classification_name IS
  'Optional denormalized classification text for backward compatibility/imports.';
COMMENT ON COLUMN public.flight_logs.flight_log_attachment_refs IS
  'Array of attachment references (for example file_attachments IDs or external references).';
COMMENT ON COLUMN public.flight_logs.airframe_periods IS
  'Array payload for airframe period rows from legacy forms.';
COMMENT ON COLUMN public.flight_logs.engine_periods IS
  'Array payload for engine period rows from legacy forms.';

-- ============================================================================
-- 3) Seed Flight Log Classifications from legacy reference list
--    (idempotent insert across tenant-level and franchise-level scopes)
-- ============================================================================
WITH scopes AS (
  SELECT t.id AS tenant_id, NULL::uuid AS franchise_id
  FROM public.tenants t
  UNION ALL
  SELECT f.tenant_id, f.id
  FROM public.franchises f
),
seed_values AS (
  SELECT *
  FROM (
    VALUES
      (1, '2 & 4 Weekly flight ready storage'),
      (2, '2 weekly flight ready storage'),
      (3, 'apu'),
      (4, 'Cancelled'),
      (5, 'CHECK'),
      (6, 'Commercial'),
      (7, 'Compass Swinging'),
      (8, 'Compressor Wash'),
      (9, 'Defect rectification'),
      (10, 'DRY RUN'),
      (11, 'DRY RUN & HOVER CHECK'),
      (12, 'Dummy TLS'),
      (13, 'Engine and APU Ground Run'),
      (14, 'Engine and APU Run for Troubleshooting'),
      (15, 'Engine Ground Run'),
      (16, 'Engine Ground Run & Taxi Check'),
      (17, 'Engine Ground Run for ARA'),
      (18, 'Flight Cancelled'),
      (19, 'FLIGHT CHECK'),
      (20, 'G/R for issue of C of A'),
      (21, 'G/R Idel TT check'),
      (22, 'Ground Run'),
      (23, 'Ground Run & Hover Check'),
      (24, 'Ground Run & NG TOPPIN'),
      (25, 'Ground run after engine change'),
      (26, 'Ground Run For C of A Renewal'),
      (27, 'Ground run for tail rotor RADS'),
      (28, 'Ground Run post Compressor Wash'),
      (29, 'Hover Check'),
      (30, 'Light on Skid'),
      (31, 'Night flying'),
      (32, 'Normal flight'),
      (33, 'Owner Flying'),
      (34, 'PA CHECK'),
      (35, 'PAC & Beep range'),
      (36, 'Periodic Engine Ground Run'),
      (37, 'positioning'),
      (38, 'Private'),
      (39, 'Proficiency Check'),
      (40, 'Schedule'),
      (41, 'Tail Rotor Vibration Check'),
      (42, 'TAXI CHECK'),
      (43, 'Taxi Check & Compass Swing'),
      (44, 'Test Flight'),
      (45, 'Test Flight for ARA'),
      (46, 'Test Flight For C of A'),
      (47, 'Test Flight for VIBREX'),
      (48, 'track & balance'),
      (49, 'Training'),
      (50, 'VIBREX'),
      (51, 'Weekly Ground Run')
  ) AS seeded(sort_order, classification_name)
)
INSERT INTO public.flight_log_classifications (
  tenant_id,
  franchise_id,
  classification_name,
  is_active,
  sort_order
)
SELECT
  s.tenant_id,
  s.franchise_id,
  v.classification_name,
  true,
  v.sort_order
FROM scopes s
CROSS JOIN seed_values v
WHERE NOT EXISTS (
  SELECT 1
  FROM public.flight_log_classifications existing
  WHERE existing.tenant_id = s.tenant_id
    AND COALESCE(existing.franchise_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = COALESCE(s.franchise_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND lower(existing.classification_name) = lower(v.classification_name)
);

COMMIT;
