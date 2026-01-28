-- Phase 1: Multi-tenancy Foundation
-- Implements Task 1.2 and 1.3: Tenants table, Domain Type Enum, and RLS

-- 1. Create Domain Type Enum
DO $$ BEGIN
    CREATE TYPE "public"."domain_type" AS ENUM ('LOGISTICS', 'BANKING', 'TELECOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Tenants Table
CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- Add domain_type column if not exists
DO $$ BEGIN
    ALTER TABLE "public"."tenants" ADD COLUMN "domain_type" "public"."domain_type" DEFAULT 'LOGISTICS'::"public"."domain_type" NOT NULL;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add config column if not exists
DO $$ BEGIN
    ALTER TABLE "public"."tenants" ADD COLUMN "config" "jsonb" DEFAULT '{}'::"jsonb";
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 3. Link Profiles (Users) to Tenants
-- Add tenant_id to profiles if not exists
DO $$ BEGIN
    ALTER TABLE "public"."profiles" ADD COLUMN "tenant_id" "uuid";
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add FK constraint
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_tenant_id_fkey'
    ) THEN
        ALTER TABLE "public"."profiles" 
        ADD CONSTRAINT "profiles_tenant_id_fkey" 
        FOREIGN KEY ("tenant_id") 
        REFERENCES "public"."tenants"("id") 
        ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Enable RLS on Tenants
ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies for Tenants
-- Policy: Users can view their own tenant
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view their own tenant" ON "public"."tenants";
    CREATE POLICY "Users can view their own tenant" ON "public"."tenants"
    FOR SELECT
    USING (
        id IN (
            SELECT tenant_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );
END $$;

-- Policy: System Admins (service_role) can do everything
-- (Implicit in Supabase/Postgres usually, but good to be explicit if using a role claim, 
--  but for now we rely on service_role bypassing RLS or superuser)

-- 6. Update Profiles RLS to enforce tenant isolation (Optional but good practice)
-- Users can see profiles in their own tenant
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON "public"."profiles";
    CREATE POLICY "Users can view profiles in their tenant" ON "public"."profiles"
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );
END $$;
