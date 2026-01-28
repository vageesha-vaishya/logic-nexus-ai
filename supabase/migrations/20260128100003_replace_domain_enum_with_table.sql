-- Migration: Replace domain_type Enum with platform_domains Table
-- Description: Enforces the "No Enum" policy for Domain Type.
-- Actions: Populates platform_domains, migrates tenants, drops enum.

-- 1. Ensure platform_domains table exists (Idempotent)
CREATE TABLE IF NOT EXISTS public.platform_domains (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  code text NOT NULL UNIQUE, -- Added UNIQUE constraint for safety
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Populate platform_domains with initial data
INSERT INTO public.platform_domains (code, name, description)
VALUES 
  ('logistics', 'Logistics & Freight', 'Core logistics and freight forwarding capabilities'),
  ('banking', 'Banking & Finance', 'Financial services and loan origination'),
  ('telecom', 'Telecommunications', 'Subscription billing and service management')
ON CONFLICT (code) DO NOTHING;

-- 3. Ensure tenants has domain_id column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'domain_id') THEN
        ALTER TABLE public.tenants ADD COLUMN domain_id uuid REFERENCES public.platform_domains(id);
    END IF;
END $$;

-- 4. Migrate existing data (if any) from domain_type enum to domain_id
-- We assume 'logistics' is the default if domain_type is missing or null
DO $$
DECLARE
  v_logistics_id uuid;
  v_banking_id uuid;
  v_telecom_id uuid;
BEGIN
  -- Get IDs
  SELECT id INTO v_logistics_id FROM public.platform_domains WHERE code = 'logistics';
  SELECT id INTO v_banking_id FROM public.platform_domains WHERE code = 'banking';
  SELECT id INTO v_telecom_id FROM public.platform_domains WHERE code = 'telecom';

  -- Update tenants based on domain_type (if column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'domain_type') THEN
      
      -- Update logistics
      UPDATE public.tenants 
      SET domain_id = v_logistics_id 
      WHERE domain_type = 'logistics'::text::public.domain_type OR domain_type IS NULL;

      -- Update banking
      UPDATE public.tenants 
      SET domain_id = v_banking_id 
      WHERE domain_type = 'banking'::text::public.domain_type;

      -- Update telecom
      UPDATE public.tenants 
      SET domain_id = v_telecom_id 
      WHERE domain_type = 'telecom'::text::public.domain_type;

  ELSE
      -- If domain_type column doesn't exist, just default everything to logistics (Phase 1 assumption)
      UPDATE public.tenants 
      SET domain_id = v_logistics_id 
      WHERE domain_id IS NULL;
  END IF;
END $$;

-- 5. Drop domain_type column and enum
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'domain_type') THEN
        ALTER TABLE public.tenants DROP COLUMN domain_type;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'domain_type') THEN
        DROP TYPE public.domain_type;
    END IF;
END $$;

-- 6. Add Not Null constraint to domain_id after population
ALTER TABLE public.tenants ALTER COLUMN domain_id SET NOT NULL;
