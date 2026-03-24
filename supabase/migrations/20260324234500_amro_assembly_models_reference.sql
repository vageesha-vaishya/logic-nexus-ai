-- DB-VERIFICATION: amro-assembly-models-reviewed
-- DB-ARCH-APPROVAL: amro-assembly-models-approved
-- SCHEMA-OVERLAP-ANALYSIS: No existing AMRO master data table provides a normalized model registry linked to assembly types and manufacturers.
-- EXTENSION-ASSESSMENT: Extending aircraft or components would mix instance records with global model taxonomy.
-- EXTENSION-RATIONALE: Create a global reference table for assembly models tied to assembly_types and manufacturers.

BEGIN;

CREATE TABLE IF NOT EXISTS public.assembly_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id uuid NOT NULL REFERENCES public.manufacturers(id) ON DELETE RESTRICT,
  assembly_type_id uuid NOT NULL REFERENCES public.assembly_types(id) ON DELETE RESTRICT,
  model_code text NOT NULL,
  name text NOT NULL,
  primary_model text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_assembly_models_code ON public.assembly_models(manufacturer_id, assembly_type_id, model_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assembly_models_name ON public.assembly_models(manufacturer_id, assembly_type_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_assembly_models_active ON public.assembly_models(is_active);
CREATE INDEX IF NOT EXISTS idx_assembly_models_manufacturer_id ON public.assembly_models(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_assembly_models_assembly_type_id ON public.assembly_models(assembly_type_id);

ALTER TABLE public.assembly_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amro_platform_admin_access ON public.assembly_models;
CREATE POLICY amro_platform_admin_access
  ON public.assembly_models
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS amro_authenticated_access ON public.assembly_models;
CREATE POLICY amro_authenticated_access
  ON public.assembly_models
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMIT;
