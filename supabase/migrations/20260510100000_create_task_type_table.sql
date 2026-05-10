-- DB-VERIFICATION: task-type-table-schema-overlap-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.task_type (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_type_seq integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id uuid NOT NULL,
  franchise_id uuid NULL,
  code character varying(10) NOT NULL,
  name character varying(100) NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT task_type_pkey PRIMARY KEY (id),
  CONSTRAINT task_type_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants (id) ON DELETE CASCADE,
  CONSTRAINT task_type_franchise_id_fkey FOREIGN KEY (franchise_id) REFERENCES public.franchises (id) ON DELETE SET NULL,
  CONSTRAINT task_type_tenant_franchise_code_uk UNIQUE (tenant_id, franchise_id, code)
);

CREATE INDEX IF NOT EXISTS idx_task_type_tenant_id
  ON public.task_type USING btree (tenant_id);

CREATE INDEX IF NOT EXISTS idx_task_type_franchise_id
  ON public.task_type USING btree (franchise_id);

DO $$
DECLARE
  v_tenant_id constant uuid := '157b8d12-c115-446e-a4dc-d12077751fe2';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Tenant % not found in public.tenants. Seed tenant before inserting task_type records.', v_tenant_id;
  END IF;

  INSERT INTO public.task_type (
    tenant_id,
    franchise_id,
    code,
    name,
    description,
    is_active
  )
  VALUES
    (v_tenant_id, NULL, 'AD', 'Airworthiness Directive', 'Airworthiness Directive', true),
    (v_tenant_id, NULL, 'SB', 'Service Bulletin', 'Service Bulletin', true),
    (v_tenant_id, NULL, 'SC', 'Scheduled Maintenance (MPD)', 'Scheduled Maintenance (MPD)', true),
    (v_tenant_id, NULL, 'CM', 'Component Maintenance', 'Component Maintenance', true),
    (v_tenant_id, NULL, 'DF', 'Deferred Defect', 'Deferred Defect', true),
    (v_tenant_id, NULL, 'UN', 'Unscheduled / Non-routine', 'Unscheduled / Non-routine', true),
    (v_tenant_id, NULL, 'MEL', 'Minimum Equipment List item', 'Minimum Equipment List item', true),
    (v_tenant_id, NULL, 'IN', 'Inspection', 'Inspection', true),
    (v_tenant_id, NULL, 'RE', 'Repair', 'Repair', true),
    (v_tenant_id, NULL, 'TR', 'Troubleshooting', 'Troubleshooting', true),
    (v_tenant_id, NULL, 'CC', 'Component Change', 'Component Change', true),
    (v_tenant_id, NULL, 'CT', 'Component Test', 'Component Test', true),
    (v_tenant_id, NULL, 'CE', 'Component Evaluation', 'Component Evaluation', true),
    (v_tenant_id, NULL, 'CF', 'Certification', 'Certification', true),
    (v_tenant_id, NULL, 'GE', 'General', 'General', true)
  ON CONFLICT (tenant_id, franchise_id, code) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = now();
END
$$;

COMMIT;
