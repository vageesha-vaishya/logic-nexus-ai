ALTER TABLE public.rate_options
  ADD COLUMN IF NOT EXISTS rate_type text,
  ADD COLUMN IF NOT EXISTS rate_valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS transit_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS leg_connections jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS container_type text,
  ADD COLUMN IF NOT EXISTS container_size text,
  ADD COLUMN IF NOT EXISTS commodity_type text,
  ADD COLUMN IF NOT EXISTS hs_code text,
  ADD COLUMN IF NOT EXISTS imdg_class text,
  ADD COLUMN IF NOT EXISTS temperature_control_min_c numeric(8,2),
  ADD COLUMN IF NOT EXISTS temperature_control_max_c numeric(8,2),
  ADD COLUMN IF NOT EXISTS oversized_length_cm numeric(10,2),
  ADD COLUMN IF NOT EXISTS oversized_width_cm numeric(10,2),
  ADD COLUMN IF NOT EXISTS oversized_height_cm numeric(10,2),
  ADD COLUMN IF NOT EXISTS origin_code text,
  ADD COLUMN IF NOT EXISTS destination_code text,
  ADD COLUMN IF NOT EXISTS standalone_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS option_ordinal integer,
  ADD COLUMN IF NOT EXISTS multimodal_rule_config jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rate_options_rate_type_check'
  ) THEN
    ALTER TABLE public.rate_options
      ADD CONSTRAINT rate_options_rate_type_check
      CHECK (rate_type IS NULL OR rate_type IN ('spot', 'contract', 'market', 'negotiated'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rate_options_option_ordinal_check'
  ) THEN
    ALTER TABLE public.rate_options
      ADD CONSTRAINT rate_options_option_ordinal_check
      CHECK (option_ordinal IS NULL OR option_ordinal IN (1, 2, 3, 4));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rate_options_quote_context_standalone
  ON public.rate_options (tenant_id, quote_id, quote_version_id, standalone_mode, option_ordinal);
