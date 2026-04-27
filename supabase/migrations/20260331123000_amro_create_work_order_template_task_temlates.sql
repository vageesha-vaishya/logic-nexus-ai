BEGIN;

CREATE TABLE IF NOT EXISTS public.work_order_template_task_temlates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  work_order_template_id uuid NOT NULL REFERENCES public.work_order_templates(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES public.assembly_models(id) ON DELETE RESTRICT,
  task_template_id uuid NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wpt_task_temlates_tenant_franchise_model_task_template
  ON public.work_order_template_task_temlates(
    tenant_id,
    COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid),
    model_id,
    task_template_id
  );

CREATE INDEX IF NOT EXISTS idx_wpt_task_temlates_tenant_id
  ON public.work_order_template_task_temlates(tenant_id);

CREATE INDEX IF NOT EXISTS idx_wpt_task_temlates_franchise_id
  ON public.work_order_template_task_temlates(franchise_id);

CREATE INDEX IF NOT EXISTS idx_wpt_task_temlates_work_order_template_id
  ON public.work_order_template_task_temlates(work_order_template_id);

CREATE INDEX IF NOT EXISTS idx_wpt_task_temlates_model_id
  ON public.work_order_template_task_temlates(model_id);

CREATE INDEX IF NOT EXISTS idx_wpt_task_temlates_task_template_id
  ON public.work_order_template_task_temlates(task_template_id);

CREATE INDEX IF NOT EXISTS idx_wpt_task_temlates_tenant_franchise
  ON public.work_order_template_task_temlates(tenant_id, franchise_id);

ALTER TABLE public.work_order_template_task_temlates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amro_platform_admin_access ON public.work_order_template_task_temlates;
CREATE POLICY amro_platform_admin_access
  ON public.work_order_template_task_temlates
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS amro_tenant_franchise_scope ON public.work_order_template_task_temlates;
CREATE POLICY amro_tenant_franchise_scope
  ON public.work_order_template_task_temlates
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

DROP TRIGGER IF EXISTS update_work_order_template_task_temlates_updated_at
  ON public.work_order_template_task_temlates;

CREATE TRIGGER update_work_order_template_task_temlates_updated_at
BEFORE UPDATE ON public.work_order_template_task_temlates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
