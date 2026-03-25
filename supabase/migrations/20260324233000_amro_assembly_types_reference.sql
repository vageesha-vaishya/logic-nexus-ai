-- DB-VERIFICATION: amro-assembly-types-reviewed
-- DB-ARCH-APPROVAL: amro-assembly-types-approved
-- SCHEMA-OVERLAP-ANALYSIS: No existing AMRO master data table provides assembly type taxonomy with descriptions.
-- EXTENSION-ASSESSMENT: Extending components or parts_inventory would conflate instance records with global assembly classification.
-- EXTENSION-RATIONALE: Create a global reference table for assembly types with stable codes and descriptions.

BEGIN;

CREATE TABLE IF NOT EXISTS public.assembly_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_assembly_types_code ON public.assembly_types(assembly_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assembly_types_name ON public.assembly_types(lower(name));
CREATE INDEX IF NOT EXISTS idx_assembly_types_active ON public.assembly_types(is_active);

ALTER TABLE public.assembly_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amro_platform_admin_access ON public.assembly_types;
CREATE POLICY amro_platform_admin_access
  ON public.assembly_types
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS amro_authenticated_access ON public.assembly_types;
CREATE POLICY amro_authenticated_access
  ON public.assembly_types
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO public.assembly_types (assembly_code, name, description, is_active, metadata)
VALUES
  ('AIRFRAME', 'Airframe', 'The main structure of the aircraft, including fuselage, wings, and control surfaces.', true, jsonb_build_object('source', 'seed_list')),
  ('ENGINE', 'Engine', 'The primary propulsion unit (Turbofan, Turboprop, or Piston).', true, jsonb_build_object('source', 'seed_list')),
  ('PROPELLER', 'Propeller', 'Specific to turboprop or piston aircraft; includes blades and hubs.', true, jsonb_build_object('source', 'seed_list')),
  ('APU', 'Auxiliary Power Unit (APU)', 'The small gas turbine engine usually located in the tail for ground power/starting.', true, jsonb_build_object('source', 'seed_list')),
  ('LANDING_GEAR', 'Landing Gear', 'The complete assembly of struts, wheels, and braking systems.', true, jsonb_build_object('source', 'seed_list')),
  ('AIR_CONDITIONING', 'Air Conditioning', 'The Environmental Control System (ECS), including packs and pressurization.', true, jsonb_build_object('source', 'seed_list')),
  ('AVIONICS', 'Avionics', 'Electronic systems like navigation, communication, and flight management.', true, jsonb_build_object('source', 'seed_list')),
  ('INTERIOR_CABIN', 'Interior/Cabin', 'Seats, galleys, and emergency equipment.', true, jsonb_build_object('source', 'seed_list'))
ON CONFLICT (assembly_code) DO NOTHING;

COMMIT;
