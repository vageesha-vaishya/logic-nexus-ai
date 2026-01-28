-- Phase 1 Refactor: Replace Enum with Table for Domains
-- Implements Task: Refactor domain_type enum to platform_domains table

-- 1. Create platform_domains table
CREATE TABLE IF NOT EXISTS "public"."platform_domains" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "code" text NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "platform_domains_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "platform_domains_code_key" UNIQUE ("code")
);

-- 2. Insert initial data (Migrate existing enum values)
INSERT INTO "public"."platform_domains" ("code", "name", "description")
VALUES 
    ('LOGISTICS', 'Logistics & Supply Chain', 'Freight forwarding, transportation, and warehousing'),
    ('BANKING', 'Banking & Finance', 'Loans, mortgages, and financial services'),
    ('TELECOM', 'Telecommunications', 'Subscription billing and service management')
ON CONFLICT ("code") DO NOTHING;

-- 3. Add domain_id to tenants
DO $$ BEGIN
    ALTER TABLE "public"."tenants" ADD COLUMN "domain_id" uuid;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 4. Migrate data from domain_type to domain_id
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tenants' AND column_name = 'domain_type'
    ) THEN
        UPDATE "public"."tenants" t
        SET "domain_id" = pd.id
        FROM "public"."platform_domains" pd
        WHERE t.domain_type::text = pd.code;
    END IF;
END $$;

-- 5. Make domain_id NOT NULL and add FK
-- We use a DO block to handle the constraint addition safely
DO $$ BEGIN
    -- Only attempt to set NOT NULL if there are no null values
    IF NOT EXISTS (SELECT 1 FROM "public"."tenants" WHERE "domain_id" IS NULL) THEN
        ALTER TABLE "public"."tenants" ALTER COLUMN "domain_id" SET NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'tenants_domain_id_fkey'
    ) THEN
        ALTER TABLE "public"."tenants" 
        ADD CONSTRAINT "tenants_domain_id_fkey" 
        FOREIGN KEY ("domain_id") 
        REFERENCES "public"."platform_domains"("id") 
        ON DELETE RESTRICT;
    END IF;
END $$;

-- 6. Cleanup: Drop old column and enum
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tenants' AND column_name = 'domain_type'
    ) THEN
        ALTER TABLE "public"."tenants" DROP COLUMN "domain_type";
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'domain_type'
    ) THEN
        DROP TYPE "public"."domain_type";
    END IF;
END $$;

-- 7. Enable RLS on platform_domains (Read-only for most users)
ALTER TABLE "public"."platform_domains" ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view domains
DROP POLICY IF EXISTS "Authenticated users can view domains" ON "public"."platform_domains";
CREATE POLICY "Authenticated users can view domains" ON "public"."platform_domains"
FOR SELECT
TO authenticated
USING (true);

-- Allow platform admins to manage domains
DROP POLICY IF EXISTS "Platform admins can manage domains" ON "public"."platform_domains";
CREATE POLICY "Platform admins can manage domains" ON "public"."platform_domains"
FOR ALL
USING (public.is_platform_admin(auth.uid()));
