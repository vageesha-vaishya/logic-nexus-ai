BEGIN;

DO $$
BEGIN
  IF to_regclass('public.work_package_template_task_templates') IS NULL THEN
    IF to_regclass('public.work_package_template_task_temlates') IS NOT NULL THEN
      ALTER TABLE public.work_package_template_task_temlates RENAME TO work_package_template_task_templates;
    ELSE
      CREATE TABLE public.work_package_template_task_templates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        franchise_id uuid REFERENCES public.franchises(id) ON DELETE CASCADE,
        work_package_template_id uuid NOT NULL REFERENCES public.work_package_templates(id) ON DELETE CASCADE,
        model_id uuid NOT NULL REFERENCES public.assembly_models(id) ON DELETE RESTRICT,
        task_template_id uuid NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
        created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
        updated_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
        created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_work_package_template_task_templates_tenant
  ON public.work_package_template_task_templates(tenant_id);

CREATE INDEX IF NOT EXISTS idx_work_package_template_task_templates_franchise
  ON public.work_package_template_task_templates(franchise_id);

CREATE INDEX IF NOT EXISTS idx_work_package_template_task_templates_template
  ON public.work_package_template_task_templates(work_package_template_id);

CREATE INDEX IF NOT EXISTS idx_work_package_template_task_templates_model
  ON public.work_package_template_task_templates(model_id);

CREATE INDEX IF NOT EXISTS idx_work_package_template_task_templates_task
  ON public.work_package_template_task_templates(task_template_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_work_package_template_task_templates_scope
  ON public.work_package_template_task_templates(
    tenant_id,
    COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid),
    work_package_template_id,
    model_id,
    task_template_id
  );

DROP TRIGGER IF EXISTS update_work_package_template_task_templates_updated_at ON public.work_package_template_task_templates;
DROP TRIGGER IF EXISTS update_work_package_template_task_temlates_updated_at ON public.work_package_template_task_templates;

CREATE TRIGGER update_work_package_template_task_templates_updated_at
BEFORE UPDATE ON public.work_package_template_task_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
