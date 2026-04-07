BEGIN;

DO $$
BEGIN
  IF to_regclass('public.ata_code_assembly_model') IS NULL THEN
    RAISE EXCEPTION 'Required table public.ata_code_assembly_model does not exist';
  END IF;
END;
$$;

DO $$
DECLARE
  task_template_model_fk_column text;
BEGIN
  SELECT c.column_name
  INTO task_template_model_fk_column
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'task_templates'
    AND c.column_name IN ('assembly_models', 'model_id')
  ORDER BY CASE c.column_name
    WHEN 'assembly_models' THEN 1
    WHEN 'model_id' THEN 2
    ELSE 99
  END
  LIMIT 1;

  IF task_template_model_fk_column IS NULL THEN
    RAISE EXCEPTION 'Neither public.task_templates.assembly_models nor public.task_templates.model_id exists';
  END IF;

  EXECUTE format($sql$
    WITH derived_pairs AS (
      SELECT DISTINCT
        ac.id AS ata_code_id,
        am.id AS assembly_model_id,
        COALESCE(tt.tenant_id, am.tenant_id, ac.tenant_id) AS tenant_id,
        COALESCE(tt.franchise_id, am.franchise_id, ac.franchise_id) AS franchise_id
      FROM public.task_templates tt
      INNER JOIN public.assembly_models am
        ON am.id = tt.%1$I
      INNER JOIN public.ata_codes ac
        ON ac.code = tt.ata_code
       AND ac.tenant_id = tt.tenant_id
      WHERE tt.%1$I IS NOT NULL
        AND COALESCE(NULLIF(tt.ata_code, ''), '') <> ''
    )
    INSERT INTO public.ata_code_assembly_model (
      ata_code_id,
      assembly_model_id,
      tenant_id,
      franchise_id
    )
    SELECT
      ata_code_id,
      assembly_model_id,
      tenant_id,
      franchise_id
    FROM derived_pairs
    WHERE tenant_id IS NOT NULL
    ON CONFLICT (ata_code_id, assembly_model_id) DO NOTHING
  $sql$, task_template_model_fk_column);
END;
$$;

COMMIT;
