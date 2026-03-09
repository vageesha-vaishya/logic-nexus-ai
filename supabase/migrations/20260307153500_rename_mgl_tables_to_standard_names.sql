DO $$
BEGIN
  IF to_regclass('public.mgl_templates') IS NOT NULL AND to_regclass('public.templates') IS NULL THEN
    EXECUTE 'ALTER TABLE public.mgl_templates RENAME TO templates';
  END IF;

  IF to_regclass('public.mgl_rate_options') IS NOT NULL AND to_regclass('public.rate_options') IS NULL THEN
    EXECUTE 'ALTER TABLE public.mgl_rate_options RENAME TO rate_options';
  END IF;

  IF to_regclass('public.mgl_rate_option_legs') IS NOT NULL AND to_regclass('public.rate_option_legs') IS NULL THEN
    EXECUTE 'ALTER TABLE public.mgl_rate_option_legs RENAME TO rate_option_legs';
  END IF;

  IF to_regclass('public.mgl_rate_charge_rows') IS NOT NULL AND to_regclass('public.rate_charge_rows') IS NULL THEN
    EXECUTE 'ALTER TABLE public.mgl_rate_charge_rows RENAME TO rate_charge_rows';
  END IF;

  IF to_regclass('public.mgl_rate_charge_cells') IS NOT NULL AND to_regclass('public.rate_charge_cells') IS NULL THEN
    EXECUTE 'ALTER TABLE public.mgl_rate_charge_cells RENAME TO rate_charge_cells';
  END IF;

  IF to_regclass('public.mgl_rate_option_history') IS NOT NULL AND to_regclass('public.rate_option_history') IS NULL THEN
    EXECUTE 'ALTER TABLE public.mgl_rate_option_history RENAME TO rate_option_history';
  END IF;

  IF to_regclass('public.mgl_quotation_audit_logs') IS NOT NULL AND to_regclass('public.quotation_audit_logs') IS NULL THEN
    EXECUTE 'ALTER TABLE public.mgl_quotation_audit_logs RENAME TO quotation_audit_logs';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.mgl_rate_matrix_view') IS NOT NULL AND to_regclass('public.rate_matrix_view') IS NULL THEN
    EXECUTE 'ALTER VIEW public.mgl_rate_matrix_view RENAME TO rate_matrix_view';
  END IF;

  IF to_regclass('public.quotation_version_options_mgl_compat') IS NOT NULL AND to_regclass('public.quotation_version_options_compat') IS NULL THEN
    EXECUTE 'ALTER VIEW public.quotation_version_options_mgl_compat RENAME TO quotation_version_options_compat';
  END IF;
END $$;

DO $$
DECLARE
  fn_signature regprocedure;
BEGIN
  IF to_regprocedure('public.upsert_main_template(uuid,text,text,text,jsonb,boolean,integer)') IS NULL THEN
    SELECT p.oid::regprocedure
    INTO fn_signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'upsert_mgl_main_template'
    LIMIT 1;

    IF fn_signature IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s RENAME TO upsert_main_template', fn_signature);
    END IF;
  END IF;
END $$;
