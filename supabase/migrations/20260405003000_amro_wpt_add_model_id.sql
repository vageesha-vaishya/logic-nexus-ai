DO $migration$
DECLARE
  v_fk_exists boolean := false;
  v_idx_exists boolean := false;
  v_check_exists boolean := false;
BEGIN
  EXECUTE $sql$
    ALTER TABLE public.work_package_templates
      ADD COLUMN IF NOT EXISTS model_id uuid
  $sql$;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_work_package_templates_model_id'
      AND conrelid = 'public.work_package_templates'::regclass
  ) INTO v_fk_exists;

  IF NOT v_fk_exists THEN
    EXECUTE $sql$
      ALTER TABLE public.work_package_templates
      ADD CONSTRAINT fk_work_package_templates_model_id
      FOREIGN KEY (model_id) REFERENCES public.assembly_models(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT
    $sql$;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_class idx
    JOIN pg_namespace ns ON ns.oid = idx.relnamespace
    WHERE idx.relkind = 'i'
      AND ns.nspname = 'public'
      AND idx.relname = 'idx_work_package_templates_model_id'
  ) INTO v_idx_exists;

  IF NOT v_idx_exists THEN
    EXECUTE $sql$
      CREATE INDEX idx_work_package_templates_model_id
      ON public.work_package_templates(model_id)
    $sql$;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_work_package_templates_model_id_required'
      AND conrelid = 'public.work_package_templates'::regclass
  ) INTO v_check_exists;

  IF NOT v_check_exists THEN
    EXECUTE $sql$
      ALTER TABLE public.work_package_templates
      ADD CONSTRAINT ck_work_package_templates_model_id_required
      CHECK (model_id IS NOT NULL) NOT VALID
    $sql$;
  END IF;
END
$migration$;
