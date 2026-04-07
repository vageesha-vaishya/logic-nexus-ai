BEGIN;

DO $$
BEGIN
  IF to_regclass('public.ata_codes') IS NULL THEN
    RAISE EXCEPTION 'Required table public.ata_codes does not exist';
  END IF;

  IF to_regclass('public.assembly_models') IS NULL THEN
    RAISE EXCEPTION 'Required table public.assembly_models does not exist';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.ata_code_assembly_model (
  ata_code_id uuid NOT NULL,
  assembly_model_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  franchise_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL,
  CONSTRAINT ata_code_assembly_model_pkey PRIMARY KEY (ata_code_id, assembly_model_id),
  CONSTRAINT fk_ata_code_assembly_model_ata_code
    FOREIGN KEY (ata_code_id) REFERENCES public.ata_codes(id) ON DELETE CASCADE,
  CONSTRAINT fk_ata_code_assembly_model_assembly_model
    FOREIGN KEY (assembly_model_id) REFERENCES public.assembly_models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ata_code_assembly_model_assembly_model_id
  ON public.ata_code_assembly_model (assembly_model_id);

CREATE INDEX IF NOT EXISTS idx_ata_code_assembly_model_tenant_franchise
  ON public.ata_code_assembly_model (tenant_id, franchise_id);

CREATE INDEX IF NOT EXISTS idx_ata_code_assembly_model_updated_at
  ON public.ata_code_assembly_model (updated_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pg_function_is_visible(oid)
  ) THEN
    DROP TRIGGER IF EXISTS trg_ata_code_assembly_model_updated_at ON public.ata_code_assembly_model;
    CREATE TRIGGER trg_ata_code_assembly_model_updated_at
      BEFORE UPDATE ON public.ata_code_assembly_model
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

COMMENT ON TABLE public.ata_code_assembly_model IS
  'Junction table mapping ATA codes to assembly models (many-to-many).';

COMMENT ON COLUMN public.ata_code_assembly_model.ata_code_id IS
  'FK to public.ata_codes.id';

COMMENT ON COLUMN public.ata_code_assembly_model.assembly_model_id IS
  'FK to public.assembly_models.id';

COMMIT;
