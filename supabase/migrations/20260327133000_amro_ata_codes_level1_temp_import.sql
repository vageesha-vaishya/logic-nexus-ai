ALTER TABLE public.ata_codes
  ADD COLUMN IF NOT EXISTS parent_code_ref character varying(20) NULL;
