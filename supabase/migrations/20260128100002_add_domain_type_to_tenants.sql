-- Migration: Add domain_type to tenants
-- Description: Adds the domain_type enum and column to support multi-vertical architecture (Logistics, Banking, Telecom)
-- Task: 1.2 from Implementation Plan

-- 1. Create domain_type Enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'domain_type'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.domain_type AS ENUM ('logistics', 'banking', 'telecom');
    END IF;
END $$;

-- 2. Add domain_type column to tenants table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tenants'
          AND column_name = 'domain_type'
    ) THEN
        ALTER TABLE public.tenants
        ADD COLUMN domain_type public.domain_type DEFAULT 'logistics'::public.domain_type NOT NULL;
    END IF;
END $$;

-- 3. Comment for documentation
COMMENT ON COLUMN public.tenants.domain_type IS 'Vertical domain of the tenant (logistics, banking, telecom). Controls available modules and business logic.';
