-- DB-VERIFICATION: directive-frequency-temp-redefinition-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge
-- Extension assessment:
--   Existing public.directive_frequency_temp is a staging table and can be safely
--   redefined in early development with dummy data.

BEGIN;

DROP TABLE IF EXISTS public.directive_frequency_temp CASCADE;

CREATE TABLE public.directive_frequency_temp (
  frequency_sequence integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  code_form_no character varying(50) NULL,
  ata_code character varying(10) NULL,
  reference_amp text NULL,
  description text NULL,
  category_code character varying(10) NULL,
  estimated_man_hours interval NULL,
  revision_status text NULL,
  frequency text NULL,
  threshold_hours interval NULL,
  threshold_cycles integer NULL,
  threshold_calendar integer NULL,
  threshold_landings integer NULL,
  calendar_unit public.calendar_unit NULL,
  threshold_rins integer NULL,
  threshold_hobbs integer NULL,
  is_parsed_success boolean NULL
) TABLESPACE pg_default;

COMMENT ON TABLE public.directive_frequency_temp IS
  'Temporary staging table used to ingest directive frequency rows before normalization and directive upsert.';

COMMIT;
